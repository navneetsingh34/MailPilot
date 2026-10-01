import clsx from 'clsx';
import { Check, Filter, RotateCw, Search, X } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { MenuItem, Popover } from '@/components/ui/Popover';
import type { EmailFilter, MailboxTab } from '@/types/api';

interface MailboxToolbarProps {
  tab: MailboxTab;
  search: string;
  onSearchChange: (value: string) => void;
  filter: EmailFilter;
  onFilterChange: (filter: EmailFilter) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

const FILTERS: { value: EmailFilter; label: string; tabs: MailboxTab[] }[] = [
  { value: 'all', label: 'All emails', tabs: ['scheduled', 'sent'] },
  { value: 'starred', label: 'Starred', tabs: ['scheduled', 'sent'] },
  { value: 'failed', label: 'Failed only', tabs: ['sent'] },
];

export function MailboxToolbar({ tab, search, onSearchChange, filter, onFilterChange, onRefresh, refreshing }: MailboxToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <label className="flex h-9 flex-1 items-center gap-2 rounded-full bg-surface px-4 focus-within:ring-2 focus-within:ring-brand/25">
        <Search className="size-4 shrink-0 text-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search"
          aria-label={`Search ${tab} emails`}
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <button type="button" onClick={() => onSearchChange('')} aria-label="Clear search" className="text-muted hover:text-ink">
            <X className="size-4" />
          </button>
        )}
      </label>

      <Popover
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        align="right"
        className="w-44 p-1"
        trigger={
          <IconButton label="Filter" active={filter !== 'all'} onClick={() => setFilterOpen((o) => !o)}>
            <Filter className={clsx('size-4', filter !== 'all' && 'text-brand')} />
          </IconButton>
        }
      >
        {FILTERS.filter((f) => f.tabs.includes(tab)).map((f) => (
          <MenuItem
            key={f.value}
            active={filter === f.value}
            icon={<Check className={clsx('size-3.5', filter === f.value ? 'opacity-100' : 'opacity-0')} />}
            onClick={() => {
              onFilterChange(f.value);
              setFilterOpen(false);
            }}
          >
            {f.label}
          </MenuItem>
        ))}
      </Popover>

      <IconButton label="Refresh" onClick={onRefresh}>
        <RotateCw className={clsx('size-4', refreshing && 'animate-spin')} />
      </IconButton>
    </div>
  );
}
