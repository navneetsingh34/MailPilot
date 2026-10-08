import clsx from 'clsx';
import { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string | null;
  className?: string;
}

/** Image avatar that falls back to a green initial circle (the sender avatar). */
export function Avatar({ name, src, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const classes = clsx('size-8 shrink-0 rounded-full', className);

  if (src && !failed) {
    return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={clsx(classes, 'object-cover')} />;
  }
  return (
    <span aria-hidden className={clsx(classes, 'flex items-center justify-center bg-brand font-medium text-white')}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
