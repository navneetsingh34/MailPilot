import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { emailKeys } from '@/features/emails/api';
import type { CreateCampaignPayload, CreateCampaignResult, Sender } from '@/types/api';

export function useSenders() {
  return useQuery({ queryKey: ['senders'], queryFn: () => api<Sender[]>('/senders'), staleTime: 5 * 60 * 1000 });
}

export function useScheduleCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCampaignPayload) =>
      api<CreateCampaignResult>('/campaigns', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: emailKeys.all }),
  });
}
