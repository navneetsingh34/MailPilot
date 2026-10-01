import { redis } from '../lib/redis';
import { HOUR_MS, hourWindowStart } from './schedulePlanner';

/** Counters outlive their hour a little so late-arriving workers still see them. */
const COUNTER_TTL_SECONDS = 2 * 60 * 60;

/** e.g. 2026100214 — the UTC clock hour a timestamp falls in. */
export const hourKey = (ms: number) => new Date(hourWindowStart(ms)).toISOString().slice(0, 13).replace(/\D/g, '');

/**
 * Atomically checks BOTH hourly limits and, only if both have room, counts the send
 * against both. Running as one Lua script makes check+increment indivisible, so any
 * number of workers / processes can call it concurrently without overshooting.
 * Returns 0 = reserved, 1 = sender limit hit, 2 = campaign limit hit.
 */
const RESERVE_HOURLY = `
local senderCount = tonumber(redis.call('GET', KEYS[1]) or '0')
if senderCount >= tonumber(ARGV[1]) then return 1 end
local campaignCount = tonumber(redis.call('GET', KEYS[2]) or '0')
if campaignCount >= tonumber(ARGV[2]) then return 2 end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[3])
redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], ARGV[3])
return 0
`;

/**
 * Per-sender "next free send time". Returns how long the caller must wait before
 * sending, and pushes the next slot forward by `gap`. Uses the Redis clock so
 * workers on different machines agree.
 */
const RESERVE_SEND_SLOT = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local gap = tonumber(ARGV[1])
local nextFree = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot = math.max(now, nextFree)
redis.call('SET', KEYS[1], slot + gap, 'PX', gap + 60000)
return slot - now
`;

/** After a send completes: the sender's next slot is at least `gap` from *now*. */
const FINISH_SEND = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local gap = tonumber(ARGV[1])
local nextFree = tonumber(redis.call('GET', KEYS[1]) or '0')
redis.call('SET', KEYS[1], math.max(nextFree, now + gap), 'PX', gap + 60000)
return 1
`;

/** Pure part of `deferral`: time for the n-th (0-based) email deferred into `nextWindow`. */
export function deferredSlotTime(nextWindow: number, n: number, limit: number, gapMs: number): number {
  // Keep one hour's worth of slots inside that hour even when limit * gap > 1h.
  const spacing = Math.min(gapMs, Math.floor(HOUR_MS / limit));
  return nextWindow + Math.floor(n / limit) * HOUR_MS + (n % limit) * spacing;
}

export type LimitScope = 'sender' | 'campaign';

export type HourlyReservation =
  | { ok: true }
  | { ok: false; scope: LimitScope; limit: number; windowStart: Date; resumeAt: Date };

export interface HourlyLimits {
  senderId: string;
  senderLimit: number;
  campaignId: string;
  campaignLimit: number;
  /** Spacing applied to emails pushed into the next window, to keep their order. */
  gapMs: number;
}

export async function reserveHourlySlot(l: HourlyLimits, now = Date.now()): Promise<HourlyReservation> {
  const hour = hourKey(now);
  const result = Number(
    await redis.eval(
      RESERVE_HOURLY,
      2,
      `rl:sender:${l.senderId}:${hour}`,
      `rl:campaign:${l.campaignId}:${hour}`,
      l.senderLimit,
      l.campaignLimit,
      COUNTER_TTL_SECONDS,
    ),
  );
  if (result === 0) return { ok: true };
  return deferral(l, result === 1 ? 'sender' : 'campaign', now);
}

/**
 * Cheap, non-reserving check: is either hourly limit already used up? Lets the worker
 * reschedule an email without claiming or loading it (the common case when a big
 * campaign overflows). A "no" here is re-checked atomically by reserveHourlySlot.
 */
export async function fullHourScope(l: HourlyLimits, now = Date.now()): Promise<LimitScope | null> {
  const hour = hourKey(now);
  const [sent, campaign] = await redis.mget(`rl:sender:${l.senderId}:${hour}`, `rl:campaign:${l.campaignId}:${hour}`);
  if (Number(sent ?? 0) >= l.senderLimit) return 'sender';
  if (Number(campaign ?? 0) >= l.campaignLimit) return 'campaign';
  return null;
}

/**
 * Where an email that hit `scope`'s limit should go. The n-th email deferred out of this
 * hour lands in hour `next + floor(n / limit)` at slot `n % limit`, i.e. deferred emails
 * are spread over as many future hours as they need, in the order they hit the limit
 * (their original due order) — instead of all piling into the next hour and being
 * re-deferred again and again.
 */
export async function deferral(l: HourlyLimits, scope: LimitScope, now = Date.now()): Promise<HourlyReservation & { ok: false }> {
  const limit = scope === 'sender' ? l.senderLimit : l.campaignLimit;
  const windowStart = hourWindowStart(now);
  const nextWindow = windowStart + HOUR_MS;
  const seqKey = `rl:defer-seq:${scope}:${scope === 'sender' ? l.senderId : l.campaignId}:${hourKey(nextWindow)}`;
  const [[, seq]] = (await redis.multi().incr(seqKey).expire(seqKey, COUNTER_TTL_SECONDS).exec()) as [
    [Error | null, number],
  ];
  return {
    ok: false,
    scope,
    limit,
    windowStart: new Date(windowStart),
    resumeAt: new Date(deferredSlotTime(nextWindow, seq - 1, limit, l.gapMs)),
  };
}

/** Milliseconds to wait before this sender may send again (0 = go now). */
export async function reserveSendSlot(senderId: string, gapMs: number): Promise<number> {
  if (gapMs <= 0) return 0;
  return Number(await redis.eval(RESERVE_SEND_SLOT, 1, `send-slot:${senderId}`, gapMs));
}

/** Measures the gap from the end of a (possibly slow) SMTP send, not just its start. */
export async function finishSendSlot(senderId: string, gapMs: number): Promise<void> {
  if (gapMs <= 0) return;
  await redis.eval(FINISH_SEND, 1, `send-slot:${senderId}`, gapMs);
}
