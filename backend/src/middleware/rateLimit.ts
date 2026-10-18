import type { RequestHandler } from 'express';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';
import { redis } from '../lib/redis';

/**
 * Token bucket in one Lua script so refill + take is atomic across API instances. Uses the
 * Redis clock, so instances with skewed clocks still agree.
 *
 * KEYS[1] = bucket hash, ARGV[1] = capacity, ARGV[2] = tokens refilled per millisecond.
 * Returns { allowed (0/1), tokens left (floored), ms until the next token }.
 */
const TAKE_TOKEN = `
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)

local state = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(state[1]) or capacity
local ts = tonumber(state[2]) or now
tokens = math.min(capacity, tokens + math.max(0, now - ts) * rate)

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', now)
-- An idle bucket is full again after capacity / rate ms; nothing to keep after that
redis.call('PEXPIRE', KEYS[1], math.ceil(capacity / rate))

local wait = 0
if tokens < 1 then wait = math.ceil((1 - tokens) / rate) end
return { allowed, math.floor(tokens), wait }
`;

/**
 * Per-IP token bucket: up to `capacity` requests in a burst, refilled at `perMinute` tokens a
 * minute. If Redis is unreachable the request is let through: a limiter outage shouldn't lock
 * users out.
 */
export function tokenBucket({ name, perMinute, capacity = perMinute }: { name: string; perMinute: number; capacity?: number }): RequestHandler {
  const ratePerMs = perMinute / 60_000;
  return async (req, res, next) => {
    let allowed: number, remaining: number, waitMs: number;
    try {
      [allowed, remaining, waitMs] = (await redis.eval(
        TAKE_TOKEN,
        1,
        `bucket:${name}:${req.ip ?? 'unknown'}`,
        capacity,
        ratePerMs,
      )) as [number, number, number];
    } catch (err) {
      logger.warn({ err, name }, 'rate limiter unavailable, allowing request');
      return next();
    }

    res.setHeader('RateLimit-Limit', capacity);
    res.setHeader('RateLimit-Remaining', remaining);
    if (!allowed) {
      res.setHeader('Retry-After', Math.ceil(waitMs / 1000));
      throw new HttpError(429, 'Too many requests, please slow down and try again shortly');
    }
    next();
  };
}
