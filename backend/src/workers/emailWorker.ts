import { setTimeout as sleep } from 'node:timers/promises';
import { DelayedError, Worker, type Job } from 'bullmq';
import { env } from '../config/env';
import { KeyedMutex } from '../lib/keyedMutex';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { createRedisConnection } from '../lib/redis';
import { EMAIL_QUEUE, SEND_LOCK_TTL_MS, type EmailJobData } from '../queue/emailQueue';
import { campaignHourlyLimit, senderHourlyLimit } from '../services/limitsCache';
import { loadOutboundEmail, sendEmail } from '../services/mailer';
import { notifyRateLimitHit } from '../services/notifications';
import { deferral, finishSendSlot, fullHourScope, reserveHourlySlot, reserveSendSlot } from '../services/rateLimiter';
import { searchIndexer } from '../services/searchIndexer';

/** A job may fire this much before its DB time (clock skew) and still be sent. */
const EARLY_TOLERANCE_MS = 2000;

const senderMutex = new KeyedMutex();

type JobOutcome = { sent: true; messageId: string } | { skipped: string };

/** Push the job back into the delayed set without counting it as a failed attempt. */
async function deferJob(job: Job<EmailJobData>, token: string | undefined, until: number): Promise<never> {
  await job.moveToDelayed(until, token);
  throw new DelayedError();
}

/**
 * Called when the atomic claim failed: work out why, and either skip the job
 * (already handled) or push it back until it can actually be sent.
 */
async function handleUnclaimable(job: Job<EmailJobData>, token: string | undefined): Promise<JobOutcome> {
  const email = await prisma.email.findUnique({
    where: { id: job.data.emailId },
    select: { status: true, scheduledAt: true, lockedAt: true },
  });
  if (!email) return { skipped: 'email no longer exists' };
  if (email.status === 'SENT' || email.status === 'FAILED') return { skipped: `already ${email.status}` };
  if (email.status === 'SENDING' && email.lockedAt) {
    // A previous attempt (whose worker likely crashed) may still be mid-send. Check back once its lock expires.
    return deferJob(job, token, email.lockedAt.getTime() + SEND_LOCK_TTL_MS);
  }
  // Not due yet (e.g. its time was pushed back after this job was created).
  return deferJob(job, token, email.scheduledAt.getTime());
}

/**
 * Fast path for overflow: if the sender's or campaign's hour is already full, reschedule
 * the email with a single DB write, without claiming or loading it. Under a large burst
 * (1000 emails, 200/hour) this is what most jobs hit, so it needs to be cheap.
 * Returns without deferring when there is room (or the job lacks routing info); the
 * normal path then re-checks atomically.
 */
async function deferIfHourFull(job: Job<EmailJobData>, token: string | undefined): Promise<void> {
  const { emailId, userId, senderId, campaignId } = job.data;
  if (!userId || !senderId || !campaignId) return;
  const campaignLimit = await campaignHourlyLimit(campaignId);
  if (campaignLimit === null) return; // deleted; the normal path will skip it
  const limits = {
    senderId,
    senderLimit: await senderHourlyLimit(senderId),
    campaignId,
    campaignLimit,
    gapMs: env.MIN_DELAY_BETWEEN_SENDS_MS,
  };
  const scope = await fullHourScope(limits);
  if (!scope) return;

  const slot = await deferral(limits, scope);
  const { count } = await prisma.email.updateMany({
    where: { id: emailId, status: 'SCHEDULED' },
    data: { scheduledAt: slot.resumeAt, deferrals: { increment: 1 } },
  });
  if (count === 0) return; // already sent / being sent: let the normal path decide
  searchIndexer.markDirty(emailId);
  void notifyRateLimitHit({ userId, emailId, senderId, campaignId, scope, limit: slot.limit, windowStart: slot.windowStart, resumeAt: slot.resumeAt });
  await deferJob(job, token, slot.resumeAt.getTime());
}

