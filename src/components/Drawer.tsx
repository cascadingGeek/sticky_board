import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap, useScrollLock } from '../lib/useFocusTrap';

interface DrawerProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Shared right side drawer: a modal dialog with a scrim, focus trap and scroll lock. */
export function Drawer({ title, onClose, children, footer }: DrawerProps) {
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
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-panel text-ink shadow-[-30px_0_60px_-20px_rgba(0,0,0,0.6)] animate-drawer-in min-[480px]:w-[400px]"
      >
        <header className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 id={titleId} className="font-display text-xl font-bold">
            {title}
          </h2>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
            className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-raise text-ink-soft hover:bg-raise-strong"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
      </aside>
    </div>
  );
}
