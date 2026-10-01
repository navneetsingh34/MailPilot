import { describe, expect, it } from 'vitest';
import { HOUR_MS, hourWindowStart, planSchedule } from './schedulePlanner';

const start = new Date('2026-10-02T10:00:00.000Z');

describe('planSchedule', () => {
  it('spaces emails by the delay', () => {
    const times = planSchedule({ count: 3, startAt: start, delayMs: 2000, hourlyLimit: 100 });
    expect(times.map((t) => t.getTime() - start.getTime())).toEqual([0, 2000, 4000]);
  });

  it('rolls overflow into the next hour window, preserving order', () => {
    const times = planSchedule({ count: 5, startAt: start, delayMs: 1000, hourlyLimit: 2 });
    const offsets = times.map((t) => t.getTime() - start.getTime());
    expect(offsets).toEqual([0, 1000, HOUR_MS, HOUR_MS + 1000, 2 * HOUR_MS]);
  });

  it('never exceeds the hourly limit in any clock-hour window (1000 emails)', () => {
    const times = planSchedule({
      count: 1000,
      startAt: new Date('2026-10-02T10:37:12.000Z'),
      delayMs: 500,
      hourlyLimit: 200,
    });
    const perWindow = new Map<number, number>();
    for (const t of times) {
      const w = hourWindowStart(t.getTime());
      perWindow.set(w, (perWindow.get(w) ?? 0) + 1);
    }
    expect(Math.max(...perWindow.values())).toBeLessThanOrEqual(200);
    for (let i = 1; i < times.length; i++) expect(times[i].getTime()).toBeGreaterThan(times[i - 1].getTime());
  });

  it('resets the window count when the delay alone crosses into a new hour', () => {
    const times = planSchedule({ count: 3, startAt: new Date('2026-10-02T10:59:59.000Z'), delayMs: 2000, hourlyLimit: 1 });
    expect(times.map((t) => t.toISOString())).toEqual([
      '2026-10-02T10:59:59.000Z',
      '2026-10-02T11:00:01.000Z',
      '2026-10-02T12:00:00.000Z',
    ]);
  });
});
