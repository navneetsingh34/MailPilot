import { Check, ChevronDown, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { MenuItem, Popover } from '@/components/ui/Popover';
import type { Sender } from '@/types/api';

interface SenderSelectProps {
  senders: Sender[];
  /** undefined = rotate across all senders */
  value: string | undefined;
  onChange: (senderId: string | undefined) => void;
}

export function SenderSelect({ senders, value, onChange }: SenderSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = senders.find((s) => s.id === value);
  const pick = (id: string | undefined) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className="w-80 p-1.5"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inline-flex h-8 items-center gap-2 rounded-lg bg-surface px-3 text-[13px] transition hover:brightness-[0.98]"
        >
          {selected ? selected.email : `All senders (rotate ${senders.length})`}
          <ChevronDown className="size-3.5 text-muted" />
        </button>
      }
    >
      <MenuItem active={!value} icon={<Shuffle className="size-4" />} onClick={() => pick(undefined)}>
        <span>
          <span className="block">All senders</span>
          <span className="block text-[11px] text-muted">Round-robin to spread the hourly limits</span>
        </span>
      </MenuItem>
      {senders.map((s) => (
        <MenuItem key={s.id} active={s.id === value} icon={<Check className={`size-4 ${s.id === value ? '' : 'opacity-0'}`} />} onClick={() => pick(s.id)}>
          <span className="min-w-0">
            <span className="block truncate">{s.name}</span>
            <span className="block truncate text-[11px] text-muted">{s.email}</span>
          </span>
        </MenuItem>
      ))}
    </Popover>
  );
}
