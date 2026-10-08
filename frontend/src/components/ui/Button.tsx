import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'outline' | 'ghost' | 'soft';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:brightness-110',
  outline: 'border border-brand text-brand bg-white hover:bg-brand-soft',
  soft: 'bg-brand-soft text-ink hover:brightness-95',
  ghost: 'text-ink hover:bg-surface',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-4 text-[13px]',
  md: 'h-9 px-5 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Fully rounded pill (the Compose / Send buttons) */
  pill?: boolean;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  pill,
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
        pill ? 'rounded-full' : 'rounded-lg',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner tone="current" className="size-3.5" />}
      {children}
    </button>
  );
}
