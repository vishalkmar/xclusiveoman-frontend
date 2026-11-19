import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  LuBookUser,
  LuCalendarClock,
  LuCalendarDays,
  LuCalendarRange,
  LuChevronDown,
  LuCircleDot,
  LuFileText,
  LuImage,
  LuImagePlus,
  LuInfo,
  LuListFilter,
  LuLuggage,
  LuPencil,
  LuPlus,
  LuRotateCcw,
  LuTrash2,
  LuX,
} from 'react-icons/lu';
import { api } from '../../api/client.js';
import ConfirmDialog from '../../../shared/components/ConfirmDialog.jsx';
import { ErrorText } from '../ui.jsx';
import { EmptyStateArt, SetupButton, StatusPill, inputClass } from './setupUi.jsx';

// Create Visa → Visa Packages: admin-made visa cards. Each has a duration, an
// entry type, how long it's valid for and the maximum stay — all required.
// Every field is a dropdown of presets plus "Custom…", and every package
// has an image (required — shown on the cards here and on the agent Apply
// for Visa page). Saved as multipart form data. /admin/visa/packages.
//
// The page shows only the cards; "Create Visa" (in the page's tab row,
// VisaSetup.jsx — it bumps `createRequest`) opens the form in a pop-up, and
// a card's Edit opens the same pop-up filled in.

const FIELDS = [
  {
    key: 'durationDays',
    label: 'Duration',
    hint: 'Choose the visa duration.',
    placeholder: 'Select duration',
    icon: LuCalendarDays,
    presets: [10, 30, 90],
    days: true,
  },
  {
    key: 'entryType',
    label: 'Entry type',
    hint: 'Choose the allowed number of entries.',
    placeholder: 'Select entry type',
    icon: LuFileText,
    presets: ['Single-Entry', 'Double-Entry', 'Multiple-Entry'],
  },
  {
    key: 'validForDays',
    label: 'Valid for',
    hint: 'Select the period during which the visa can be used.',
    placeholder: 'Select validity period',
    icon: LuCalendarRange,
    presets: [50, 70, 90],
    days: true,
  },
  {
    key: 'maxStayDays',
    label: 'Maximum stay of',
    formLabel: 'Maximum stay',
    hint: 'Select the maximum allowed stay per visit.',
    placeholder: 'Select maximum stay',
    icon: LuCalendarClock,
    presets: [5, 10],
    days: true,
  },
];
const byKey = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
// Pop-up layout: Duration | Entry type, then Valid for | Maximum stay.
const FORM_ORDER = ['durationDays', 'entryType', 'validForDays', 'maxStayDays'];

const EMPTY = { durationDays: null, entryType: '', validForDays: null, maxStayDays: null, isActive: true };

const daysLabel = (n) => `${n} ${Number(n) === 1 ? 'day' : 'days'}`;
const fieldValue = (field, v) => (field.days ? daysLabel(v) : v);

const CUSTOM = '__custom__';

