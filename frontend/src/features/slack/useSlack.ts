import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { currentUserKey } from '@/features/auth/useCurrentUser';

/** Full-page navigation: the backend redirects to Slack's OAuth consent screen. */
export const SLACK_CONNECT_URL = '/api/slack/connect';

export function useDisconnectSlack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<null>('/slack', { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Slack disconnected');
      void queryClient.invalidateQueries({ queryKey: currentUserKey });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useSendSlackTest() {
  return useMutation({
    mutationFn: () => api<{ delivered: boolean }>('/slack/test', { method: 'POST' }),
    onSuccess: () => toast.success('Test message sent to Slack'),
    onError: (err) => toast.error(err.message),
  });
}

/** Shows the result of the Slack OAuth round-trip (`?slack=connected|error`) once, then cleans the URL. */
export function useSlackCallbackToast() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  useEffect(() => {
    const status = params.get('slack');
    if (!status) return;
    if (status === 'connected') {
      toast.success('Slack connected', { id: 'slack-callback' });
      void queryClient.invalidateQueries({ queryKey: currentUserKey });
    } else {
      toast.error(params.get('message') ?? 'Slack connection failed', { id: 'slack-callback' });
    }
    setParams({}, { replace: true });
  }, [params, setParams, queryClient]);
}
