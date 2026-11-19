import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LuCheck, LuCircleAlert, LuCircleCheck, LuFileText, LuLoader, LuUpload, LuX } from 'react-icons/lu';
import { api } from '../../api/client.js';
import { Button } from '../ui.jsx';
import { MAX_PAGES, PASSPORT_ACCEPT, fileToPages } from '../../lib/passportPages.js';
import { PassportBackSample, PassportFrontSample } from './PassportSamples.jsx';

// Passport upload for one traveller, in two steps:
//   1. Front (photo/data) page — scanned straight away; its passport number
//      is read from the code lines. It also takes the whole passport (a
//      multi-page PDF or a photo of the open spread); the backend then picks
//      out the pages and only keeps a back page whose number matches.
//   2. Back (address) page — unlocks once the front's passport number is
//      known, and is only accepted when that SAME number is on it
//      (POST …/passport/back, passportBackCheck.service.js). A back page from
//      another passport shows "Passport not matched" and nothing is saved —
//      there's no way to continue without a matching back page.
// Each slot shows an example of the page it wants (PassportSamples.jsx).
// When the passport is already uploaded, the modal opens at the step that's
// still missing. A matched back page leads to the pre-filled details page.

// How long "Front page verified" shows before the card flips to the back page.
const FLIP_DELAY_MS = 1100;

const SCAN_STEPS = {
  front: ['Preparing the pages', 'Finding the photo page', 'Reading the passport number and details', 'Checking expiry date and name'],
  back: ['Preparing the page', 'Reading the back page', 'Looking for the passport number', 'Matching it with the front page'],
};

function revokeAll(pages) {
  pages.forEach((p) => URL.revokeObjectURL(p.url));
}

