import clsx from 'clsx';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import toast from 'react-hot-toast';
import { pluralize } from '@/lib/format';
import { extractEmails, isValidEmail, mergeRecipients } from './parseEmails';

const VISIBLE_CHIPS = 3;
/** Rendering thousands of chips is pointless and slow; the count line shows the total. */
const MAX_EXPANDED_CHIPS = 200;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface RecipientFieldProps {
  recipients: string[];
  onChange: (recipients: string[]) => void;
  invalid?: boolean;
}

/** "To" row: typed/pasted addresses become chips; "Upload List" parses a CSV/TXT of leads. */
export function RecipientField({ recipients, onChange, invalid }: RecipientFieldProps) {
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [uploaded, setUploaded] = useState<{ name: string; found: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const add = (emails: string[]) => onChange(mergeRecipients(recipients, emails).merged);

  const commitDraft = () => {
    const value = draft.trim().replace(/[,;]$/, '');
    if (!value) return;
    if (!isValidEmail(value)) {
      toast.error(`“${value}” is not a valid email address`);
      return;
    }
    add([value.toLowerCase()]);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ';', 'Tab'].includes(e.key) && draft.trim()) {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && !draft && recipients.length) {
      onChange(recipients.slice(0, -1));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const emails = extractEmails(e.clipboardData.getData('text'));
    if (emails.length > 1) {
      e.preventDefault();
      add(emails);
      toast.success(`Added ${pluralize(emails.length, 'address')}`);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('Lead files must be 5 MB or smaller');
      return;
    }
    const emails = extractEmails(await file.text());
    if (emails.length === 0) {
      toast.error(`No email addresses found in ${file.name}`);
      return;
    }
    const { merged, added } = mergeRecipients(recipients, emails);
    onChange(merged);
    setUploaded({ name: file.name, found: emails.length });
    toast.success(`${pluralize(emails.length, 'email')} detected in ${file.name}${added < emails.length ? ` (${added} new)` : ''}`);
  };

  const visible = recipients.slice(0, expanded ? MAX_EXPANDED_CHIPS : VISIBLE_CHIPS);
  const hidden = recipients.length - visible.length;

  return (
    <div>
      <div className={clsx('flex min-h-10 items-start gap-2 border-b py-1.5', invalid ? 'border-red-400' : 'border-line')}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {visible.map((email) => (
            <span key={email} className="inline-flex items-center gap-1 rounded-full border border-brand bg-white py-0.5 pr-1 pl-2.5 text-xs">
              {email}
              <button
                type="button"
                aria-label={`Remove ${email}`}
                onClick={() => onChange(recipients.filter((r) => r !== email))}
                className="rounded-full p-0.5 text-muted hover:bg-surface hover:text-ink"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              disabled={expanded}
              className="rounded-full border border-brand px-2.5 py-0.5 text-xs font-medium text-brand disabled:cursor-default"
            >
              +{hidden.toLocaleString()}
              {expanded && ' more'}
            </button>
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={commitDraft}
            placeholder={recipients.length ? '' : 'recipient@example.com'}
            aria-label="Recipients"
            className="h-7 min-w-[140px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#b5b5b5]"
          />
        </div>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
        >
          <Upload className="size-4" />
          Upload List
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {(recipients.length > 0 || uploaded) && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          {uploaded && (
            <>
              <FileSpreadsheet className="size-3.5 text-brand" />
              <span>
                {uploaded.name}: <b className="font-medium text-ink">{pluralize(uploaded.found, 'email')} detected</b> ·
              </span>
            </>
          )}
          <span>{pluralize(recipients.length, 'recipient')} total</span>
          {recipients.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange([]);
                setUploaded(null);
                setExpanded(false);
              }}
              className="ml-1 text-muted underline hover:text-ink"
            >
              Clear
            </button>
          )}
        </p>
      )}
    </div>
  );
}
