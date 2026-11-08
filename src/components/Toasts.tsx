import { X } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';

/** Bottom center toasts. Errors are announced as alerts, the rest politely. */
export function Toasts() {
  const { toasts, dismissToast } = useStickyBoard();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2 px-4">
      {toasts.map(t => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-toast px-4 py-3 text-sm text-toast-ink shadow-2xl animate-fade-in"
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
              className="rounded-lg bg-toast-ink px-3 py-1.5 text-xs font-semibold text-toast"
            >
              {t.action.label}
            </button>
          )}
          <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
