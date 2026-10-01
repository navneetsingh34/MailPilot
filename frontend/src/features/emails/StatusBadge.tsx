import clsx from 'clsx';
import { Clock, Loader2 } from 'lucide-react';
import { formatScheduleTime } from '@/lib/format';
import type { EmailListItem } from '@/types/api';

type BadgeEmail = Pick<EmailListItem, 'status' | 'scheduledAt' | 'deferrals'>;

const base = 'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap';

export function StatusBadge({ email }: { email: BadgeEmail }) {
  switch (email.status) {
    case 'SCHEDULED':
      return (
        <span
          className={clsx(base, 'bg-warn-bg text-warn-text')}
          title={email.deferrals > 0 ? `Moved by the hourly limit (${email.deferrals}×)` : 'Scheduled'}
        >
          <Clock className="size-3" />
          {formatScheduleTime(email.scheduledAt)}
          {email.deferrals > 0 && <span aria-label="rescheduled">↻</span>}
        </span>
      );
    case 'SENDING':
      return (
        <span className={clsx(base, 'bg-brand-soft text-brand')}>
          <Loader2 className="size-3 animate-spin" />
          Sending
        </span>
      );
    case 'SENT':
      return <span className={clsx(base, 'bg-[#efefef] text-[#5b5b5b]')}>Sent</span>;
    case 'FAILED':
      return <span className={clsx(base, 'bg-red-50 text-red-600')}>Failed</span>;
  }
}
