import { Link } from 'react-router-dom';
import { formatScheduleTime } from '@/lib/format';
import type { EmailListItem, MailboxTab } from '@/types/api';
import { StarButton } from './StarButton';
import { StatusBadge } from './StatusBadge';

export function EmailRow({ email, tab }: { email: EmailListItem; tab: MailboxTab }) {
  const finishedAt = email.sentAt ?? email.failedAt;

  return (
    <Link
      to={`/emails/${email.id}`}
      className="group flex h-[42px] items-center gap-3 border-b border-line px-4 text-[13px] transition hover:bg-[#fafafa]"
    >
      <span className="w-[150px] shrink-0 truncate font-medium" title={email.recipient}>
        To: {email.recipient}
      </span>
      <StatusBadge email={email} />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{email.subject}</span>
        {email.preview && <span className="text-muted"> - {email.preview}</span>}
      </span>
      {tab === 'sent' && finishedAt && (
        <time dateTime={finishedAt} className="shrink-0 text-xs text-muted" title={email.error ?? undefined}>
          {formatScheduleTime(finishedAt)}
        </time>
      )}
      <StarButton id={email.id} starred={email.starred} />
    </Link>
  );
}
