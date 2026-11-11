import { useRef } from 'react';
import { useFocusTrap } from '../lib/useFocusTrap';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A small destructive confirm. Esc closes only this dialog, not what is behind it. */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-scrim" onClick={onCancel} />
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          }
        }}
        className="relative w-full max-w-[400px] rounded-[20px] border border-line bg-panel p-6 text-ink shadow-pop animate-fade-in"
      >
        <h2 id="confirm-title" className="m-0 text-[21px] font-bold">
          {title}
        </h2>
        <p id="confirm-message" className="mt-2 mb-[22px] text-sm leading-normal text-ink-faint">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" data-autofocus onClick={onCancel} className="h-11 rounded-xl bg-raise-strong px-[18px] text-sm font-semibold hover:bg-hover">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 rounded-xl bg-danger-fill px-[18px] text-sm font-semibold text-danger-fill-ink hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
