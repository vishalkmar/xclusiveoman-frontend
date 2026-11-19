import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { LuTrash2, LuTriangleAlert } from 'react-icons/lu';

// In-app confirmation pop-up — use it instead of the browser's
// window.confirm for deletes and other irreversible actions (admin and
// agent portals alike; styled with plain colours, no portal tokens).
//
//   <AnimatePresence>
//     {target && (
//       <ConfirmDialog
//         title="Delete this visa?"
//         confirmLabel="Delete visa"
//         onCancel={() => setTarget(null)}
//         onConfirm={async () => { await api.del(...); setTarget(null); }}
//       >
//         It's removed for agents straight away.
//       </ConfirmDialog>
//     )}
//   </AnimatePresence>
//
// `onConfirm` may be async: while it runs the buttons are disabled; if it
// throws, its message is shown here and the dialog stays open to retry.
// Esc, Cancel or a click outside close it (not while it's working).
// tone: 'danger' (red, trash icon — default) | 'warning' (amber).
// Rendered into document.body, so a transformed/animated parent can't clip
// or offset it.

const TONES = {
  danger: {
    icon: LuTrash2,
    iconBox: 'bg-[#FEE4E2] text-[#D92D20]',
    button: 'bg-[#D92D20] hover:bg-[#B42318] focus-visible:ring-[#D92D20]/30',
  },
  warning: {
    icon: LuTriangleAlert,
    iconBox: 'bg-[#FEF0C7] text-[#B54708]',
    button: 'bg-[#DC6803] hover:bg-[#B54708] focus-visible:ring-[#DC6803]/30',
  },
};

export default function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Delete',
  busyLabel = 'Deleting…',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef(null);
  const t = TONES[tone] || TONES.danger;
  const Icon = t.icon;

  // Focus Cancel (the safe choice); Esc closes; the page behind doesn't scroll.
  useEffect(() => {
    cancelRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0F172A]/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        initial={{ scale: 0.96, y: 8, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 8, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)]"
      >
        <div className="flex items-start gap-4">
          <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-full ${t.iconBox}`}>
            <Icon size={20} />
          </span>
          <div className="min-w-0">
            <h3 id="confirm-dialog-title" className="text-lg font-bold leading-snug text-[#101828]">
              {title}
            </h3>
            <div id="confirm-dialog-body" className="mt-1.5 text-sm leading-relaxed text-[#475467]">
              {children}
            </div>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-[#FDA29B] bg-[#FEF3F2] px-3 py-2 text-sm text-[#B42318]">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#98A2B3]/30 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60 ${t.button}`}
          >
            <Icon size={15} /> {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
