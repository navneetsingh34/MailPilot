import clsx from 'clsx';
import { Clock, Send } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useEmailCounts } from '@/features/emails/api';
import type { CurrentUser } from '@/types/api';
import { Logo } from './Logo';
import { UserMenu } from './UserMenu';

const NAV = [
  { to: '/scheduled', label: 'Scheduled', icon: Clock, countKey: 'scheduled' },
  { to: '/sent', label: 'Sent', icon: Send, countKey: 'sent' },
] as const;

export function Sidebar({ user, className }: { user: CurrentUser; className?: string }) {
  const { data: counts } = useEmailCounts();

  return (
    <aside className={clsx('shrink-0 flex-col gap-3 overflow-y-auto px-2 py-4', className)}>
      <Link to="/scheduled" className="px-2 pb-2">
        <Logo />
      </Link>
      <UserMenu user={user} />
      <Link
        to="/compose"
        className="flex h-9 items-center justify-center rounded-full border border-brand text-[13px] font-medium text-brand transition hover:bg-brand-soft"
      >
        Compose
      </Link>

      <nav aria-label="Mailboxes" className="mt-2">
        <p className="px-3 pb-1.5 text-[10px] font-medium tracking-wide text-muted uppercase">Core</p>
        {NAV.map(({ to, label, icon: Icon, countKey }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'mb-0.5 flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13px] transition',
                isActive ? 'bg-brand-soft font-semibold' : 'hover:bg-surface',
              )
            }
          >
            <Icon className="size-4" />
            <span className="flex-1">{label}</span>
            <span className="text-[11px] font-normal text-muted">{counts ? counts[countKey].toLocaleString() : ''}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
