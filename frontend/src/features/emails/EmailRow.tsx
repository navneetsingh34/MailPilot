import { Link } from 'react-router-dom';
import { formatScheduleTime } from '@/lib/format';
import type { EmailListItem, MailboxTab } from '@/types/api';
import { StarButton } from './StarButton';
import { StatusBadge } from './StatusBadge';

/**
 * Desktop: one 42px line (recipient · badge · subject + preview · time · star).
 * Mobile: two lines (recipient + badge, then subject + preview) so nothing is cut to nothing.
 */
export function EmailRow({ email, tab }: { email: EmailListItem; tab: MailboxTab }) {
  const finishedAt = email.sentAt ?? email.failedAt;
  const finishedTime = tab === 'sent' && finishedAt && (
    <time dateTime={finishedAt} className="shrink-0 text-xs text-muted" title={email.error ?? undefined}>
      {formatScheduleTime(finishedAt)}
    </time>
  );

  return (
    <Link
      to={`/emails/${email.id}`}
      className="group flex items-start gap-3 border-b border-line px-4 py-3 text-[13px] transition hover:bg-[#fafafa] md:h-[42px] md:items-center md:py-0"
    >
      <div className="min-w-0 flex-1 md:flex md:items-center md:gap-3">
        {/* On desktop this wrapper dissolves (md:contents) and its children join the row. */}
        <div className="flex items-center gap-2 md:contents">
          <span className="min-w-0 flex-1 truncate font-medium md:w-[150px] md:flex-none" title={email.recipient}>
            To: {email.recipient}
          </span>
          <StatusBadge email={email} />
          {finishedTime && <span className="md:hidden">{finishedTime}</span>}
        </div>
        <span className="mt-1 block truncate md:mt-0 md:min-w-0 md:flex-1">
          <span className="font-medium">{email.subject}</span>
          {email.preview && <span className="text-muted"> - {email.preview}</span>}
        </span>
      </div>
      {finishedTime && <span className="hidden md:inline">{finishedTime}</span>}
      <StarButton id={email.id} starred={email.starred} className="-mt-1 md:mt-0" />
    </Link>
  );
}