// One required field: icon + label, a dropdown of the presets plus
// "Custom…" (which shows a small input for any other value), and a hint.
function DropdownField({ field, value, onChange }) {
  const isPreset = value !== null && value !== '' && field.presets.includes(value);
  const [custom, setCustom] = useState(() => value !== null && value !== '' && !isPreset);
  const [draft, setDraft] = useState(() => (value !== null && value !== '' && !isPreset ? String(value) : ''));
  const Icon = field.icon;
  const id = `visa-field-${field.key}`;
  const selectValue = custom ? CUSTOM : isPreset ? String(value) : '';

  function pick(v) {
    if (v === CUSTOM) {
      setCustom(true);
      onChange(field.days ? (draft ? Number(draft) : null) : draft.trim());
      return;
    }
    setCustom(false);
    onChange(field.days ? Number(v) : v);
  }

  function typeCustom(text) {
    if (field.days) {
      const digits = text.replace(/\D/g, '').slice(0, 4);
      setDraft(digits);
      onChange(digits ? Number(digits) : null);
    } else {
      setDraft(text);
      onChange(text.trim());
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-2 flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[#EEF0FF] text-[#4F46E5]">
          <Icon size={16} />
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#172554]">
          {field.formLabel || field.label} <span className="text-[#D92D20]">*</span>
        </span>
      </label>
      <div className="relative">
        <select
          id={id}
          value={selectValue}
          onChange={(e) => pick(e.target.value)}
          className={`h-11 w-full cursor-pointer appearance-none rounded-xl border border-[#D7DDF5] bg-white pl-4 pr-11 text-sm transition hover:border-[#C7D2FE] focus:border-[#4F46E5] focus:outline-none focus:ring-4 focus:ring-[#4F46E5]/12 ${
            selectValue ? 'text-[#172554]' : 'text-[#64748B]'
          }`}
        >
          <option value="" disabled>
            {field.placeholder}
          </option>
          {field.presets.map((p) => (
            <option key={p} value={String(p)}>
              {fieldValue(field, p)}
            </option>
          ))}
          <option value={CUSTOM}>Custom…</option>
        </select>
        <LuChevronDown size={18} aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#172554]" />
      </div>
      {custom && (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            inputMode={field.days ? 'numeric' : 'text'}
            maxLength={field.days ? 4 : 60}
            placeholder={field.days ? 'Number of days' : 'e.g. Transit (single)'}
            value={draft}
            onChange={(e) => typeCustom(e.target.value)}
            aria-label={`Custom ${field.label.toLowerCase()}`}
            className={`${inputClass} h-10`}
          />
          {field.days && <span className="text-sm text-[#64748B]">days</span>}
        </div>
      )}
      <p className="mt-1.5 text-xs text-[#64748B] [@media(max-height:820px)]:hidden">{field.hint}</p>
    </div>
  );
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Required image: drop zone, or a preview of the chosen / current image with
// "Change image". Validates type and size before anything is uploaded.
function ImageField({ file, currentUrl, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(f) {
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) return setError('Use a JPG, PNG or WebP image.');
    if (f.size > MAX_IMAGE_BYTES) return setError('The image must be under 10 MB.');
    setError('');
    onChange(f);
  }

  const shown = preview || currentUrl;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[#EEF0FF] text-[#4F46E5]">
          <LuImage size={16} />
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#172554]">
          Visa image <span className="text-[#D92D20]">*</span>
        </span>
      </div>
      {shown ? (
        <div className="flex items-center gap-4 rounded-xl border border-[#D7DDF5] bg-[#F8F9FF] p-2.5">
          <img src={shown} alt="Visa package" className="h-14 w-24 flex-none rounded-lg object-cover ring-1 ring-[#E4E9FB]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#172554]">{file ? file.name : 'Current image'}</p>
            <p className="text-[13px] text-[#64748B]">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Kept unless you choose another'}</p>
          </div>
          <SetupButton tone="ghost" onClick={() => inputRef.current?.click()}>
            Change image
          </SetupButton>
        </div>
      ) : (
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
          className={`flex w-full items-center justify-center gap-3.5 rounded-xl border-2 border-dashed px-5 py-3 text-left transition ${
            dragging ? 'border-[#4F46E5] bg-[#EEF0FF]' : 'border-[#D7DDF5] bg-white hover:border-[#4F46E5] hover:bg-[#F8F9FF]'
          }`}
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#EEF0FF] text-[#4F46E5]">
            <LuImagePlus size={18} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-[#172554]">Choose an image or drop it here</span>
            <span className="block text-xs text-[#64748B]">JPG, PNG or WebP · up to 10 MB · landscape works best</span>
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        aria-label="Visa image"
        className="hidden"
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <p className={`mt-1.5 text-xs ${error ? 'font-medium text-[#D92D20]' : 'text-[#64748B] [@media(max-height:820px)]:hidden'}`}>
        {error || 'Shown on the visa card agents choose from.'}
      </p>
    </div>
  );
}

// On/off switch for "Active".
function ActiveSwitch({ checked, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Active"
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-[52px] flex-none rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4F46E5]/20 ${
          checked ? 'bg-[#4F46E5]' : 'bg-[#CBD2E6]'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[28px]' : 'left-1'}`}
        />
      </button>
      <span className="text-sm font-bold text-[#172554]">Active</span>
      <span className="text-xs text-[#64748B]">Available to agents</span>
    </div>
  );
}

function missingFields(form) {
  return FIELDS.filter((f) => (f.days ? !(Number(form[f.key]) > 0) : !String(form[f.key] || '').trim())).map((f) => f.label);
}

function PackageForm({ editing, onSaved, onCancel }) {
  const [form, setForm] = useState(() =>
    editing
      ? {
          durationDays: editing.durationDays,
          entryType: editing.entryType,
          validForDays: editing.validForDays,
          maxStayDays: editing.maxStayDays,
          isActive: editing.isActive,
          priceMode: editing.priceMethod || editing.priceMode || 'global',
          customPrice: editing.customPrice == null ? '' : editing.customPrice,
        }
      : { ...EMPTY, priceMode: 'global', customPrice: '' }
  );
  const [image, setImage] = useState(null); // the newly chosen File
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const hasImage = !!image || !!editing?.imageUrl;

  async function submit(e) {
    e.preventDefault();
    const missing = [...missingFields(form), ...(hasImage ? [] : ['Visa image'])];
    if (form.priceMode === 'custom' && !(Number(form.customPrice) > 0)) missing.push('Custom visa fee');
    if (missing.length) return setError(`Please fill in: ${missing.join(', ')}.`);
    setError('');
    setSaving(true);
    try {
      const body = new FormData();
      body.append('durationDays', String(Number(form.durationDays)));
      body.append('entryType', String(form.entryType).trim());
      body.append('validForDays', String(Number(form.validForDays)));
      body.append('maxStayDays', String(Number(form.maxStayDays)));
      body.append('isActive', String(!!form.isActive));
      body.append('priceMode', form.priceMode || 'global');
      body.append('priceMethod', form.priceMode || 'global');
      if (form.priceMode === 'custom') body.append('customPrice', String(Number(form.customPrice)));
      if (image) body.append('image', image, image.name);
      const { package: saved } = editing
        ? await api.putForm(`/admin/visa/packages/${editing.id}`, body)
        : await api.postForm('/admin/visa/packages', body);
      onSaved(saved);
    } catch (err) {
      setError(err.message || 'Unable to save the visa package');
    } finally {
      setSaving(false);
    }
  }

  const ready = missingFields(form).length === 0 && hasImage;
  const set = (key) => (v) => setForm((s) => ({ ...s, [key]: v }));

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        {FORM_ORDER.map((key) => (
          <DropdownField key={key} field={byKey[key]} value={form[key]} onChange={set(key)} />
        ))}
      </div>

      <div className="mt-4">
        <ImageField file={image} currentUrl={editing?.imageUrl || ''} onChange={setImage} />
      </div>

      <div className="mt-4 rounded-lg border border-[#E4E9FB] bg-[#FAFBFF] p-4">
        <div className="text-sm font-semibold text-[#172554]">Visa fee</div>
        <p className="mt-0.5 text-xs text-[#64748B]">Use the admin default or set a custom price for this visa.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select value={form.priceMode} onChange={(e) => setForm((s) => ({ ...s, priceMode: e.target.value }))} className={inputClass} aria-label="Visa price method">
            <option value="global">Admin configured (default)</option>
            <option value="custom">Custom</option>
          </select>
          {form.priceMode === 'custom' && <input type="number" min="0" step="0.001" value={form.customPrice} onChange={(e) => setForm((s) => ({ ...s, customPrice: e.target.value }))} className={inputClass} placeholder="Custom price in OMR" aria-label="Custom visa price" />}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <ActiveSwitch checked={form.isActive} onChange={set('isActive')} />
        <div className="flex items-center gap-2 rounded-lg bg-[#EEF0FF] px-3 py-2 text-xs text-[#172554]">
          <LuInfo size={16} className="flex-none text-[#4F46E5]" />
          <p>
            Visa fee:{' '}
            <Link to="/admin/package-controller?tab=visa" className="font-semibold text-[#4F46E5] hover:underline">
              Payments → Package Controller → Visa
            </Link>
          </p>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[#E4E9FB] pt-3.5">
        <SetupButton type="submit" disabled={saving || !ready} className="!px-6">
          {!saving && !editing && <LuPlus size={18} />}
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Create Visa'}
        </SetupButton>
        <SetupButton tone="ghost" onClick={onCancel} disabled={saving} className="!px-6">
          Cancel
        </SetupButton>
        <span className="border-l border-[#E4E9FB] pl-4 text-sm text-[#64748B]">All fields are required.</span>
      </div>
    </form>
  );
}

// The create / edit form in a pop-up (Esc, the backdrop or ✕ close it).
function PackageDialog({ editing, onSaved, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F172A]/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="visa-package-dialog-title"
        initial={{ y: 16, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 16, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="relative w-full max-w-[820px] rounded-2xl border border-[#E4E9FB] bg-white p-5 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)] sm:px-7 sm:py-5"
      >
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-[#E4E9FB] pb-3.5">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-[#EEF0FF] text-[#4F46E5]">
              <LuBookUser size={22} />
            </span>
            <div>
              <h3 id="visa-package-dialog-title" className="text-xl font-bold text-[#172554]">
                {editing ? 'Edit visa package' : 'Create Visa'}
              </h3>
              <p className="mt-0.5 text-sm text-[#64748B]">
                {editing ? `${daysLabel(editing.durationDays)} · ${editing.entryType}` : 'Add a visa package agents can apply for.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#EEF0FF] text-[#172554] transition hover:bg-[#E0E7FF]"
          >
            <LuX size={18} />
          </button>
        </div>
        <PackageForm key={editing?.id || 'new'} editing={editing} onSaved={onSaved} onCancel={onClose} />
      </motion.div>
    </motion.div>
  );
}

// Edit / Delete actions shown directly on the static card face.
function CardActions({ pkg, onEdit, onDelete, onImage = false }) {
  return (
    <>
      <button
        type="button"
        onClick={() => onEdit(pkg)}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
          onImage ? 'bg-white/95 text-[#4F46E5] hover:bg-white' : 'text-[#4F46E5] hover:bg-[#EEF0FF]'
        }`}
      >
        <LuPencil size={13} /> Edit
      </button>
      <button
        type="button"
        onClick={() => onDelete(pkg)}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
          onImage ? 'bg-white/95 text-[#B42318] hover:bg-white' : 'text-[#B42318] hover:bg-[#FEF3F2]'
        }`}
      >
        <LuTrash2 size={13} /> Delete
      </button>
    </>
  );
}

// A static visa package card. The image and all required package information
// are kept on the same face so the card never flips on hover or focus.
function PackageCard({ pkg, onEdit, onDelete, editing }) {
  const frame = `rounded-2xl border shadow-[0_6px_24px_rgba(30,41,99,0.06)] ${
    editing ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/20' : 'border-[#E4E9FB]'
  }`;
  return (
    <div className={`relative h-full overflow-hidden ${pkg.isActive ? '' : 'opacity-75'} ${frame}`}>
      {pkg.imageUrl ? <img src={pkg.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF]" />}
      <span className="absolute inset-0 bg-gradient-to-t from-[#172554]/95 via-[#172554]/45 to-[#172554]/20" />
      <div className="relative flex min-h-48 flex-col justify-between p-4 text-white">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Visa package</div>
            <div className="mt-0.5 text-lg font-bold leading-tight">{daysLabel(pkg.durationDays)} visa</div>
          </div>
          <StatusPill active={pkg.isActive} />
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2">
          {FIELDS.map((f) => <div key={f.key}><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/65">{f.label}</dt><dd className="truncate text-[13px] font-bold">{fieldValue(f, pkg[f.key])}</dd></div>)}
        </dl>
        <div className="mt-3 border-t border-white/20 pt-2 text-[11px] font-semibold text-white/80">
          Visa fee: {pkg.priceMode === 'custom' && pkg.customPrice != null ? `Custom · OMR ${Number(pkg.customPrice).toFixed(3)}` : 'Admin configured default'}
        </div>
        {!pkg.imageUrl && <p className="mt-3 text-[11px] font-semibold text-[#FECACA]"><LuImage size={12} className="mr-1 inline" />No image — add one with Edit</p>}
        <div className="mt-4 flex justify-end gap-2"><CardActions pkg={pkg} onEdit={onEdit} onDelete={onDelete} onImage={!!pkg.imageUrl} /></div>
      </div>
    </div>
  );
}

function EmptyPackages({ onCreate }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E4E9FB] bg-[#F8F9FF] px-4 py-8 text-center">
      <EmptyStateArt />
      <div className="relative flex flex-col items-center gap-1.5">
        <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#E0E7FF] text-[#4F46E5]">
          <LuLuggage size={22} />
        </span>
        <p className="text-lg font-bold text-[#172554]">No visa packages yet</p>
        <p className="text-sm text-[#64748B]">Create the first one to get started.</p>
        <SetupButton className="mt-3" onClick={onCreate}>
          <LuPlus size={16} /> Create Visa
        </SetupButton>
      </div>
    </div>
  );
}

// ── Filters ─────────────────────────────────────────────────────────────
// Status, entry type and the three day counts. Each dropdown always lists
// the standard options (the same presets as the Create Visa form) plus any
// custom value a package uses, sorted, each with how many packages have it.
const NO_FILTERS = { status: 'all', entryType: 'all', durationDays: 'all', validForDays: 'all', maxStayDays: 'all' };
const DAY_FILTERS = [
  ['durationDays', 'Duration', 'All durations', LuCalendarDays],
  ['validForDays', 'Valid for', 'Any validity', LuCalendarRange],
  ['maxStayDays', 'Maximum stay', 'Any stay', LuCalendarClock],
];

// The presets of a field + any other values the packages use.
function optionValues(packages, key) {
  const values = new Set([...byKey[key].presets, ...packages.map((p) => p[key])]);
  const list = [...values].filter((v) => v !== null && v !== undefined && v !== '');
  return byKey[key].days ? list.sort((a, b) => a - b) : list;
}

function countBy(list, key) {
  const counts = new Map();
  for (const p of list) counts.set(p[key], (counts.get(p[key]) || 0) + 1);
  return counts;
}

function matches(p, f) {
  if (f.status === 'active' && !p.isActive) return false;
  if (f.status === 'inactive' && p.isActive) return false;
  if (f.entryType !== 'all' && p.entryType !== f.entryType) return false;
  for (const [key] of DAY_FILTERS) if (f[key] !== 'all' && String(p[key]) !== f[key]) return false;
  return true;
}

function FilterSelect({ id, label, Icon, value, onChange, children }) {
  const on = value !== 'all';
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7C8BA1]">{label}</span>
      <span className="relative">
        <Icon size={15} aria-hidden className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${on ? 'text-[#4F46E5]' : 'text-[#94A3B8]'}`} />
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-10 w-full cursor-pointer appearance-none rounded-xl border bg-white pl-9 pr-9 text-sm transition focus:outline-none focus:ring-4 focus:ring-[#4F46E5]/12 ${
            on ? 'border-[#4F46E5] font-semibold text-[#172554]' : 'border-[#D7DDF5] text-[#334155] hover:border-[#C7D2FE]'
          }`}
        >
          {children}
        </select>
        <LuChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
      </span>
    </label>
  );
}

function PackageFilters({ packages, filters, onChange, shown }) {
  const set = (key) => (value) => onChange({ ...filters, [key]: value });
  const active = packages.filter((p) => p.isActive).length;
  const entryCounts = countBy(packages, 'entryType');
  // Presets first (Single / Double / Multiple), then custom labels A–Z.
  const presetTypes = byKey.entryType.presets;
  const entryTypes = [...presetTypes, ...[...entryCounts.keys()].filter((t) => !presetTypes.includes(t)).sort((a, b) => a.localeCompare(b))];
  const filtered = Object.keys(NO_FILTERS).some((k) => filters[k] !== 'all');

  return (
    <div className="rounded-2xl border border-[#E4E9FB] bg-white p-4 shadow-[0_6px_24px_rgba(30,41,99,0.05)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-[#172554]">
          <LuListFilter size={16} className="text-[#4F46E5]" /> Filters
        </p>
        <div className="flex items-center gap-3">
          <p className="text-sm text-[#64748B]" aria-live="polite">
            {filtered ? (
              <>
                Showing <span className="font-semibold text-[#172554]">{shown}</span> of {packages.length}{' '}
                {packages.length === 1 ? 'visa' : 'visas'}
              </>
            ) : (
              <>
                <span className="font-semibold text-[#172554]">{packages.length}</span> {packages.length === 1 ? 'visa' : 'visas'} ·{' '}
                {active} active
              </>
            )}
          </p>
          {filtered && (
            <button
              type="button"
              onClick={() => onChange(NO_FILTERS)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#4F46E5] hover:bg-[#EEF0FF]"
            >
              <LuRotateCcw size={13} /> Clear filters
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <FilterSelect id="visa-filter-status" label="Status" Icon={LuCircleDot} value={filters.status} onChange={set('status')}>
          <option value="all">All statuses ({packages.length})</option>
          <option value="active">Active ({active})</option>
          <option value="inactive">Inactive ({packages.length - active})</option>
        </FilterSelect>
        <FilterSelect id="visa-filter-entryType" label="Entry type" Icon={LuFileText} value={filters.entryType} onChange={set('entryType')}>
          <option value="all">All entry types</option>
          {entryTypes.map((t) => (
            <option key={t} value={t}>
              {t} ({entryCounts.get(t) || 0})
            </option>
          ))}
        </FilterSelect>
        {DAY_FILTERS.map(([key, label, allLabel, Icon]) => {
          const counts = countBy(packages, key);
          const values = optionValues(packages, key);
          return (
            <FilterSelect key={key} id={`visa-filter-${key}`} label={label} Icon={Icon} value={filters[key]} onChange={set(key)}>
              <option value="all">{allLabel}</option>
              {values.map((v) => (
                <option key={v} value={String(v)}>
                  {daysLabel(v)} ({counts.get(v) || 0})
                </option>
              ))}
            </FilterSelect>
          );
        })}
      </div>
    </div>
  );
}

function NoMatches({ onClear }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#D7DDF5] bg-white/70 px-4 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EEF0FF] text-[#4F46E5]">
        <LuListFilter size={20} />
      </span>
      <p className="text-base font-bold text-[#172554]">No visas match these filters</p>
      <p className="text-sm text-[#64748B]">Try another option, or clear the filters to see every visa.</p>
      <SetupButton tone="ghost" className="mt-2" onClick={onClear}>
        <LuRotateCcw size={15} /> Clear filters
      </SetupButton>
    </div>
  );
}

export function VisaPackagesPanel({ createRequest = 0 }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // null = closed · 'new' = Create Visa · a package = editing it.
  const [dialog, setDialog] = useState(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [deleting, setDeleting] = useState(null); // package waiting for delete confirmation

  useEffect(() => {
    api
      .get('/admin/visa/packages')
      .then(({ packages: list }) => setPackages(list || []))
      .catch((err) => setError(err.message || 'Unable to load visa packages'))
      .finally(() => setLoading(false));
  }, []);

  // "Create Visa" in the tab row.
  useEffect(() => {
    if (createRequest) setDialog('new');
  }, [createRequest]);

  // Delete asks first in the shared ConfirmDialog (not window.confirm); a
  // failed delete shows its error in that pop-up.
  async function confirmDelete() {
    const pkg = deleting;
    await api.del(`/admin/visa/packages/${pkg.id}`);
    setPackages((list) => list.filter((p) => p.id !== pkg.id));
    setDeleting(null);
  }

  const editing = dialog && dialog !== 'new' ? dialog : null;
  const visible = useMemo(() => packages.filter((p) => matches(p, filters)), [packages, filters]);

  // A custom filter value no longer used by any package (edited or deleted)
  // falls back to "all"; the standard options always stay.
  useEffect(() => {
    setFilters((f) => {
      const next = { ...f };
      const gone = (key, v) => !byKey[key].presets.some((x) => String(x) === v) && !packages.some((p) => String(p[key]) === v);
      if (f.entryType !== 'all' && gone('entryType', f.entryType)) next.entryType = 'all';
      for (const [key] of DAY_FILTERS) if (f[key] !== 'all' && gone(key, f[key])) next[key] = 'all';
      return Object.keys(next).some((k) => next[k] !== f[k]) ? next : f;
    });
  }, [packages]);

  return (
    <div className="space-y-5">
      {loading ? (
        <p className="text-sm font-semibold text-[#64748B]">Loading…</p>
      ) : (
        packages.length > 0 && <PackageFilters packages={packages} filters={filters} onChange={setFilters} shown={visible.length} />
      )}

      <ErrorText>{error}</ErrorText>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border border-[#E4E9FB] bg-white/70" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <EmptyPackages onCreate={() => setDialog('new')} />
      ) : visible.length === 0 ? (
        <NoMatches onClear={() => setFilters(NO_FILTERS)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <PackageCard key={p.id} pkg={p} editing={editing?.id === p.id} onEdit={setDialog} onDelete={setDeleting} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {deleting && (
          <ConfirmDialog
            key="delete-visa"
            title="Delete this visa?"
            confirmLabel="Delete visa"
            onCancel={() => setDeleting(null)}
            onConfirm={confirmDelete}
          >
            The <span className="font-semibold text-[#101828]">{daysLabel(deleting.durationDays)} {deleting.entryType}</span> visa will be
            removed for agents straight away, along with its image. Applications already made with it keep their details. This
            can&apos;t be undone.
          </ConfirmDialog>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dialog && (
          <PackageDialog
            key="visa-package-dialog"
            editing={editing}
            onClose={() => setDialog(null)}
            onSaved={(saved) => {
              setPackages((list) => (list.some((p) => p.id === saved.id) ? list.map((p) => (p.id === saved.id ? saved : p)) : [...list, saved]));
              setDialog(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
