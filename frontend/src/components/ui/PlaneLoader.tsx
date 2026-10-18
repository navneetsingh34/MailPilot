import clsx from 'clsx';
import { Send } from 'lucide-react';

/** Inline "sending" indicator for buttons and small spots: a paper plane that keeps taking off. */
export function PlaneLoader({ className }: { className?: string }) {
  return (
    <span role="status" aria-label="Loading" className={clsx('inline-flex', className ?? 'size-3.5')}>
      <Send className="size-full motion-safe:animate-plane" aria-hidden />
    </span>
  );
}
