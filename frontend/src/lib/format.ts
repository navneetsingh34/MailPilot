const weekdayTime = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});
const fullDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fullDateYear = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Tue 9:15:12 AM" within a week either side of now, otherwise "Nov 3, 10:23 AM". */
export function formatScheduleTime(iso: string): string {
  const d = new Date(iso);
  return Math.abs(d.getTime() - Date.now()) < 6 * DAY_MS ? weekdayTime.format(d) : formatDateTime(iso);
}

/** "Nov 3, 10:23 AM" (adds the year when it isn't the current one). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return (d.getFullYear() === new Date().getFullYear() ? fullDate : fullDateYear).format(d);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const pluralize = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** Value for an <input type="datetime-local"> in the user's timezone. */
export function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
