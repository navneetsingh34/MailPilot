import clsx from 'clsx';
import { ArrowLeft, Paperclip } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useScheduleCampaign, useSenders } from '@/features/compose/api';
import { AttachmentTray } from '@/features/compose/AttachmentTray';
import { NumberBox } from '@/features/compose/NumberBox';
import { readFileAsBase64 } from '@/features/compose/parseEmails';
import { RecipientField } from '@/features/compose/RecipientField';
import { RichTextEditor } from '@/features/compose/RichTextEditor';
import { SendLaterPopover } from '@/features/compose/SendLaterPopover';
import { SenderSelect } from '@/features/compose/SenderSelect';
import { formatDateTime, formatScheduleTime, pluralize } from '@/lib/format';

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

type Field = 'recipients' | 'subject' | 'body' | 'hourlyLimit';

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 sm:gap-4">
      <span className="w-[48px] shrink-0 pt-2.5 text-[13px] sm:w-[52px]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default function ComposePage() {
  const navigate = useNavigate();
  const { data: senders = [] } = useSenders();
  const schedule = useScheduleCampaign();
  // One key per compose session: a double-click or retry can never create two campaigns.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [senderId, setSenderId] = useState<string | undefined>();
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [delaySeconds, setDelaySeconds] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState('');
  const [body, setBody] = useState({ html: '', empty: true });
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [invalid, setInvalid] = useState<Set<Field>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);

  const clearInvalid = (field: Field) =>
    setInvalid((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });

  const addFiles = (list: FileList | null) => {
    const picked = [...(list ?? [])];
    const tooBig = picked.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(', ')}: attachments must be 2 MB or less`);
    const next = [...files, ...picked.filter((f) => f.size <= MAX_ATTACHMENT_BYTES)];
    if (next.length > MAX_ATTACHMENTS) toast.error(`Up to ${MAX_ATTACHMENTS} attachments per email`);
    setFiles(next.slice(0, MAX_ATTACHMENTS));
  };

  const validate = (): string | null => {
    const problems: [Field, string][] = [];
    if (recipients.length === 0) problems.push(['recipients', 'Add at least one recipient or upload a list']);
    if (!subject.trim()) problems.push(['subject', 'Subject is required']);
    if (body.empty) problems.push(['body', 'Write the email body']);
    if (!Number(hourlyLimit)) problems.push(['hourlyLimit', 'Set an hourly limit (at least 1)']);
    setInvalid(new Set(problems.map(([field]) => field)));
    if (startAt && startAt.getTime() < Date.now()) return 'The scheduled time has passed. Pick a new time or send now.';
    return problems[0]?.[1] ?? null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    try {
      const attachments = await Promise.all(
        files.map(async (f) => ({ filename: f.name, mimeType: f.type || 'application/octet-stream', contentBase64: await readFileAsBase64(f) })),
      );
      const result = await schedule.mutateAsync({
        subject: subject.trim(),
        bodyHtml: body.html,
        recipients,
        startAt: startAt?.toISOString(),
        delayBetweenSeconds: Number(delaySeconds) || 0,
        hourlyLimit: Number(hourlyLimit),
        senderId,
        idempotencyKey,
        attachments,
      });
      toast.success(
        `Scheduled ${pluralize(result.scheduledCount, 'email')}${result.firstSendAt ? ` · first send ${formatScheduleTime(result.firstSendAt)}` : ''}`,
        { duration: 5000 },
      );
      navigate('/scheduled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not schedule emails');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-1.5 px-2 py-3 sm:gap-3 sm:px-4">
        <IconButton label="Back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/scheduled'))}>
          <ArrowLeft className="size-5 text-ink" />
        </IconButton>
        <h1 className="min-w-0 flex-1 truncate text-lg sm:text-xl">Compose New Email</h1>

        <IconButton label="Attach files" onClick={() => fileInput.current?.click()} className="relative">
          <Paperclip className={clsx('size-[18px]', files.length ? 'text-brand' : 'text-[#4b4b4b]')} />
          {files.length > 0 && <span className="absolute right-0.5 bottom-0.5 text-[9px] font-semibold text-brand">{files.length}</span>}
        </IconButton>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <SendLaterPopover value={startAt} onChange={setStartAt} />
        {startAt && <span className="hidden text-xs text-muted sm:inline">{formatDateTime(startAt.toISOString())}</span>}
        <Button variant="outline" size="sm" pill loading={schedule.isPending} onClick={() => void submit()} className="min-w-[78px]">
          {startAt ? 'Send Later' : 'Send'}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[780px] space-y-3 px-4 pt-3 pb-10 sm:px-6">
          <FormRow label="From">
            <SenderSelect senders={senders} value={senderId} onChange={setSenderId} />
          </FormRow>
          <FormRow label="To">
            <RecipientField
              recipients={recipients}
              invalid={invalid.has('recipients')}
              onChange={(r) => {
                setRecipients(r);
                clearInvalid('recipients');
              }}
            />
          </FormRow>
          <FormRow label="Subject">
            <input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                clearInvalid('subject');
              }}
              placeholder="Subject"
              maxLength={300}
              aria-label="Subject"
              className={clsx(
                'h-10 w-full border-b bg-transparent text-[13px] outline-none placeholder:text-[#b5b5b5]',
                invalid.has('subject') ? 'border-red-400' : 'border-line',
              )}
            />
          </FormRow>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 py-1">
            <NumberBox label="Delay between 2 emails" value={delaySeconds} onChange={setDelaySeconds} suffix="sec" hint="Seconds between consecutive emails in this campaign" />
            <NumberBox
              label="Hourly Limit"
              value={hourlyLimit}
              onChange={(v) => {
                setHourlyLimit(v);
                clearInvalid('hourlyLimit');
              }}
              invalid={invalid.has('hourlyLimit')}
              hint="Maximum emails from this campaign per hour; extra emails roll into the next hour"
            />
          </div>

          <RichTextEditor
            invalid={invalid.has('body')}
            onChange={(html, empty) => {
              setBody({ html, empty });
              if (!empty) clearInvalid('body');
            }}
          />
          <AttachmentTray files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
        </div>
      </div>
    </div>
  );
}
