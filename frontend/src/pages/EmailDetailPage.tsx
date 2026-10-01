import { AlertCircle, ArrowLeft, ExternalLink, FileText, Info } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { attachmentUrl, useEmail } from '@/features/emails/api';
import { StarButton } from '@/features/emails/StarButton';
import { StatusBadge } from '@/features/emails/StatusBadge';
import { formatBytes, formatDateTime } from '@/lib/format';
import type { EmailDetail } from '@/types/api';

function StatusNote({ email }: { email: EmailDetail }) {
  const text = {
    SCHEDULED: `Scheduled to send ${formatDateTime(email.scheduledAt)}${
      email.deferrals > 0 ? ` · moved ${email.deferrals}× by the hourly limit` : ''
    }`,
    SENDING: 'Sending now…',
    SENT: `Sent ${formatDateTime(email.sentAt ?? email.scheduledAt)}`,
    FAILED: `Failed ${email.failedAt ? formatDateTime(email.failedAt) : ''}${email.error ? ` · ${email.error}` : ''}`,
  }[email.status];

  return (
    <div
      className={`mb-6 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
        email.status === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-surface text-muted'
      }`}
    >
      {email.status === 'FAILED' ? <AlertCircle className="size-3.5 shrink-0" /> : <Info className="size-3.5 shrink-0" />}
      <span className="flex-1">{text}</span>
      {email.previewUrl && (
        <a href={email.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
          View on Ethereal <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}

function Attachments({ email }: { email: EmailDetail }) {
  if (email.attachments.length === 0) return null;
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {email.attachments.map((a) => (
        <a
          key={a.id}
          href={attachmentUrl(email.id, a.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-[158px] overflow-hidden rounded-xl border border-line bg-[#fafafa] transition hover:shadow-sm"
        >
          {a.mimeType.startsWith('image/') ? (
            <img src={attachmentUrl(email.id, a.id)} alt="" className="h-[88px] w-full object-cover" />
          ) : (
            <div className="flex h-[88px] items-center justify-center text-muted">
              <FileText className="size-8" />
            </div>
          )}
          <div className="px-2.5 py-2">
            <p className="truncate text-xs font-medium">{a.filename}</p>
            <p className="text-[10px] text-muted">{formatBytes(a.size)}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

export default function EmailDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const { data: email, isLoading, error, refetch } = useEmail(id);
  const backTo = email && ['SENT', 'FAILED'].includes(email.status) ? '/sent' : '/scheduled';

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <IconButton label="Back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(backTo))}>
          <ArrowLeft className="size-5 text-ink" />
        </IconButton>
        <h1 className="min-w-0 flex-1 truncate text-xl">{email?.subject ?? ''}</h1>
        {email && (
          <>
            <StatusBadge email={email} />
            <StarButton id={email.id} starred={email.starred} />
          </>
        )}
        <span className="mx-1 h-6 w-px bg-line" />
        {user && <Avatar name={user.name} src={user.avatarUrl} className="size-8 text-sm" />}
      </header>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-24">
            <Spinner />
          </div>
        ) : error || !email ? (
          <EmptyState
            icon={<AlertCircle className="size-5" />}
            title="Couldn't load this email"
            description={error?.message}
            action={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" pill onClick={() => void refetch()}>
                  Try again
                </Button>
                <Link to="/scheduled" className="inline-flex h-8 items-center rounded-full px-4 text-[13px] text-muted hover:bg-surface">
                  Back to inbox
                </Link>
              </div>
            }
          />
        ) : (
          <article className="mx-auto max-w-[820px] px-6 py-6">
            <div className="mb-5 flex items-start gap-3">
              <Avatar name={email.sender.name} className="size-9 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{email.sender.name}</span>{' '}
                  <span className="text-xs text-muted">&lt;{email.sender.email}&gt;</span>
                </p>
                <p className="text-xs text-muted">to {email.recipient}</p>
              </div>
              <time className="shrink-0 text-xs text-muted" dateTime={email.sentAt ?? email.scheduledAt}>
                {formatDateTime(email.sentAt ?? email.scheduledAt)}
              </time>
            </div>
            <div className="pl-12">
              <StatusNote email={email} />
              {/* Body HTML is sanitized by the backend when the campaign is created. */}
              <div className="email-body" dangerouslySetInnerHTML={{ __html: email.bodyHtml }} />
              <Attachments email={email} />
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
