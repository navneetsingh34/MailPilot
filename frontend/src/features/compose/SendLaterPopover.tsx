import clsx from 'clsx';
import { CalendarDays, Clock } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Popover } from '@/components/ui/Popover';
import { formatDateTime, toDateTimeLocal } from '@/lib/format';

interface SendLaterPopoverProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
}

function tomorrowAt(hour: number | null): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (hour !== null) d.setHours(hour, 0, 0, 0);
  else d.setSeconds(0, 0);
  return d;
}

const PRESETS = [
  { label: 'Tomorrow', at: () => tomorrowAt(null) },
  { label: 'Tomorrow, 10:00 AM', at: () => tomorrowAt(10) },
  { label: 'Tomorrow, 11:00 AM', at: () => tomorrowAt(11) },
  { label: 'Tomorrow, 3:00 PM', at: () => tomorrowAt(15) },
];

/** The "Send Later" panel: free date-time pick or presets, confirmed with Done. */
export function SendLaterPopover({ value, onChange }: SendLaterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const dateInput = useRef<HTMLInputElement>(null);

  const openPanel = () => {
    setDraft(value ? toDateTimeLocal(value) : '');
    setOpen(true);
  };
  const draftDate = draft ? new Date(draft) : null;
  const inPast = draftDate !== null && draftDate.getTime() < Date.now();

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      className="w-[240px] p-3"
      trigger={
        <IconButton label={value ? `Scheduled for ${formatDateTime(value.toISOString())}` : 'Send later'} active={!!value} onClick={() => (open ? setOpen(false) : openPanel())}>
          <Clock className={clsx('size-[18px]', value ? 'text-brand' : 'text-[#4b4b4b]')} />
        </IconButton>
      }
    >
      <p className="mb-3 text-[13px] font-medium">Send Later</p>
      <label className="flex items-center gap-2 border-b border-line pb-2">
        <input
          ref={dateInput}
          type="datetime-local"
          value={draft}
          min={toDateTimeLocal(new Date())}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Pick date & time"
          className={clsx('w-full bg-transparent text-xs outline-none [&::-webkit-calendar-picker-indicator]:hidden', !draft && 'text-muted')}
        />
        <button type="button" aria-label="Open calendar" onClick={() => dateInput.current?.showPicker()} className="text-muted hover:text-ink">
          <CalendarDays className="size-4 shrink-0" />
        </button>
      </label>
      {inPast && <p className="mt-1 text-[11px] text-red-600">That time has passed. Pick a future time.</p>}

      <ul className="mt-2 mb-6">
        {PRESETS.map((p) => {
          const at = toDateTimeLocal(p.at());
          return (
            <li key={p.label}>
              <button
                type="button"
                onClick={() => setDraft(at)}
                className={clsx('w-full rounded-md px-1 py-1.5 text-left text-xs transition hover:bg-surface', draft === at && 'font-medium text-brand')}
              >
                {p.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-end gap-2">
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="mr-auto text-[11px] text-muted underline hover:text-ink"
          >
            Send now instead
          </button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          variant="outline"
          size="sm"
          pill
          disabled={!draftDate || inPast}
          onClick={() => {
            onChange(draftDate);
            setOpen(false);
          }}
        >
          Done
        </Button>
      </div>
    </Popover>
  );
}
