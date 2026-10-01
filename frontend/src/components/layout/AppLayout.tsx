import { Outlet } from 'react-router-dom';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useSlackCallbackToast } from '@/features/slack/useSlack';
import { Sidebar } from './Sidebar';

/** Sidebar + mailbox content. Rendered inside RequireAuth, so the user is loaded. */
export function AppLayout() {
  const { data: user } = useCurrentUser();
  useSlackCallbackToast();
  if (!user) return null;

  return (
    <div className="flex h-full">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
