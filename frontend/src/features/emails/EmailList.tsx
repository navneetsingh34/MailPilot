import { AlertCircle } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import type { EmailListItem, MailboxTab } from '@/types/api';
import { EmailRow } from './EmailRow';

interface EmailListProps {
  tab: MailboxTab;
  emails: EmailListItem[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  empty: ReactNode;
  /** Infinite scroll: called when the bottom of the list scrolls into view. */
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

function SkeletonRows() {
  return (
    <div aria-busy="true" aria-label="Loading emails">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex h-[42px] items-center gap-3 border-b border-line px-4">
          <span className="h-3 w-[130px] animate-pulse rounded bg-surface" />
          <span className="h-4 w-24 animate-pulse rounded bg-surface" />
          <span className="h-3 flex-1 animate-pulse rounded bg-surface" style={{ maxWidth: `${55 - (i % 3) * 10}%` }} />
        </div>
      ))}
    </div>
  );
}

export function EmailList({ tab, emails, isLoading, error, onRetry, empty, hasMore, loadingMore, onLoadMore }: EmailListProps) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore || !sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && onLoadMore(), { rootMargin: '200px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (isLoading) return <SkeletonRows />;
  if (error && emails.length === 0) {
    return (
      <EmptyState
        icon={<AlertCircle className="size-5" />}
        title="Couldn't load emails"
        description={error.message}
        action={
          <Button variant="outline" size="sm" pill onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }
  if (emails.length === 0) return <>{empty}</>;

  return (
    <div>
      {emails.map((email) => (
        <EmailRow key={email.id} email={email} tab={tab} />
      ))}
      {hasMore && (
        <div ref={sentinel} className="flex justify-center py-4">
          {loadingMore && <Spinner />}
        </div>
      )}
    </div>
  );
}
