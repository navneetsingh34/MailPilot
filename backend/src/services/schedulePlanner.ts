export const HOUR_MS = 60 * 60 * 1000;

/** Start of the UTC clock-hour containing `ms`. Same windows the worker's Redis rate limiter uses. */
export const hourWindowStart = (ms: number) => ms - (ms % HOUR_MS);

export interface PlanInput {
  count: number;
  startAt: Date;
  delayMs: number;
  hourlyLimit: number;
}

/**
 * Computes the send time of every email in a campaign up-front:
 *  - consecutive emails are at least `delayMs` apart
 *  - at most `hourlyLimit` emails land in any single clock-hour window;
 *    overflow rolls into the start of the next hour, keeping order.
 *
 * Planning this ahead means the dashboard shows realistic times and the worker's
 * Redis limiter only has to defer jobs when several campaigns compete for one sender.
 */
export function planSchedule({ count, startAt, delayMs, hourlyLimit }: PlanInput): Date[] {
  const times: Date[] = [];
  let t = startAt.getTime();
  let windowStart = hourWindowStart(t);
  let inWindow = 0;

  for (let i = 0; i < count; i++) {
    const ws = hourWindowStart(t);
    if (ws !== windowStart) {
      windowStart = ws;
      inWindow = 0;
    }
    if (inWindow >= hourlyLimit) {
      windowStart += HOUR_MS;
      t = windowStart;
      inWindow = 0;
    }
    times.push(new Date(t));
    inWindow++;
    t += delayMs;
  }
  return times;
}
