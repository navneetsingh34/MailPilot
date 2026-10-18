import clsx from 'clsx';
import { Star } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { useToggleStar } from './api';

export function StarButton({ id, starred, className }: { id: string; starred: boolean; className?: string }) {
  const toggle = useToggleStar();
  // Bumped on each star click; remounting the icon replays the pop
  const [pops, setPops] = useState(0);
  // Optimistic: show the new state while the request is in flight.
  const shown = toggle.isPending ? toggle.variables.starred : starred;

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!shown) setPops((n) => n + 1);
    toggle.mutate({ id, starred: !shown });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={shown ? 'Unstar' : 'Star'}
      aria-pressed={shown}
      className={clsx('rounded p-1 transition hover:bg-surface', className)}
    >
      <Star
        key={pops}
        className={clsx(
          'size-4',
          shown ? 'fill-amber-400 text-amber-400' : 'text-[#c8c8c8]',
          shown && pops > 0 && 'motion-safe:animate-pop',
        )}
      />
    </button>
  );
}
