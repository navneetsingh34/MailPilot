import { randomUUID } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';
import type { CreateCampaignInput } from '../schemas/campaign';
import { planSchedule } from './schedulePlanner';
import { resolveSenders } from './senderService';

const INSERT_CHUNK = 1000;

const sanitizeBody = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'u', 's', 'span']),
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['style'] },
  });

export interface ScheduledEmailRef {
  id: string;
  scheduledAt: Date;
  userId: string;
  senderId: string;
  campaignId: string;
}

export interface CreateCampaignResult {
  campaignId: string;
  scheduledCount: number;
  firstSendAt: Date | null;
  lastSendAt: Date | null;
  /** false when an identical idempotencyKey was already processed */
  created: boolean;
  emails: ScheduledEmailRef[];
}

export async function createCampaign(userId: string, input: CreateCampaignInput): Promise<CreateCampaignResult> {
  if (input.idempotencyKey) {
    const existing = await findByIdempotencyKey(userId, input.idempotencyKey);
    if (existing) return existing;
  }

  const recipients = [...new Set(input.recipients)];
  const senders = await resolveSenders(input.senderId);
  const now = new Date();
  const startAt = input.startAt && input.startAt > now ? input.startAt : now;
  const delayMs = input.delayBetweenSeconds * 1000;
  const sendTimes = planSchedule({ count: recipients.length, startAt, delayMs, hourlyLimit: input.hourlyLimit });

  const campaignId = randomUUID();
  // IDs are generated here (not by the DB) because each one doubles as the BullMQ jobId.
  const emails = recipients.map((recipient, i) => ({
    id: randomUUID(),
    campaignId,
    userId,
    senderId: senders[i % senders.length].id,
    recipient,
    scheduledAt: sendTimes[i],
  }));

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.campaign.create({
          data: {
            id: campaignId,
            userId,
            senderId: input.senderId ?? null,
            idempotencyKey: input.idempotencyKey ?? null,
            subject: input.subject,
            bodyHtml: sanitizeBody(input.bodyHtml),
            startAt,
            delayBetweenMs: delayMs,
            hourlyLimit: input.hourlyLimit,
            totalCount: emails.length,
          },
        });
        for (let i = 0; i < emails.length; i += INSERT_CHUNK) {
          await tx.email.createMany({ data: emails.slice(i, i + INSERT_CHUNK) });
        }
        if (input.attachments.length) {
          await tx.attachment.createMany({
            data: input.attachments.map((a) => {
              const content = Buffer.from(a.contentBase64, 'base64');
              return { campaignId, filename: a.filename, mimeType: a.mimeType, size: content.length, content };
            }),
          });
        }
      },
      // maxWait: a cold process needs ~2s to open its first TLS connection to the DB.
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (err) {
    // Two concurrent submits with the same key: the loser returns the winner's result.
    if (input.idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await findByIdempotencyKey(userId, input.idempotencyKey);
      if (existing) return existing;
    }
    throw err;
  }

  return {
    campaignId,
    scheduledCount: emails.length,
    firstSendAt: sendTimes[0] ?? null,
    lastSendAt: sendTimes.at(-1) ?? null,
    created: true,
    emails: emails.map(({ id, scheduledAt, userId, senderId, campaignId }) => ({ id, scheduledAt, userId, senderId, campaignId })),
  };
}

async function findByIdempotencyKey(userId: string, key: string): Promise<CreateCampaignResult | null> {
  const campaign = await prisma.campaign.findFirst({
    where: { userId, idempotencyKey: key },
    select: {
      id: true,
      emails: {
        select: { id: true, scheduledAt: true, userId: true, senderId: true, campaignId: true },
        orderBy: { scheduledAt: 'asc' },
      },
    },
  });
  if (!campaign) return null;
  return {
    campaignId: campaign.id,
    scheduledCount: campaign.emails.length,
    firstSendAt: campaign.emails[0]?.scheduledAt ?? null,
    lastSendAt: campaign.emails.at(-1)?.scheduledAt ?? null,
    created: false,
    emails: campaign.emails,
  };
}
