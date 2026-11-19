import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LuTrash2 } from 'react-icons/lu';
import { Button, ErrorText } from '../ui.jsx';

// Confirm step for permanently removing a traveller's photo or passport
// (the images are deleted from storage, not just hidden). `onConfirm` is
// async; its error message is shown here and the dialog stays open so the
// agent can retry.
export default function RemoveConfirmDialog({ title, children, confirmLabel = 'Remove', onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
      setError(err.message || 'Could not remove it. Please try again.');
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={() => !busy && onCancel()}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FEE2E2] text-[#B91C1C]">
          <LuTrash2 size={20} />
        </span>
        <h3 className="mt-4 text-lg font-bold text-agent-ink">{title}</h3>
        <div className="mt-1.5 text-sm leading-relaxed text-agent-muted">{children}</div>
        {error && (
          <div className="mt-3">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B91C1C] disabled:opacity-60"
          >
            <LuTrash2 size={15} /> {busy ? 'Removing…' : confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
