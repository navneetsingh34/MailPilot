import { AlertCircle } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlaneLoader } from '@/components/ui/PlaneLoader';
import { Skeleton } from '@/components/ui/Skeleton';
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

// Varied widths so the placeholder reads like real mail, not a grid of identical bars
const SKELETON_ROWS = [
  { to: 120, subject: 22, preview: 48 },
  { to: 96, subject: 30, preview: 36 },
  { to: 136, subject: 18, preview: 54 },
  { to: 108, subject: 26, preview: 30 },
  { to: 128, subject: 34, preview: 42 },
  { to: 88, subject: 20, preview: 50 },
  { to: 116, subject: 28, preview: 34 },
  { to: 100, subject: 24, preview: 44 },
  { to: 124, subject: 32, preview: 28 },
  { to: 92, subject: 22, preview: 40 },
];

/** Mirrors EmailRow's layout (one line on desktop, two on mobile) and fades out toward the bottom. */
function SkeletonRows() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading emails">
      {SKELETON_ROWS.map((row, i) => (
        <div
          key={i}
          className="flex items-start gap-3 border-b border-line px-4 py-3 md:h-[42px] md:items-center md:py-0"
          style={{ opacity: 1 - i * 0.08 }}
        >
          <div className="min-w-0 flex-1 md:flex md:items-center md:gap-3">
            <div className="flex items-center gap-2 md:contents">
              <div className="flex-1 md:w-[150px] md:flex-none">
                <Skeleton className="h-3" style={{ width: row.to }} />
              </div>
              <Skeleton className="h-[18px] w-[86px] rounded-full" />
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-2 md:mt-0 md:flex-1">
              <Skeleton className="h-3 shrink-0" style={{ width: `${row.subject}%` }} />
              <Skeleton className="h-3 opacity-60" style={{ width: `${row.preview}%` }} />
            </div>
          </div>
          <Skeleton className="size-4 shrink-0 rounded-sm" />
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
      {/* Rows fade in once when they mount (first load, new pages, newly scheduled mail) */}
      {emails.map((email, i) => (
        <div key={email.id} className="motion-safe:animate-row-in" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
          <EmailRow email={email} tab={tab} />
        </div>
      ))}
      {hasMore && (
        <div ref={sentinel} className="flex justify-center py-4">
          {loadingMore && (
            <span className="flex items-center gap-2 text-xs text-brand">
              <PlaneLoader />
              Loading more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
