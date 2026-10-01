import clsx from 'clsx';

interface SpinnerProps {
  className?: string;
  /** 'current' follows the text colour (e.g. inside a button). */
  tone?: 'brand' | 'current';
}

export function Spinner({ className, tone = 'brand' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={clsx(
        'inline-block animate-spin rounded-full border-2',
        tone === 'brand' ? 'border-brand/25 border-t-brand' : 'border-current/30 border-t-current',
        className ?? 'size-5',
      )}
    />
  );
}
