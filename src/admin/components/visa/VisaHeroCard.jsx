import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LuCloudUpload, LuImage, LuRefreshCw, LuTrash2 } from 'react-icons/lu';
import { api } from '../../api/client.js';
import ConfirmDialog from '../../../shared/components/ConfirmDialog.jsx';
import { ErrorText } from '../ui.jsx';
import { SetupButton, SetupCard } from './setupUi.jsx';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;

// The agent "Apply for Visa" page's hero image — only ever ONE, and not part
// of any visa package. GET/POST/DELETE /admin/visa/hero.
export function VisaHeroCard() {
  const inputRef = useRef(null);
  const [hero, setHero] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    api
      .get('/admin/visa/hero')
      .then(({ hero: h }) => setHero(h))
      .catch((err) => setError(err.message || 'Unable to load the hero image'))
      .finally(() => setLoading(false));
  }, []);

  async function upload(file) {
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) return setError('The hero image must be a JPG, PNG or WebP.');
    if (file.size > MAX_BYTES) return setError('That image is over 10 MB.');
    setError('');
    setBusy('upload');
    try {
      const form = new FormData();
      form.append('image', file);
      const { hero: h } = await api.post('/admin/visa/hero', form);
      setHero(h);
    } catch (err) {
      setError(err.message || 'Unable to upload the image');
    } finally {
      setBusy('');
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  // Asked first in the shared ConfirmDialog; a failure shows there.
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function remove() {
    setError('');
    setBusy('remove');
    try {
      const { hero: h } = await api.del('/admin/visa/hero');
      setHero(h);
      setConfirmRemove(false);
    } finally {
      setBusy('');
    }
  }

  const imageUrl = hero?.imageUrl;

  return (
    <SetupCard title="Agent Visa page hero image">
      <p className="-mt-2 mb-5 text-sm text-[#64748B]">
        One image shown at the top of the agent&apos;s Apply for Visa page. It isn&apos;t part of any visa package. A wide landscape photo
        (about 1600 × 500 px) works best.
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files?.[0]);
        }}
        className={`relative overflow-hidden rounded-xl border-2 border-dashed transition ${
          dragging ? 'border-[#4F46E5] bg-[#EEF0FF]' : imageUrl ? 'border-transparent' : 'border-[#C7D2FE] bg-[#F8F9FF]'
        }`}
      >
        {loading ? (
          <div className="aspect-[16/5] w-full animate-pulse bg-[#EEF0FF]" />
        ) : imageUrl ? (
          <div className="relative aspect-[16/5] w-full">
            <img src={imageUrl} alt="Visa page hero" className="h-full w-full object-cover" />
            <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
              Live on the agent Visa page
            </span>
            {busy === 'upload' && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-[#172554]">Uploading…</span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!!busy}
            className="flex aspect-[16/5] w-full flex-col items-center justify-center gap-2 text-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E0E7FF] text-[#4F46E5]">
              {busy ? <LuCloudUpload size={20} className="animate-pulse" /> : <LuImage size={20} />}
            </span>
            <span className="text-sm font-semibold text-[#172554]">{busy ? 'Uploading…' : 'Drop the hero image here, or click to choose'}</span>
            <span className="text-xs text-[#64748B]">JPG, PNG or WebP · up to 10 MB · only one image</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <ErrorText>{error}</ErrorText>
      {imageUrl && (
        <div className="mt-5 flex flex-wrap gap-3">
          <SetupButton tone="ghost" disabled={!!busy} onClick={() => inputRef.current?.click()}>
            <LuRefreshCw size={15} /> {busy === 'upload' ? 'Uploading…' : 'Replace image'}
          </SetupButton>
          <SetupButton tone="danger" disabled={!!busy} onClick={() => setConfirmRemove(true)}>
            <LuTrash2 size={15} /> {busy === 'remove' ? 'Removing…' : 'Remove'}
          </SetupButton>
        </div>
      )}
      <AnimatePresence>
        {confirmRemove && (
          <ConfirmDialog
            title="Remove the hero image?"
            confirmLabel="Remove image"
            busyLabel="Removing…"
            onCancel={() => setConfirmRemove(false)}
            onConfirm={remove}
          >
            Agents will see the plain header on the Apply for Visa page until you upload a new one.
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </SetupCard>
  );
}
