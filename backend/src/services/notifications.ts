import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import type { LimitScope } from './rateLimiter';
import { hourKey } from './rateLimiter';
import { notifyUserOnSlack } from './slackService';

export interface RateLimitHitEvent {
  userId: string;
  /** Any email that hit the limit; used to describe the sender / campaign in the alert. */
  emailId: string;
  senderId: string;
  campaignId: string;
  scope: LimitScope;
  limit: number;
  windowStart: Date;
  resumeAt: Date;
}

/** Renders in each viewer's own timezone inside Slack. */
const slackTime = (d: Date) => `<!date^${Math.floor(d.getTime() / 1000)}^{date_short_pretty} at {time}|${d.toISOString()}>`;

function rateLimitMessage(e: RateLimitHitEvent, senderEmail: string, campaignSubject: string) {
  const what = e.scope === 'sender' ? `Sender *${senderEmail}*` : `Campaign *${campaignSubject}*`;
  const text = `⏸️ Hourly limit reached: ${e.scope === 'sender' ? senderEmail : campaignSubject} (${e.limit}/hour)`;
  return {
    text,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '⏸️ Hourly send limit reached' } },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `${what} has sent its *${e.limit} emails* for this hour.` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Sender*\n${senderEmail}` },
          { type: 'mrkdwn', text: `*Limit*\n${e.limit} per hour (${e.scope})` },
          { type: 'mrkdwn', text: `*Campaign*\n${campaignSubject}` },
          { type: 'mrkdwn', text: `*Resumes*\n${slackTime(e.resumeAt)}` },
        ],
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: 'Remaining emails were rescheduled into later hours. Nothing was dropped.' }],
      },
    ],
  };
}

/**
 * Fired whenever a send is deferred by an hourly limit. Many jobs hit the same limit
 * in the same hour, so a Redis SET NX makes sure the user hears about it once per
 * (user, limit, hour), no matter how many workers see it. Details are only loaded
 * for that first event.
 *
 * The Slack connection is looked up at send time, so connecting / disconnecting takes
 * effect immediately (no restart). Not connected = silently skipped.
 * Never throws: a notification problem must not affect sending.
 */
export async function notifyRateLimitHit(event: RateLimitHitEvent): Promise<void> {
  try {
    const scopeId = event.scope === 'sender' ? event.senderId : event.campaignId;
    const key = `notified:rate-limit:${event.userId}:${event.scope}:${scopeId}:${hourKey(event.windowStart.getTime())}`;
    const first = await redis.set(key, '1', 'EX', 2 * 60 * 60, 'NX');
    if (!first) return;

    const email = await prisma.email.findUnique({
      where: { id: event.emailId },
      select: { sender: { select: { email: true } }, campaign: { select: { subject: true } } },
    });
    const senderEmail = email?.sender.email ?? 'unknown sender';
    const campaignSubject = email?.campaign.subject ?? 'unknown campaign';

    logger.warn(
      { userId: event.userId, scope: event.scope, limit: event.limit, sender: senderEmail, resumeAt: event.resumeAt },
      'hourly rate limit reached; deferring remaining emails to later hours',
    );
    const delivered = await notifyUserOnSlack(event.userId, rateLimitMessage(event, senderEmail, campaignSubject));
    logger.info({ userId: event.userId, delivered }, delivered ? 'slack rate-limit alert sent' : 'slack not connected; alert skipped');
  } catch (err) {
    logger.error({ err }, 'rate-limit notification failed');
  }
}
