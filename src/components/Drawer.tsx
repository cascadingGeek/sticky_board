import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap, useScrollLock } from '../lib/useFocusTrap';

interface DrawerProps {
  title: string;
  /** A short line under the title, such as "4 notes". */
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Shared right side drawer (440 px): a modal dialog with a scrim, focus trap and scroll lock. */
export function Drawer({ title, subtitle, onClose, children, footer }: DrawerProps) {
  const ref = useRef<HTMLElement>(null);
  useFocusTrap(ref);
  useScrollLock();
  const titleId = `drawer-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="fixed inset-0 z-40">
      <div aria-hidden="true" className="absolute inset-0 bg-scrim animate-fade-in" onClick={onClose} />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-panel text-ink shadow-panel animate-drawer-in min-[480px]:w-[440px]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line py-4 pr-5 pl-6">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id={titleId} className="m-0 text-xl font-bold">
              {title}
            </h2>
            {subtitle && <p className="m-0 truncate text-[13px] text-ink-faint">{subtitle}</p>}
          </div>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] text-ink hover:bg-hover"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
      </aside>
    </div>
  );
}
