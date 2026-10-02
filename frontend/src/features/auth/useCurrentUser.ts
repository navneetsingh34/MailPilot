import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { CurrentUser } from '@/types/api';

export const currentUserKey = ['auth', 'me'] as const;

/** `data === null` means "definitely logged out" (401), as opposed to still loading. */
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserKey,
    queryFn: async () => {
      try {
        return await api<CurrentUser>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    // A sleeping free-tier backend answers with gateway errors (or not at all) for a minute
    // or two while it boots: keep retrying for ~3 minutes instead of giving up.
    retry: (failures, err) => (err instanceof ApiError ? err.status >= 500 : true) && failures < 36,
    retryDelay: 5000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<null>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(currentUserKey, null);
    },
  });
}
