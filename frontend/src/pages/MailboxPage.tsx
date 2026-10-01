import { useQueryClient } from '@tanstack/react-query';
import { Clock, SearchX, Send } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { emailKeys, useEmailList, useEmailSearch } from '@/features/emails/api';
import { EmailList } from '@/features/emails/EmailList';
import { MailboxToolbar } from '@/features/emails/MailboxToolbar';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import type { EmailFilter, MailboxTab } from '@/types/api';

const EMPTY_COPY: Record<MailboxTab, { title: string; description: string; icon: typeof Clock }> = {
  scheduled: {
    title: 'No scheduled emails',
    description: 'Emails you schedule will wait here until they are sent.',
    icon: Clock,
  },
  sent: {
    title: 'No sent emails yet',
    description: 'Once scheduled emails go out, they show up here with their delivery status.',
    icon: Send,
  },
};

export default function MailboxPage({ tab }: { tab: MailboxTab }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<EmailFilter>('all');
  const q = useDebouncedValue(search.trim());
  const searching = q.length > 0;
  const queryClient = useQueryClient();

  const list = useEmailList(tab, filter, !searching);
  const results = useEmailSearch(q, tab, filter);

  const emails = searching ? (results.data?.items ?? []) : (list.data?.pages.flatMap((p) => p.items) ?? []);
  const active = searching ? results : list;
  const { title, description, icon: Icon } = EMPTY_COPY[tab];

  const empty = searching ? (
    <EmptyState icon={<SearchX className="size-5" />} title={`No results for “${q}”`} description="Try a different email address, subject or word from the body." />
  ) : filter !== 'all' ? (
    <EmptyState icon={<Icon className="size-5" />} title="Nothing matches this filter" description="Switch the filter back to “All emails” to see everything." />
  ) : (
    <EmptyState
      icon={<Icon className="size-5" />}
      title={title}
      description={description}
      action={
        <Link to="/compose" className="rounded-full border border-brand px-5 py-2 text-[13px] font-medium text-brand hover:bg-brand-soft">
          Compose new email
        </Link>
      }
    />
  );

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white">
        <MailboxToolbar
          tab={tab}
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          refreshing={active.isFetching}
          onRefresh={() => void queryClient.invalidateQueries({ queryKey: emailKeys.all })}
        />
        {searching && results.data && (
          <p className="px-5 pb-2 text-xs text-muted">
            {results.data.total.toLocaleString()} result{results.data.total === 1 ? '' : 's'}
          </p>
        )}
      </div>
      <EmailList
        tab={tab}
        emails={emails}
        isLoading={searching ? results.isLoading : list.isLoading}
        error={active.error}
        onRetry={() => void active.refetch()}
        empty={empty}
        hasMore={!searching && list.hasNextPage}
        loadingMore={list.isFetchingNextPage}
        onLoadMore={() => void list.fetchNextPage()}
      />
    </div>
  );
}