async function processEmailJob(job: Job<EmailJobData>, token?: string): Promise<JobOutcome> {
  const { emailId } = job.data;
  await deferIfHourFull(job, token);
  const now = Date.now();

  // Idempotency guard: atomically claim the row in a single statement. Only one worker can
  // flip it to SENDING, and SENT/FAILED rows (or ones not yet due) never match.
  const claimed = await prisma.email.updateMany({
    where: {
      id: emailId,
      scheduledAt: { lte: new Date(now + EARLY_TOLERANCE_MS) },
      OR: [{ status: 'SCHEDULED' }, { status: 'SENDING', lockedAt: { lt: new Date(now - SEND_LOCK_TTL_MS) } }],
    },
    data: { status: 'SENDING', lockedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return handleUnclaimable(job, token);

  let result;
  try {
    const email = await loadOutboundEmail(emailId);

    const reservation = await reserveHourlySlot({
      senderId: email.sender.id,
      senderLimit: email.sender.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      campaignId: email.campaignId,
      campaignLimit: email.campaign.hourlyLimit,
      gapMs: env.MIN_DELAY_BETWEEN_SENDS_MS,
    });
    if (!reservation.ok) {
      // Hourly limit reached: never drop or fail — release the claim and move the email
      // into the next window. A deferral is not a send attempt, so undo the increment.
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SCHEDULED',
          lockedAt: null,
          scheduledAt: reservation.resumeAt,
          deferrals: { increment: 1 },
          attempts: { decrement: 1 },
        },
      });
      searchIndexer.markDirty(emailId);
      void notifyRateLimitHit({
        userId: email.userId,
        emailId,
        senderId: email.sender.id,
        campaignId: email.campaignId,
        scope: reservation.scope,
        limit: reservation.limit,
        windowStart: reservation.windowStart,
        resumeAt: reservation.resumeAt,
      });
      return await deferJob(job, token, reservation.resumeAt.getTime());
    }

    // Minimum gap between sends from the same sender. Within this process a sender's sends
    // run one at a time (FIFO); the Redis slot extends the guarantee across processes.
    const gapMs = env.MIN_DELAY_BETWEEN_SENDS_MS;
    result = await senderMutex.run(email.sender.id, async () => {
      const waitMs = await reserveSendSlot(email.sender.id, gapMs);
      if (waitMs > 0) await sleep(waitMs);
      try {
        return await sendEmail(email);
      } finally {
        await finishSendSlot(email.sender.id, gapMs);
      }
    });
  } catch (err) {
    if (err instanceof DelayedError) throw err;
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    const error = err instanceof Error ? err.message : String(err);
    await prisma.email.update({
      where: { id: emailId },
      data: finalAttempt
        ? { status: 'FAILED', failedAt: new Date(), completedAt: new Date(), lockedAt: null, error }
        : { status: 'SCHEDULED', lockedAt: null, error },
    });
    searchIndexer.markDirty(emailId);
    throw err; // BullMQ retries with backoff, or records the final failure
  }

  await prisma.email.update({
    where: { id: emailId },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      completedAt: new Date(),
      messageId: result.messageId,
      previewUrl: result.previewUrl,
      lockedAt: null,
      error: null,
    },
  });
  searchIndexer.markDirty(emailId);
  return { sent: true, messageId: result.messageId };
}

export function startEmailWorker(): Worker<EmailJobData, JobOutcome> {
  const worker = new Worker<EmailJobData, JobOutcome>(EMAIL_QUEUE, processEmailJob, {
    connection: createRedisConnection('worker'),
    // Jobs run in parallel up to this limit. Per-sender spacing is enforced by the Redis
    // send slot (not BullMQ's limiter, which would also throttle jobs that are only being
    // rescheduled after hitting an hourly cap). BullMQ keeps renewing job locks while a
    // job waits for its slot, so waiting never makes a job look stalled.
    concurrency: env.WORKER_CONCURRENCY,
  });

  worker.on('completed', (job, outcome) => {
    if ('sent' in outcome) logger.info({ emailId: job.data.emailId }, 'email sent');
    else logger.debug({ emailId: job.data.emailId, reason: outcome.skipped }, 'email job skipped');
  });
  worker.on('failed', (job, err) => {
    logger.warn({ emailId: job?.data.emailId, attempt: job?.attemptsMade, err: err.message }, 'email job failed');
  });
  worker.on('error', (err) => logger.error({ err }, 'worker error'));

  return worker;
}
