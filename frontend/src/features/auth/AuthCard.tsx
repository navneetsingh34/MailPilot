import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { PlaneLoader } from '@/components/ui/PlaneLoader';
import { ColdStartNote } from '@/components/ui/ServerWaking';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export const authInputClass =
  'h-10 w-full rounded-lg bg-surface px-4 text-xs outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/30';

export const authSubmitClass =
  'mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100';

/** Submit button label: swaps to a flying paper plane + `pendingLabel` while the request runs. */
export function SubmitLabel({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  if (!pending) return <>{label}</>;
  return (
    <>
      <PlaneLoader />
      {pendingLabel}
    </>
  );
}

/**
 * Shared shell of the login and signup pages: title, Google button, divider, then the form.
 * `error` is shown inside the card, right above the form, rather than as a toast.
 */
export function AuthCard({
  title,
  googleLabel,
  divider,
  error,
  footer,
  children,
}: {
  title: string;
  googleLabel: string;
  divider: string;
  error?: string | null;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-white p-4">
      <div className="w-full max-w-[370px] rounded-xl border border-line px-11 py-10 motion-safe:animate-fade-up">
        <h1 className="text-center text-[28px] font-bold">{title}</h1>

        <a
          href="/api/auth/google"
          className="mt-5 flex h-9 w-full items-center justify-center gap-2.5 rounded-lg bg-brand-soft text-sm font-medium transition hover:brightness-95"
        >
          <GoogleIcon />
          {googleLabel}
        </a>

        <div className="my-6 flex items-center gap-3 text-[11px] text-muted">
          <span className="h-px flex-1 bg-line" />
          {divider}
          <span className="h-px flex-1 bg-line" />
        </div>

        {error && (
          <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700 motion-safe:animate-shake">
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {children}

        <p className="mt-5 text-center text-xs text-muted">{footer}</p>
      </div>
      <ColdStartNote />
    </div>
  );
}
