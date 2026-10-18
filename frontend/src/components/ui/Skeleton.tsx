import clsx from 'clsx';
import type { CSSProperties } from 'react';

/** Placeholder block with a shimmer. Size and shape come from `className` (e.g. "h-3 w-24 rounded"). */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={clsx('skeleton block rounded', className)} style={style} />;
}
