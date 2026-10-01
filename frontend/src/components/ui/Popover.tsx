import clsx from 'clsx';
import { useEffect, useRef, type ReactNode } from 'react';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The element the panel is anchored to (rendered inline). */
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

/** Anchored panel that closes on outside click or Escape. Used for menus and pickers. */
export function Popover({ open, onClose, trigger, children, align = 'left', className }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div
          role="dialog"
          className={clsx(
            'absolute top-full z-30 mt-1.5 rounded-xl border border-line bg-white shadow-lg shadow-black/5',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  /** Open href in a new tab */
  external?: boolean;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
}

export function MenuItem({ icon, children, onClick, href, external, danger, active, disabled }: MenuItemProps) {
  const classes = clsx(
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition hover:bg-surface disabled:opacity-50',
    danger ? 'text-red-600' : 'text-ink',
    active && 'bg-brand-soft font-medium',
  );
  if (href) {
    return (
      <a href={href} className={classes} {...(external && { target: '_blank', rel: 'noopener noreferrer' })}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes}>
      {icon}
      {children}
    </button>
  );
}
