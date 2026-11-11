import { Info, X } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';

/** Bottom centre toasts. Errors are alerts and stay until dismissed; the rest are polite and fade. */
export function Toasts() {
  const { toasts, dismissToast } = useStickyBoard();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2 px-4">
      {toasts.map(t => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex max-w-[min(560px,100%)] items-center gap-3 rounded-[14px] bg-toast py-1 pr-1 pl-3.5 text-sm text-toast-ink shadow-toast animate-fade-in"
        >
          {t.tone === 'error' ? (
            <span aria-hidden="true" className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-toast-error text-[13px] font-bold text-white">
              !
            </span>
          ) : (
            <span aria-hidden="true" className="paper-yellow paper-swatch flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-[var(--paper-ink)]">
              <Info size={13} strokeWidth={2.5} />
            </span>
          )}
          <span className="py-2">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
              className="h-9 flex-none rounded-lg bg-toast-ink px-3 text-xs font-semibold text-toast"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-lg opacity-75 hover:opacity-100"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
