import clsx from 'clsx';
import { useId } from 'react';

interface NumberBoxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  invalid?: boolean;
  hint?: string;
}

/** Figma's small boxed numeric input ("Delay between 2 emails [00]"). */
export function NumberBox({ label, value, onChange, suffix, invalid, hint }: NumberBoxProps) {
  const id = useId();
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2.5 text-[13px]" title={hint}>
      {label}
      <span className={clsx('inline-flex h-8 items-center rounded-lg border px-2.5', invalid ? 'border-red-400' : 'border-line')}>
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
          placeholder="00"
          className="w-10 bg-transparent text-[13px] outline-none placeholder:text-[#b5b5b5]"
        />
        {suffix && <span className="text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  );
}
