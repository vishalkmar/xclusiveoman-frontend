import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LuBan, LuCloudUpload, LuDownload, LuEye, LuFileText, LuRefreshCw, LuTrash2, LuUndo2, LuX } from 'react-icons/lu';
import { Button, TextInput } from '../ui.jsx';
import ConfirmDialog from '../../../shared/components/ConfirmDialog.jsx';
import { downloadUrl } from './DocumentLightbox.jsx';
import { fmtDate, fmtDateTime } from './visaAdminMeta.js';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;

const sizeLabel = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function fileProblem(file) {
  if (!ACCEPT.split(',').includes(file.type)) return 'Upload the visa as a PDF, JPG, PNG or WebP.';
  if (file.size > MAX_BYTES) return 'That file is over 10 MB.';
  return '';
}

// Drop zone + visa number + valid-until, then "Upload visa". Used for a
// traveller with no visa yet, and to replace an issued one.
function UploadForm({ travellerName, busy, onUpload, onCancel, defaultNumber = '', defaultValidUntil = '' }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState('');
  const [visaNumber, setVisaNumber] = useState(defaultNumber);
  const [validUntil, setValidUntil] = useState(defaultValidUntil);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) return setPreview('');
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(f) {
    if (!f) return;
    const p = fileProblem(f);
    setProblem(p);
    setFile(p ? null : f);
  }

  return (
    <div className="space-y-3">
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files?.[0]);
          }}
          className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
            dragging ? 'border-accent bg-accent-soft/60' : 'border-[#C7D2FE] bg-[#F8FAFF] hover:border-accent hover:bg-accent-soft/40'
          }`}
          aria-label={`Choose the visa file for ${travellerName}`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-accent shadow-sm">
            <LuCloudUpload size={20} />
          </span>
          <span className="text-sm font-semibold text-ink">Drop the visa here, or click to choose</span>
          <span className="text-[11px] text-muted">PDF, JPG, PNG or WebP · up to 10 MB</span>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-line-light bg-white p-3">
          {preview ? (
            <img src={preview} alt="" className="h-14 w-14 flex-none rounded-lg border border-line-light object-cover" />
          ) : (
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-lg bg-[#FEF2F2] text-[#DC2626]">
              <LuFileText size={24} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink" title={file.name}>
              {file.name}
            </div>
            <div className="text-[11px] text-muted">
              {file.type === 'application/pdf' ? 'PDF' : 'Image'} · {sizeLabel(file.size)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFile(null)}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel hover:text-ink"
            aria-label="Choose a different file"
          >
            <LuX size={16} />
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
      {problem && <p className="text-xs text-[#B91C1C]">{problem}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase text-muted">Visa number (optional)</span>
          <TextInput value={visaNumber} maxLength={60} onChange={(e) => setVisaNumber(e.target.value)} placeholder="e.g. 51234567" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase text-muted">Valid until (optional)</span>
          <TextInput type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="accent" disabled={!file || busy} onClick={() => onUpload({ file, visaNumber: visaNumber.trim(), validUntil })}>
          <LuCloudUpload size={14} className="mr-1.5" />
          {busy ? 'Uploading…' : 'Upload visa'}
        </Button>
        {onCancel && (
          <Button disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function RefuseForm({ busy, onRefuse, onCancel }) {
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-3 rounded-xl border border-[#FECACA] bg-[#FFF7F7] p-3">
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold uppercase text-[#B91C1C]">Reason for refusal (shown to the agent)</span>
        <TextInput autoFocus value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Passport expires within 6 months" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" disabled={!reason.trim() || busy} onClick={() => onRefuse(reason.trim())}>
          {busy ? 'Saving…' : 'Refuse visa'}
        </Button>
        <Button disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// The traveller's visa block on the request page:
//   pending  -> upload form (+ "Refuse this visa")
//   issued   -> the visa (view / download / replace / remove)
//   rejected -> the reason (+ undo)
// `locked` (payment still in review) shows a note instead of any action.
export function VisaUploadPanel({ traveller, locked, busy, onUpload, onRemove, onRefuse, onOpenDoc }) {
  const [mode, setMode] = useState('idle'); // idle | replace | refuse
  const [confirmRemove, setConfirmRemove] = useState(false);
  const name = traveller.fullName || `Traveller ${traveller.position}`;

  useEffect(() => setMode('idle'), [traveller.visaStatus, traveller.visaDocumentUrl]);

  if (locked) {
    return (
      <p className="rounded-xl border border-dashed border-line-light bg-[#F8FAFC] px-4 py-3 text-xs text-muted">
        Visas can be uploaded once the visa fee&apos;s NEFT slip is approved in NEFT Verification.
      </p>
    );
  }

  if (traveller.visaStatus === 'issued' && mode !== 'replace') {
    const isPdf = traveller.visaDocumentType === 'pdf';
    return (
      <div className="rounded-xl border border-[#A7F3D0] bg-[#F0FDF7] p-3">
        <div className="flex flex-wrap items-center gap-3">
          {isPdf ? (
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-lg bg-white text-[#DC2626] shadow-sm">
              <LuFileText size={24} />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onOpenDoc({ url: traveller.visaDocumentUrl, title: `${name} — Visa` })}
              className="h-14 w-14 flex-none overflow-hidden rounded-lg border border-white shadow-sm"
              aria-label="View visa"
            >
              <img src={traveller.visaDocumentUrl} alt="" className="h-full w-full object-cover" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[#065F46]">Visa issued</div>
            <div className="truncate text-[11px] text-[#047857]">
              {[traveller.visaNumber && `No. ${traveller.visaNumber}`, traveller.visaValidUntil && `Valid until ${fmtDate(traveller.visaValidUntil)}`]
                .filter(Boolean)
                .join(' · ') || traveller.visaDocumentName || 'Visa document'}
            </div>
            <div className="text-[10px] text-[#059669]/80">Uploaded {fmtDateTime(traveller.visaIssuedAt)} · visible to the agent</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {isPdf ? (
            <a
              href={traveller.visaDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#A7F3D0] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#047857] hover:border-[#10B981]"
            >
              <LuEye size={13} /> View
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onOpenDoc({ url: traveller.visaDocumentUrl, title: `${name} — Visa` })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#A7F3D0] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#047857] hover:border-[#10B981]"
            >
              <LuEye size={13} /> View
            </button>
          )}
          <a
            href={downloadUrl(traveller.visaDocumentUrl)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#A7F3D0] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#047857] hover:border-[#10B981]"
          >
            <LuDownload size={13} /> Download
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode('replace')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line-light bg-white px-3 py-1.5 text-[11px] font-semibold text-ink hover:border-accent hover:text-accent"
          >
            <LuRefreshCw size={13} /> Replace
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmRemove(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#FECACA] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#B91C1C] hover:border-[#EF4444]"
          >
            <LuTrash2 size={13} /> Remove
          </button>
        </div>
        <AnimatePresence>
          {confirmRemove && (
            <ConfirmDialog
              title={`Remove ${name}'s visa?`}
              confirmLabel="Remove visa"
              busyLabel="Removing…"
              onCancel={() => setConfirmRemove(false)}
              onConfirm={() => {
                setConfirmRemove(false);
                onRemove();
              }}
            >
              The uploaded visa is deleted and the agent will no longer see it. You can upload it again afterwards.
            </ConfirmDialog>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (traveller.visaStatus === 'rejected') {
    return (
      <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3">
        <div className="flex items-start gap-2">
          <LuBan size={16} className="mt-0.5 flex-none text-[#DC2626]" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[#991B1B]">Visa refused</div>
            <div className="text-xs text-[#B91C1C]">{traveller.visaRejectionReason || 'No reason given.'}</div>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#FECACA] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#B91C1C] hover:border-[#EF4444]"
        >
          <LuUndo2 size={13} /> Undo refusal
        </button>
      </div>
    );
  }

  if (mode === 'refuse') {
    return <RefuseForm busy={busy} onRefuse={onRefuse} onCancel={() => setMode('idle')} />;
  }

  return (
    <div>
      <UploadForm
        travellerName={name}
        busy={busy}
        onUpload={onUpload}
        onCancel={mode === 'replace' ? () => setMode('idle') : null}
        defaultNumber={mode === 'replace' ? traveller.visaNumber || '' : ''}
        defaultValidUntil={mode === 'replace' ? traveller.visaValidUntil || '' : ''}
      />
      {mode !== 'replace' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode('refuse')}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#B91C1C] hover:underline"
        >
          <LuBan size={12} /> Refuse this visa instead
        </button>
      )}
    </div>
  );
}
