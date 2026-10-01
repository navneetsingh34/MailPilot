import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/api/client';
import type {
  EmailCounts,
  EmailDetail,
  EmailFilter,
  EmailPage,
  EmailSearchResult,
  MailboxTab,
} from '@/types/api';

const PAGE_SIZE = 50;

export const emailKeys = {
  all: ['emails'] as const,
  list: (tab: MailboxTab, filter: EmailFilter) => ['emails', 'list', tab, filter] as const,
  search: (q: string, tab: MailboxTab, filter: EmailFilter) => ['emails', 'search', tab, filter, q] as const,
  counts: ['emails', 'counts'] as const,
  detail: (id: string) => ['emails', 'detail', id] as const,
};

/** Scheduled emails change state on their own (worker), so those views poll faster. */
const pollInterval = (tab: MailboxTab) => (tab === 'scheduled' ? 5000 : 10_000);

export function useEmailList(tab: MailboxTab, filter: EmailFilter, enabled = true) {
  return useInfiniteQuery({
    queryKey: emailKeys.list(tab, filter),
    queryFn: ({ pageParam }) =>
      api<EmailPage>(`/emails?${new URLSearchParams({ status: tab, filter, page: String(pageParam), limit: String(PAGE_SIZE) })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    refetchInterval: pollInterval(tab),
    enabled,
  });
}

export function useEmailSearch(q: string, tab: MailboxTab, filter: EmailFilter) {
  return useQuery({
    queryKey: emailKeys.search(q, tab, filter),
    queryFn: () => api<EmailSearchResult>(`/emails/search?${new URLSearchParams({ q, tab, filter, limit: '100' })}`),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
    refetchInterval: pollInterval(tab),
  });
}

export function useEmailCounts() {
  return useQuery({
    queryKey: emailKeys.counts,
    queryFn: () => api<EmailCounts>('/emails/counts'),
    refetchInterval: 5000,
  });
}

export function useEmail(id: string) {
  return useQuery({
    queryKey: emailKeys.detail(id),
    queryFn: () => api<EmailDetail>(`/emails/${id}`),
    // Keep polling until the email reaches a final state.
    refetchInterval: (query) => (['SENT', 'FAILED'].includes(query.state.data?.status ?? '') ? false : 5000),
  });
}

export function useToggleStar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      api<{ id: string; starred: boolean }>(`/emails/${id}/star`, { method: 'PATCH', body: JSON.stringify({ starred }) }),
    onError: (err) => toast.error(err.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: emailKeys.all }),
  });
}

export const attachmentUrl = (emailId: string, attachmentId: string) => `/api/emails/${emailId}/attachments/${attachmentId}`;
