import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ServerWakingScreen } from '@/components/ui/ServerWaking';
import { useCurrentUser } from './useCurrentUser';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();
  if (isLoading) return <ServerWakingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Keeps logged-in users away from /login. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();
  if (isLoading) return <ServerWakingScreen />;
  if (user) return <Navigate to="/scheduled" replace />;
  return <>{children}</>;
}
