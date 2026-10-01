import { env } from '../config/env';
import { prisma } from '../lib/prisma';

const SENDER_TTL_MS = 60_000;
const MAX_CAMPAIGNS = 5000;

const senderLimits = new Map<string, { limit: number; expires: number }>();
// A campaign's hourly limit never changes after creation, so it can be cached freely.
const campaignLimits = new Map<string, number>();

/** Effective hourly limit for a sender (its own override, else the global default). */
export async function senderHourlyLimit(senderId: string): Promise<number> {
  const hit = senderLimits.get(senderId);
  if (hit && hit.expires > Date.now()) return hit.limit;
  const sender = await prisma.sender.findUnique({ where: { id: senderId }, select: { hourlyLimit: true } });
  const limit = sender?.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER;
  senderLimits.set(senderId, { limit, expires: Date.now() + SENDER_TTL_MS });
  return limit;
}

export async function campaignHourlyLimit(campaignId: string): Promise<number | null> {
  const hit = campaignLimits.get(campaignId);
  if (hit !== undefined) return hit;
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { hourlyLimit: true } });
  if (!campaign) return null;
  if (campaignLimits.size >= MAX_CAMPAIGNS) campaignLimits.clear();
  campaignLimits.set(campaignId, campaign.hourlyLimit);
  return campaign.hourlyLimit;
}
