import { ChevronDown, ExternalLink, LogOut, MessageSquare, Send, Unplug } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { MenuItem, Popover } from '@/components/ui/Popover';
import { useLogout } from '@/features/auth/useCurrentUser';
import { SLACK_CONNECT_URL, useDisconnectSlack, useSendSlackTest } from '@/features/slack/useSlack';
import type { CurrentUser } from '@/types/api';

export function UserMenu({ user }: { user: CurrentUser }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const logout = useLogout();
  const disconnectSlack = useDisconnectSlack();
  const sendTest = useSendSlackTest();
  const close = () => setOpen(false);

  return (
    <Popover
      open={open}
      onClose={close}
      className="w-64 p-1.5"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-2.5 rounded-xl bg-surface px-2.5 py-2.5 text-left transition hover:brightness-[0.98]"
        >
          <Avatar name={user.name} src={user.avatarUrl} className="size-7 text-xs" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{user.name}</span>
            <span className="block truncate text-[10px] text-muted">{user.email}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>
      }
    >
      <div className="border-b border-line px-3 pt-1.5 pb-2.5">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Slack alerts</p>
        <p className="mt-0.5 text-[13px]">
          {user.slack.connected ? (
            <>
              <span className="mr-1.5 inline-block size-2 rounded-full bg-brand" />
              {user.slack.teamName} · {user.slack.channel}
            </>
          ) : (
            <span className="text-muted">Not connected</span>
          )}
        </p>
      </div>
      <div className="py-1">
        {user.slack.connected ? (
          <>
            <MenuItem icon={<Send className="size-4" />} onClick={() => sendTest.mutate()} disabled={sendTest.isPending}>
              Send test alert
            </MenuItem>
            <MenuItem
              icon={<Unplug className="size-4" />}
              onClick={() => disconnectSlack.mutate(undefined, { onSuccess: close })}
              disabled={disconnectSlack.isPending}
              danger
            >
              Disconnect Slack
            </MenuItem>
          </>
        ) : (
          <MenuItem icon={<MessageSquare className="size-4" />} href={SLACK_CONNECT_URL}>
            Connect Slack
          </MenuItem>
        )}
        <MenuItem icon={<ExternalLink className="size-4" />} href="/api/admin/queues" external>
          Queue dashboard
        </MenuItem>
      </div>
      <div className="border-t border-line pt-1">
        <MenuItem
          icon={<LogOut className="size-4" />}
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })}
        >
          Logout
        </MenuItem>
      </div>
    </Popover>
  );
}
