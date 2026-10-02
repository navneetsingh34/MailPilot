import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Spinner } from './Spinner';

/** The deployed backend runs on Render's free plan, which sleeps when idle. */
export const SHOW_COLD_START_HINTS = import.meta.env.PROD;

const COLD_START_COPY =
  'The backend is hosted on Render’s free plan, which sleeps when idle. The first request can take 1–2 minutes while it wakes up.';

/** Full-screen loader that explains a slow first load once it has taken more than a few seconds. */
export function ServerWakingScreen() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <Spinner />
      {slow && SHOW_COLD_START_HINTS && (
        <div className="max-w-sm">
          <p className="font-medium">Waking up the server…</p>
          <p className="mt-1 text-sm text-muted">{COLD_START_COPY} This page continues on its own.</p>
        </div>
      )}
    </div>
  );
}

/** Small persistent note (login page). */
export function ColdStartNote() {
  if (!SHOW_COLD_START_HINTS) return null;
  return (
    <p className="mt-4 flex max-w-[370px] items-start gap-2 rounded-lg bg-surface px-3 py-2.5 text-xs text-muted">
      <Info className="mt-px size-3.5 shrink-0" />
      <span>{COLD_START_COPY}</span>
    </p>
  );
}
