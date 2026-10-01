import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { enqueueEmails, SEND_LOCK_TTL_MS } from './emailQueue';

const BATCH = 1000;

/**
 * Postgres is the source of truth; Redis holds the timers. On startup, make sure
 * every email that still needs sending has a BullMQ job:
 *  - SCHEDULED rows (covers a crash between DB commit and enqueue, or a Redis wipe)
 *  - SENDING rows whose worker lock went stale (worker died mid-send)
 *
 * Existing jobs are untouched (jobId dedupe), so this is safe to run any time.
 * Overdue emails get delay 0 and go out immediately; future ones keep their time.
 */
export async function reconcilePendingEmails(): Promise<number> {
  const staleBefore = new Date(Date.now() - SEND_LOCK_TTL_MS);
  let cursor: string | undefined;
  let total = 0;

  for (;;) {
    const batch = await prisma.email.findMany({
      where: {
        OR: [{ status: 'SCHEDULED' }, { status: 'SENDING', lockedAt: { lt: staleBefore } }],
      },
      select: { id: true, scheduledAt: true, userId: true, senderId: true, campaignId: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    if (batch.length === 0) break;
    await enqueueEmails(batch);
    total += batch.length;
    cursor = batch[batch.length - 1].id;
  }

  logger.info({ pending: total }, 'reconciled pending emails with the queue');
  return total;
}
