import { describe, expect, it, vi } from 'vitest';
import { deferredSlotTime, hourKey } from './rateLimiter';
import { HOUR_MS } from './schedulePlanner';

// rateLimiter opens a Redis connection on import; these tests only cover pure helpers.
// (vi.mock is hoisted above the imports.)
vi.mock('../lib/redis', () => ({ redis: {} }));

const next = Date.UTC(2026, 9, 2, 11); // 11:00 UTC

describe('deferredSlotTime', () => {
  it('queues the first `limit` deferred emails inside the next hour, gap apart', () => {
    expect([0, 1, 2].map((n) => deferredSlotTime(next, n, 10, 2000) - next)).toEqual([0, 2000, 4000]);
  });

  it('spreads overflow across later hours in order instead of piling into one', () => {
    const times = Array.from({ length: 35 }, (_, n) => deferredSlotTime(next, n, 10, 2000));
    const perHour = new Map<number, number>();
    for (const t of times) {
      const h = Math.floor((t - next) / HOUR_MS);
      perHour.set(h, (perHour.get(h) ?? 0) + 1);
    }
    expect([...perHour.entries()]).toEqual([
      [0, 10],
      [1, 10],
      [2, 10],
      [3, 5],
    ]);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  });

  it('keeps a full hour of slots inside the hour when limit * gap > 1h', () => {
    const last = deferredSlotTime(next, 9_999, 10_000, 2000);
    expect(last).toBeLessThan(next + HOUR_MS);
  });
});

describe('hourKey', () => {
  it('names the UTC clock hour', () => {
    expect(hourKey(Date.UTC(2026, 9, 2, 14, 59, 59))).toBe('2026100214');
  });
});
