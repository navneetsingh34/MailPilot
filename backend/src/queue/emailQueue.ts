import { Queue } from 'bullmq';
import { createRedisConnection } from '../lib/redis';

export const EMAIL_QUEUE = 'email-send';

export interface EmailJobData {
  emailId: string;
  /** Routing info so the worker can check hourly limits before touching the DB.
   *  Optional: jobs created before these fields existed still work (slow path). */
  userId?: string;
  senderId?: string;
  campaignId?: string;
}

export interface EnqueueEmail {
  id: string;
  scheduledAt: Date;
  userId: string;
  senderId: string;
  campaignId: string;
}

/**
 * How long a worker's claim on an email (status SENDING) is trusted. Past this,
 * the worker is presumed dead and another attempt may take the email over.
 * Must exceed the time a single SMTP send can take.
 */
export const SEND_LOCK_TTL_MS = 2 * 60 * 1000;

const ADD_CHUNK = 500;

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE, {
  connection: createRedisConnection('queue'),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    // Keep finished jobs around for a while so Bull Board shows history and
    // re-adding the same jobId within that window is a no-op.
    removeOnComplete: { age: 24 * 60 * 60, count: 5000 },
    removeOnFail: { age: 7 * 24 * 60 * 60 },
  },
});

/**
 * Adds one delayed job per email. `jobId = email.id`, so BullMQ ignores any
 * email that already has a job — calling this twice for the same emails is safe.
 */
export async function enqueueEmails(emails: EnqueueEmail[]): Promise<void> {
  const now = Date.now();
  for (let i = 0; i < emails.length; i += ADD_CHUNK) {
    await emailQueue.addBulk(
      emails.slice(i, i + ADD_CHUNK).map((e) => ({
        name: 'send-email',
        data: { emailId: e.id, userId: e.userId, senderId: e.senderId, campaignId: e.campaignId },
        opts: { jobId: e.id, delay: Math.max(0, e.scheduledAt.getTime() - now) },
      })),
    );
  }
}
