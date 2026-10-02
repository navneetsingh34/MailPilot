import { Menu, PenSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { IconButton } from '@/components/ui/IconButton';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useSlackCallbackToast } from '@/features/slack/useSlack';
import { Logo } from './Logo';
import { Sidebar } from './Sidebar';

/**
 * Sidebar + mailbox content. Rendered inside RequireAuth, so the user is loaded.
 * Desktop: fixed sidebar. Mobile: top bar with a menu button that opens the sidebar as a drawer.
 */
export function AppLayout() {
  const { data: user } = useCurrentUser();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  useSlackCallbackToast();

  // Close the drawer after navigating, and on Escape.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  if (!user) return null;

  return (
    <div className="flex h-full">
      <Sidebar user={user} className="hidden w-[200px] md:flex" />

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <Sidebar user={user} className="relative flex h-full w-[260px] bg-white shadow-xl" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line px-2 py-2 md:hidden">
          <IconButton label="Open menu" onClick={() => setDrawerOpen(true)}>
            <Menu className="size-5 text-ink" />
          </IconButton>
          <Link to="/scheduled" className="flex-1">
            <Logo />
          </Link>
          <Link
            to="/compose"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-brand px-3 text-[13px] font-medium text-brand"
          >
            <PenSquare className="size-3.5" />
            Compose
          </Link>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
