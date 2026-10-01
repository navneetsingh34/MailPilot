import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; also shown as a tooltip. */
  label: string;
  active?: boolean;
  children: ReactNode;
}

export function IconButton({ label, active, className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-ink disabled:opacity-40',
        active && 'bg-surface text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
