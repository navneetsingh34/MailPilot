import clsx from 'clsx';

interface MailLoaderProps {
  label?: string;
  className?: string;
}

/**
 * Page-level loader: a letter slides in and out of an envelope. Use <PlaneLoader> for small
 * inline spots (buttons, "loading more"). Animations live in index.css (.mail-loader-*).
 */
export function MailLoader({ label = 'Loading your mailbox', className }: MailLoaderProps) {
  return (
    <div role="status" aria-live="polite" className={clsx('flex flex-col items-center gap-3', className)}>
      <svg viewBox="0 0 64 64" className="size-16 overflow-visible" aria-hidden>
        <ellipse className="mail-loader-shadow" cx="32" cy="60" rx="20" ry="2.5" fill="var(--color-brand)" />
        <g className="mail-loader-bob">
          {/* Envelope back */}
          <rect x="6" y="24" width="52" height="30" rx="4" fill="var(--color-brand-soft)" stroke="var(--color-brand)" strokeWidth="2" />
          {/* Letter */}
          <g className="mail-loader-letter">
            <rect x="14" y="10" width="36" height="30" rx="2.5" fill="white" stroke="var(--color-brand)" strokeWidth="2" />
            <path d="M20 18h18M20 23h24M20 28h14" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
          </g>
          {/* Front pocket, drawn over the letter so it slides behind it */}
          <path
            d="M6 28 L32 44 L58 28 V50 a4 4 0 0 1 -4 4 H10 a4 4 0 0 1 -4 -4 Z"
            fill="white"
            stroke="var(--color-brand)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      <p className="text-sm font-medium text-muted">
        {label}
        <span className="mail-loader-dots" aria-hidden>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
    </div>
  );
}