function Slot({ step, title, hint, Sample, sampleLabel, disabled, disabledText, optional, pages, busy, onFiles, onClear, clearLabel = 'Remove', highlight, done, tone }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const filled = pages.length > 0;
  const ticked = done ?? filled;

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        disabled
          ? 'border-agent-line-light bg-agent-panel/40'
          : tone === 'danger'
            ? 'border-[#FCA5A5] bg-[#FEF2F2]/60 ring-2 ring-[#FCA5A5]/40'
            : highlight
            ? 'border-agent-accent bg-agent-accent-soft/40 ring-2 ring-agent-accent/30'
            : 'border-agent-line-light bg-white'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold ${
              ticked ? 'bg-agent-ink text-white' : 'bg-agent-panel text-agent-ink'
            }`}
          >
            {ticked ? <LuCheck size={13} /> : step}
          </span>
          <div>
            <div className="text-sm font-bold text-agent-ink">
              {title} {optional && <span className="font-normal text-agent-muted">(optional)</span>}
            </div>
            <div className="text-[11px] leading-relaxed text-agent-muted">{hint}</div>
          </div>
        </div>
        {filled && !busy && (
          <button
            type="button"
            onClick={() => {
              onClear();
              // The input is hidden while the slot is filled. Open it after
              // clearing so Replace works without requiring a second click.
              window.setTimeout(() => inputRef.current?.click(), 0);
            }}
            className="flex-none text-[11px] font-semibold text-agent-muted hover:text-[#B91C1C]"
          >
            {clearLabel}
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:items-stretch">
        {/* What this page looks like */}
        <figure className={`${disabled ? 'opacity-60' : ''}`}>
          <div className="overflow-hidden rounded-lg border border-agent-line-light bg-white p-1.5">
            <Sample className="block h-auto w-full" />
          </div>
          <figcaption className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wide text-agent-muted">
            Example · {sampleLabel}
          </figcaption>
        </figure>

        {filled ? (
          <div className="flex min-h-[120px] items-start gap-2 overflow-x-auto rounded-lg border border-agent-line-light bg-agent-panel/40 p-2">
            {pages.map((p) => (
              <figure key={p.url} className="w-24 flex-none">
                <img src={p.url} alt={p.label} className="h-28 w-24 rounded-md border border-agent-line-light bg-white object-cover" />
                <figcaption className="mt-1 truncate text-[10px] text-agent-muted" title={p.label}>
                  {p.label}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!disabled) onFiles(Array.from(e.dataTransfer.files || []));
            }}
            className={`flex min-h-[120px] w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition ${
              dragging ? 'border-agent-ink bg-agent-panel' : 'border-agent-line-light hover:border-agent-ink'
            } disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-agent-line-light`}
          >
            {busy ? <LuLoader className="animate-spin text-agent-muted" size={22} /> : <LuUpload className="text-agent-muted" size={22} />}
            <span className="text-xs font-semibold text-agent-ink">
              {busy ? 'Preparing pages…' : disabled ? disabledText || 'Add the front page first' : 'Choose a file or drop it here'}
            </span>
            <span className="text-[10px] text-agent-muted">JPG, PNG, WebP or PDF · up to 25MB · scans automatically</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={PASSPORT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          onFiles(Array.from(e.target.files || []));
          e.target.value = '';
        }}
      />
    </div>
  );
}

export default function PassportUploadModal({ applicationId, applicant, onClose, onScanned }) {
  // The traveller as the server last returned it (updated after each step).
  const [current, setCurrent] = useState(applicant);
  const [front, setFront] = useState([]);
  const [back, setBack] = useState([]);
  const [replacingFront, setReplacingFront] = useState(false);
  const [preparing, setPreparing] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(''); // '' | 'front' | 'back'
  const [scanStep, setScanStep] = useState(0);
  // { slot: 'front'|'back', message, issues } — a refused page.
  const [rejected, setRejected] = useState(null);
  const latest = useRef({ front, back });
  latest.current = { front, back };

  useEffect(() => () => revokeAll([...latest.current.front, ...latest.current.back]), []);

  useEffect(() => {
    if (!scanning) return undefined;
    setScanStep(0);
    const steps = SCAN_STEPS[scanning];
    const id = setInterval(() => setScanStep((s) => Math.min(steps.length - 1, s + 1)), 2200);
    return () => clearInterval(id);
  }, [scanning]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !scanning && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, scanning]);

  // Where the traveller stands (from the server's answer).
  const hasFront = !!current.passportFrontUrl && !replacingFront;
  const passportNumber = hasFront ? current.passportDetails?.passportNumber || '' : '';
  const backCheck = current.passportScan?.backCheck || null;
  const backMatched = hasFront && !!backCheck?.matched;
  const backInFront = backMatched && current.passportBackUrl && current.passportBackUrl === current.passportFrontUrl;

  // What each slot shows: pages just chosen, else the uploaded image.
  const frontShown = front.length ? front : hasFront ? [{ url: current.passportFrontUrl, label: 'Uploaded front page' }] : [];
  const backShown = back.length
    ? back
    : backMatched && current.passportBackUrl && !backInFront
      ? [{ url: current.passportBackUrl, label: 'Uploaded back page' }]
      : [];

  async function toPages(slot, files) {
    let pages = [];
    let skipped = 0;
    for (const file of files) {
      const r = await fileToPages(file, slot);
      pages.push(...r.pages);
      skipped += r.skipped;
    }
    const limit = slot === 'back' ? 3 : MAX_PAGES;
    if (pages.length > limit) {
      revokeAll(pages);
      throw new Error(slot === 'back' ? 'Upload just the back (address) page.' : `Too many pages — at most ${MAX_PAGES}. Upload just the front and back pages.`);
    }
    if (skipped) setError(`Long document: only the first and last pages were kept (${skipped} middle pages skipped) — that's where the front and back pages are.`);
    return pages;
  }

  // Step 1 — front page (or the whole passport).
  async function addFront(files) {
    if (!files.length) return;
    setError('');
    setRejected(null);
    setPreparing('front');
    let pages;
    try {
      pages = await toPages('front', files);
      revokeAll(front);
      revokeAll(back);
      setFront(pages);
      setBack([]);
    } catch (err) {
      setError(err.message);
      return;
    } finally {
      setPreparing('');
    }
    setScanning('front');
    try {
      const form = new FormData();
      pages.forEach((p, i) => form.append('pages', p.blob, `page-${i + 1}.jpg`));
      form.append('meta', JSON.stringify(pages.map((p) => ({ slot: p.slot, label: p.label }))));
      const { applicant: updated } = await api.postForm(`/visa/applications/${applicationId}/applicants/${applicant.id}/passport/scan`, form);
      setCurrent(updated);
      setReplacingFront(false);
    } catch (err) {
      setRejected({ slot: 'front', message: err.message, issues: err.data?.scan?.issues || [] });
    } finally {
      setScanning('');
    }
  }

  // Step 2 — back page, matched against the front's passport number.
  async function addBack(files) {
    if (!files.length) return;
    setError('');
    setRejected(null);
    setPreparing('back');
    let pages;
    try {
      pages = await toPages('back', files);
      revokeAll(back);
      setBack(pages);
    } catch (err) {
      setError(err.message);
      return;
    } finally {
      setPreparing('');
    }
    setScanning('back');
    try {
      const form = new FormData();
      pages.forEach((p, i) => form.append('pages', p.blob, `back-${i + 1}.jpg`));
      const { applicant: updated } = await api.postForm(`/visa/applications/${applicationId}/applicants/${applicant.id}/passport/back`, form);
      setCurrent(updated);
      // Once the back page is verified, continue directly to the details
      // form instead of requiring a second Review details click.
      onScanned(updated);
    } catch (err) {
      setRejected({ slot: 'back', message: err.message, issues: [] });
    } finally {
      setScanning('');
    }
  }

  function replaceFront() {
    revokeAll(front);
    revokeAll(back);
    setFront([]);
    setBack([]);
    setRejected(null);
    setReplacingFront(true);
  }

  function clearBack() {
    revokeAll(back);
    setBack([]);
    setRejected(null);
  }

  const frontRead = hasFront && !!passportNumber;
  const backRejected = rejected?.slot === 'back';

  // One page at a time: the front step until its passport number is read,
  // then the card flips over to the back step. A front that was just
  // verified stays on screen for a moment ("verified ✓") before the flip;
  // a passport that was already uploaded opens straight on the back step.
  const [showBack, setShowBack] = useState(frontRead);
  useEffect(() => {
    if (!frontRead) {
      setShowBack(false);
      return undefined;
    }
    const t = setTimeout(() => setShowBack(true), FLIP_DELAY_MS);
    return () => clearTimeout(t);
  }, [frontRead]);
  const step = showBack && frontRead ? 'back' : 'front';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#070B16]/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Passport for ${applicant.fullName}`}
    >
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-agent-muted">Passport</p>
            <h3 className="text-lg font-bold text-agent-ink">{applicant.fullName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!!scanning}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-agent-panel text-agent-ink transition hover:bg-agent-line-light disabled:opacity-40"
          >
            <LuX size={18} />
          </button>
        </div>

        {/* Step 1 → step 2 */}
        <ol className="mb-3 flex items-center gap-2 text-xs font-semibold" aria-label="Passport upload steps">
          {[
            ['front', 'Front page', frontRead],
            ['back', 'Back page', backMatched],
          ].map(([key, label, done], i) => (
            <li key={key} className="flex items-center gap-2">
              {i > 0 && <span className={`h-px w-8 ${frontRead ? 'bg-agent-ink' : 'bg-agent-line-light'}`} />}
              <span
                aria-current={step === key ? 'step' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition ${
                  step === key ? 'bg-agent-ink text-white' : done ? 'bg-agent-panel text-agent-ink' : 'bg-agent-panel/50 text-agent-muted'
                }`}
              >
                {done ? <LuCheck size={13} /> : <span>{i + 1}</span>} {label}
              </span>
            </li>
          ))}
        </ol>

        {/* The page card flips over from the front step to the back step. */}
        <div style={{ perspective: 1600 }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ rotateY: 90, opacity: 0.4 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: -90, opacity: 0.4 }}
              transition={{ duration: 0.32, ease: 'easeInOut' }}
              style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
            >
              {step === 'front' ? (
                <Slot
                  step={1}
                  title="Front page"
                  hint={
                    frontRead
                      ? `Passport number ${passportNumber} read from this page.`
                      : 'The page with the photo and the two code lines (<<<) at the bottom — or the whole passport as a PDF; we\u2019ll find the pages.'
                  }
                  Sample={PassportFrontSample}
                  sampleLabel="front page"
                  pages={frontShown}
                  done={frontRead}
                  busy={preparing === 'front'}
                  onFiles={addFront}
                  onClear={replaceFront}
                  clearLabel={hasFront ? 'Replace' : 'Remove'}
                  tone={rejected?.slot === 'front' ? 'danger' : undefined}
                />
              ) : (
                <div className="space-y-3">
                  {/* The verified front, in short — Replace flips back to step 1. */}
                  <div className="flex items-center gap-3 rounded-xl border border-agent-line-light bg-agent-panel/40 px-3 py-2.5">
                    <img
                      src={frontShown[0]?.url}
                      alt="Front page"
                      className="h-12 w-16 flex-none rounded-md border border-agent-line-light bg-white object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-agent-ink">
                        <LuCircleCheck size={15} className="flex-none text-[#E87535]" /> Front page verified
                      </p>
                      <p className="truncate text-xs text-agent-muted">Passport number {passportNumber}</p>
                    </div>
                    <button
                      type="button"
                      onClick={replaceFront}
                      disabled={!!scanning}
                      className="flex-none text-[11px] font-semibold text-agent-muted hover:text-agent-ink disabled:opacity-40"
                    >
                      Replace
                    </button>
                  </div>
                  <Slot
                    step={2}
                    title="Back page"
                    hint={
                      backMatched
                        ? backInFront
                          ? `Found in the front image — passport number ${backCheck.passportNumber} matches.`
                          : `Passport number ${backCheck.passportNumber} matches the front page.`
                        : `The last (address) page. It must show the same passport number: ${passportNumber}.`
                    }
                    Sample={PassportBackSample}
                    sampleLabel="back page"
                    highlight={!backMatched && !backRejected}
                    tone={backRejected ? 'danger' : undefined}
                    pages={backShown}
                    done={backMatched}
                    busy={preparing === 'back'}
                    onFiles={addBack}
                    onClear={clearBack}
                    clearLabel={backMatched ? 'Replace' : 'Remove'}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-agent-accent/40 bg-agent-accent-soft px-3 py-2 text-xs text-agent-accent-dark">
            <LuCircleAlert size={14} className="mt-0.5 flex-none" /> {error}
          </p>
        )}

        {/* Refused page: the front isn't a passport page, or the back is from another passport. */}
        {rejected && (
          <div role="alert" className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-xs text-[#991B1B]">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <LuCircleAlert size={16} className="flex-none" /> {backRejected ? 'Passport not matched' : "This page can't be used"}
            </p>
            <p className="mt-1 font-medium">
              {/* The heading already says it — drop the server's "Passport not matched — " lead-in. */}
              {rejected.message.replace(/^Passport not matched\s*[—-]\s*/, '').replace(/^\w/, (c) => c.toUpperCase())}
            </p>
            {rejected.issues.length > 1 && (
              <ul className="mt-1 list-disc pl-4">
                {rejected.issues.slice(1).map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
            <p className="mt-1">
              {backRejected
                ? 'Remove it and upload the back page of the same passport — you can’t continue until the passport numbers match.'
                : 'Remove the file and upload the correct page — it will scan again automatically.'}
            </p>
          </div>
        )}

        {/* Front read but no passport number — the back can't be checked yet. */}
        {hasFront && !passportNumber && !rejected && !scanning && (
          <div className="mt-3 rounded-lg border border-agent-accent/40 bg-agent-accent-soft px-3 py-2.5 text-xs text-agent-accent-dark">
            <p className="font-semibold">The passport number couldn&apos;t be read from the front page.</p>
            <p className="mt-0.5">
              Replace it with a clearer photo (flat, in focus, no glare on the code lines), or enter the passport number on the details page
              first — the back page is matched against it.
            </p>
          </div>
        )}

        {step === 'front' && frontRead && !rejected && !scanning && (
          <div role="status" className="mt-3 flex items-center gap-2 rounded-lg border border-[#BFE3D5] bg-[#EEF8F4] px-3 py-2.5 text-xs text-[#0F5E47]">
            <LuCircleCheck size={16} className="flex-none" />
            <p>
              <span className="font-semibold">Front page verified ✓ — passport number {passportNumber}.</span> Opening the back page…
            </p>
          </div>
        )}
        {step === 'back' && !backMatched && !rejected && !scanning && (
          <p className="mt-3 text-xs text-agent-muted">The back page is checked automatically — it must show passport number {passportNumber}.</p>
        )}

        {backMatched && !scanning && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#BFE3D5] bg-[#EEF8F4] px-3 py-2.5 text-xs text-[#0F5E47]">
            <LuCircleCheck size={16} className="mt-px flex-none" />
            <p>
              <span className="font-semibold">Passport matched.</span> The front and back pages both show passport number{' '}
              {backCheck.passportNumber}.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-agent-muted">
            {!hasFront ? 'Scanning starts as soon as you add the front page.' : !backMatched ? 'The back page is needed before you can continue.' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {hasFront && !passportNumber && (
              <Button onClick={() => onScanned(current)} disabled={!!scanning}>
                Enter passport number
              </Button>
            )}
            {backMatched && (
              <Button onClick={() => onScanned(current)} disabled={!!scanning}>
                Review details
              </Button>
            )}
          </div>
        </div>

        {scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-white/95 px-6">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-agent-accent/30" />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-agent-ink text-white">
                <LuFileText size={24} />
              </span>
            </div>
            <p className="text-sm font-bold text-agent-ink">{scanning === 'back' ? 'Checking the back page…' : 'Scanning the front page…'}</p>
            <ul className="w-full max-w-xs space-y-1.5">
              {SCAN_STEPS[scanning].map((label, i) => (
                <li
                  key={label}
                  className={`flex items-center gap-2 text-xs transition ${i <= scanStep ? 'text-agent-ink' : 'text-agent-muted/60'}`}
                >
                  {i < scanStep ? (
                    <LuCheck size={14} className="text-[#047857]" />
                  ) : i === scanStep ? (
                    <LuLoader size={14} className="animate-spin" />
                  ) : (
                    <span className="mx-[5px] h-1 w-1 rounded-full bg-current" />
                  )}
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
