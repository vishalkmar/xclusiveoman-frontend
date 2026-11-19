import { useEffect, useState } from 'react';
import { FiAlertTriangle, FiEdit2, FiImage, FiRotateCcw, FiTrash2, FiX } from 'react-icons/fi';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, Textarea, TextInput } from '../components/ui.jsx';
import { ImageUpload } from '../../shared/components/ImageUpload.jsx';
import { ACTIVITIES, ACTIVITY_SLOT_KEYS, GALLERY_CATEGORIES, SIGNATURE_TOUR_SLOT_KEYS, SIGNATURE_TOURS, TRANSFER_SLOT_KEYS, TRANSFERS, resolveLandingCard } from '../../shared/components/landing/data.js';
import { SignatureTourCard } from '../../shared/components/landing/components/SignatureTourCard.jsx';
import { TourCard } from '../../shared/components/landing/components/TourCard.jsx';

function imageUrl(item) { return item?.imageUrl || item?.image_url || ''; }

// A File or image URL -> { width, height } in pixels, or null if it can't be
// read (e.g. a pasted link the browser can't load).
function measureImage(entry) {
  return new Promise((resolve) => {
    const src = typeof entry === 'string' ? entry : URL.createObjectURL(entry);
    const img = new Image();
    const done = (size) => {
      if (typeof entry !== 'string') URL.revokeObjectURL(src);
      resolve(size);
    };
    img.onload = () => done(img.naturalWidth && img.naturalHeight ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => done(null);
    img.src = src;
  });
}

// Landing page (Hero.jsx) background — the public page reads the first
// 'landing-hero' gallery item and falls back to this /public image when
// there is none.
const LANDING_HERO_KEY = 'landing-hero';
const LANDING_HERO_FALLBACK = '/HeroImage.png';

function LandingHeroCard({ item, onUpload, onChange, onReset }) {
  const current = imageUrl(item);

  return (
    <Card className="overflow-hidden border-[#D7DDF0] p-0">
      <div className="border-b border-[#E4E9FB] bg-[#F8F9FF] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">Landing page</p>
        <h2 className="mt-1 text-lg font-bold text-ink">Landing Page Hero</h2>
        <p className="mt-1 max-w-2xl text-xs text-muted">The full-width background image behind the "Your ground Partner for Selling Oman" headline at the top of the public landing page. Without an upload, the default image is shown.</p>
      </div>
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <div className="relative overflow-hidden rounded-lg border border-[#E4E9FB] bg-[#1B2333]">
          <img src={current || LANDING_HERO_FALLBACK} alt="Landing page hero" className="aspect-[16/7] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
          <div className="absolute bottom-4 left-4 text-white">
            <p className="text-[10px] font-medium text-white/80">Best B2B Partner · Sultanate of Oman</p>
            <p className="mt-1 text-lg font-semibold leading-tight">Your ground <span className="font-serif italic text-[#E8B84B]">Partner</span> for Selling</p>
          </div>
          <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold ${current ? 'bg-emerald-50 text-emerald-700' : 'bg-white/90 text-[#172554]'}`}>
            {current ? 'Custom image' : 'Default image'}
          </span>
        </div>
        <div className="space-y-4">
          <ImageUpload label="Hero background image" value={current} onChange={onChange} onUpload={onUpload} hint="Recommended: wide landscape image, at least 1920px wide." />
          {current && (
            <button type="button" onClick={onReset} className="inline-flex items-center gap-2 rounded-md border border-[#E4E9FB] bg-white px-3 py-2 text-xs font-semibold text-[#A5162D] hover:border-[#A5162D] hover:bg-rose-50">
              <FiRotateCcw size={13} /> Reset to default image
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// In-app pop-ups — this page never uses window.alert/confirm/prompt.
function Popup({ title, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/35" onClick={onClose} />
      <div role="dialog" aria-modal="true" className={`relative z-10 flex max-h-[90vh] w-full ${size === 'xl' ? 'max-w-4xl' : 'max-w-md'} flex-col rounded-lg border border-line-light bg-white shadow-2xl`}>
        <div className="flex items-start justify-between gap-3 border-b border-line-light px-5 py-4">
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-ink"><FiX size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line-light px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

// `confirm` = { title, message, confirmLabel, busyLabel, onConfirm } — the
// pop-up stays open (with its own error) if onConfirm throws.
function ConfirmPopup({ confirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setError('');
    setBusy(true);
    try {
      await confirm.onConfirm();
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <Popup
      title={confirm.title}
      onClose={busy ? () => {} : onClose}
      footer={<><Button type="button" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="danger" type="button" disabled={busy} onClick={run}>{busy ? confirm.busyLabel || 'Working…' : confirm.confirmLabel}</Button></>}
    >
      <div className="flex gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-rose-50 text-[#A5162D]"><FiAlertTriangle size={17} /></span>
        <p className="text-sm text-muted">{confirm.message}</p>
      </div>
      <ErrorText>{error}</ErrorText>
    </Popup>
  );
}

// Landing page photo cards (Signature Tours, Activities, Transfers) — one
// editor per card. Every field is optional: whatever is left empty falls
// back to the card's built-in content (SIGNATURE_TOURS / ACTIVITIES /
// TRANSFERS), which the placeholders and live preview show.
const CARD_FIELDS = ['title', 'description', 'duration', 'nights', 'imageUrl'];
const EMPTY_CARD = { title: '', description: '', duration: '', nights: '', imageUrl: '' };

// The two landing sections built from these cards. `legacyCategory` is the
// old shared list each section used before per-card slots existed.
const LANDING_CARD_SECTIONS = [
  {
    key: 'tours',
    label: 'Signature Oman Tours',
    description: 'The three tour cards on the landing page. Change the photo, title, description, tour type and nights / days of each card.',
    cardNoun: 'tour card',
    typeLabel: 'Tour type',
    showNights: true,
    fallbacks: SIGNATURE_TOURS,
    slotKeys: SIGNATURE_TOUR_SLOT_KEYS,
    legacyCategory: 'landing-tours',
    gridClass: 'lg:grid-cols-3',
    CardComponent: SignatureTourCard,
  },
  {
    key: 'activities',
    label: 'Activities We Can Build Into Any Itinerary',
    description: 'The six activity cards on the landing page. Change the photo, title, description and activity type (duration pill) of each card.',
    cardNoun: 'activity card',
    typeLabel: 'Activity type',
    showNights: false,
    fallbacks: ACTIVITIES,
    slotKeys: ACTIVITY_SLOT_KEYS,
    legacyCategory: 'landing-activities',
    gridClass: 'lg:grid-cols-3',
    CardComponent: SignatureTourCard,
  },
  {
    key: 'transfers',
    label: 'Hassle Free Transfers',
    description: 'The two transfer cards on the landing page. Change the photo, title, description and transfer type of each card.',
    cardNoun: 'transfer card',
    typeLabel: 'Transfer type',
    showNights: false,
    fallbacks: TRANSFERS,
    slotKeys: TRANSFER_SLOT_KEYS,
    legacyCategory: 'landing-transfers',
    gridClass: 'lg:grid-cols-3',
    CardComponent: TourCard,
  },
];

// Once a card has its own slot item, the old shared list's item at its
// position is ignored (same rule as resolveLandingCard).
function cardFormFrom(slot, legacy) {
  const source = slot || legacy;
  return {
    title: source?.title || '',
    description: source?.description || '',
    duration: source?.duration || '',
    nights: slot?.nights || '',
    imageUrl: imageUrl(source),
  };
}

// Pop-up form for one landing card — live preview on the left, fields on
// the right. Nothing is saved until "Save card".
function LandingCardPopup({ title, fallback, saved, typeLabel, showNights, CardComponent, onUpload, onSave, onClose }) {
  const [form, setForm] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = CARD_FIELDS.some((field) => form[field] !== saved[field]);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function save() {
    setError('');
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to save this card.');
      setSaving(false);
    }
  }

  return (
    <Popup
      size="xl"
      title={title}
      onClose={saving ? () => {} : onClose}
      footer={<><Button type="button" disabled={saving} onClick={onClose}>Cancel</Button><Button variant="accent" type="button" disabled={saving || !dirty} onClick={save}>{saving ? 'Saving…' : 'Save card'}</Button></>}
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase text-muted">Live preview</p>
          <div className="pointer-events-none rounded-lg bg-[#F7F3EA] p-3">
            <CardComponent {...resolveLandingCard(fallback, form, null)} />
          </div>
          <p className="mt-2 text-[11px] text-muted">Empty fields use the default content shown in grey.</p>
        </div>
        <div className="space-y-3">
          <ImageUpload label="Card image" value={form.imageUrl} onChange={(url) => setForm((current) => ({ ...current, imageUrl: url || '' }))} onUpload={onUpload} hint="Landscape image. Leave empty to use the default photo." />
          {form.imageUrl && (
            <button type="button" onClick={() => setForm((current) => ({ ...current, imageUrl: '' }))} className="text-[11px] font-semibold text-muted hover:text-[#A5162D]">
              Use default photo instead
            </button>
          )}
          <label className="block text-[11px] font-semibold uppercase text-muted">Title<TextInput className="mt-1.5 normal-case" value={form.title} onChange={update('title')} placeholder={fallback.title} /></label>
          <label className="block text-[11px] font-semibold uppercase text-muted">Description<Textarea className="mt-1.5 min-h-28 normal-case" value={form.description} onChange={update('description')} placeholder={fallback.description} /></label>
          <div className={`grid gap-3 ${showNights ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <label className="block text-[11px] font-semibold uppercase text-muted">{typeLabel}<TextInput className="mt-1.5 normal-case" value={form.duration} onChange={update('duration')} placeholder={fallback.duration} /></label>
            {showNights && <label className="block text-[11px] font-semibold uppercase text-muted">Nights / Days<TextInput className="mt-1.5 normal-case" value={form.nights} onChange={update('nights')} placeholder={fallback.nights} /></label>}
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      </div>
    </Popup>
  );
}

// Compact tile for one landing card — shows what the landing page currently
// displays; editing happens in LandingCardPopup.
function LandingCardTile({ index, fallback, slot, legacy, onEdit, onReset }) {
  const saved = cardFormFrom(slot, legacy);
  const customised = slot ? CARD_FIELDS.some((field) => saved[field]) : Boolean(legacy);
  const card = resolveLandingCard(fallback, saved, null);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-[#E4E9FB] bg-white">
      <button type="button" onClick={onEdit} className="group relative block text-left" aria-label={`Edit card ${index + 1}`}>
        <img src={card.image} alt={card.title} className="aspect-[16/10] w-full object-cover transition group-hover:brightness-95" />
        <span className="absolute left-2.5 top-2.5 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold text-ink shadow-sm">Card {index + 1}</span>
        <span className={`absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm ${customised ? 'bg-emerald-50 text-emerald-700' : 'bg-white/95 text-muted'}`}>
          {customised ? 'Custom' : 'Default'}
        </span>
      </button>
      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-sm font-bold text-ink">{card.title}</p>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-medium text-muted">
          <span className="rounded-full bg-[#F1F4FB] px-2 py-0.5">{card.duration}</span>
          {card.nights && <span className="rounded-full bg-[#FBF3DE] px-2 py-0.5 text-[#8A6414]">{card.nights}</span>}
        </div>
        <p className="mt-2 line-clamp-2 text-xs text-muted">{card.description}</p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#E4E9FB] pt-2.5">
          {customised ? (
            <button type="button" onClick={onReset} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#A5162D] hover:underline">
              <FiRotateCcw size={12} /> Reset
            </button>
          ) : <span />}
          <Button variant="accent" type="button" onClick={onEdit}><FiEdit2 size={12} className="mr-1.5" /> Edit details</Button>
        </div>
      </div>
    </div>
  );
}

function LandingCardsEditor({ section, items, onUpload, onSave, onReset }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const legacyItems = items.filter((item) => (item.category || item.type) === section.legacyCategory);
  const slotFor = (index) => items.find((item) => (item.category || item.type) === section.slotKeys[index]);

  return (
    <Card className="overflow-hidden border-[#D7DDF0] p-0">
      <div className="border-b border-[#E4E9FB] bg-[#F8F9FF] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">Landing page</p>
        <h2 className="mt-1 text-lg font-bold text-ink">{section.label}</h2>
        <p className="mt-1 max-w-2xl text-xs text-muted">{section.description} Click a card to edit it; any field left empty uses the card's default content.</p>
      </div>
      <div className={`grid gap-4 p-5 sm:grid-cols-2 sm:p-6 ${section.gridClass}`}>
        {section.fallbacks.map((fallback, index) => (
          <LandingCardTile
            key={section.slotKeys[index]}
            index={index}
            fallback={fallback}
            slot={slotFor(index)}
            legacy={legacyItems[index]}
            onEdit={() => setEditingIndex(index)}
            onReset={() => onReset(section.slotKeys[index], `${section.cardNoun} ${index + 1}`)}
          />
        ))}
      </div>
      {editingIndex !== null && (
        <LandingCardPopup
          title={`Edit ${section.cardNoun} ${editingIndex + 1}`}
          fallback={section.fallbacks[editingIndex]}
          saved={cardFormFrom(slotFor(editingIndex), legacyItems[editingIndex])}
          typeLabel={section.typeLabel}
          showNights={section.showNights}
          CardComponent={section.CardComponent}
          onUpload={onUpload}
          onSave={(form) => onSave(section.slotKeys[editingIndex], form)}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </Card>
  );
}

// Orientation of a stored gallery photo (0106_gallery_item_orientation.sql):
// the admin's choice, else its measured pixel size. Older uploads have
// neither, so they show as "Not set" until switched.
function itemOrientation(item) {
  if (item.orientation === 'portrait' || item.orientation === 'landscape') return item.orientation;
  if (item.width && item.height) return item.height > item.width ? 'portrait' : 'landscape';
  return null;
}

const ORIENTATION_UPLOADS = [
  { key: 'landscape', label: 'Horizontal photos', hint: 'Landscape — wider than tall (e.g. 3:2, 4:3, 16:9). Shown as wide tiles.' },
  { key: 'portrait', label: 'Vertical photos', hint: 'Portrait — taller than wide (e.g. 2:3, 3:4, 4:5). Shown as tall tiles.' },
];

function GalleryThumb({ item, label, onDelete, onSetOrientation }) {
  // Older photos have no saved orientation; their box shape follows the
  // loaded image (as the public page does) while the badge still says
  // "Not set" so the admin can confirm it.
  const [detected, setDetected] = useState(null);
  const orientation = itemOrientation(item);
  const portrait = (orientation || detected) === 'portrait';
  const next = portrait ? 'landscape' : 'portrait';
  return (
    <div className={`group relative overflow-hidden rounded-lg border border-[#E4E9FB] bg-[#F1F3FA] ${portrait ? 'col-span-1 aspect-[3/4]' : 'col-span-2 aspect-[3/2]'}`}>
      {/* object-contain mirrors the public page: the whole photo, never cropped. */}
      <img
        src={imageUrl(item)}
        alt={label}
        onLoad={(event) => {
          const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
          if (!orientation && w && h) setDetected(h > w ? 'portrait' : 'landscape');
        }}
        className="absolute inset-0 h-full w-full object-contain"
      />
      <span className="absolute left-1.5 top-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-ink shadow-sm">
        {orientation === 'portrait' ? 'Vertical' : orientation === 'landscape' ? 'Horizontal' : 'Not set'}
      </span>
      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
        {/* Set orientation: a "Not set" photo offers both, others the switch. */}
        {(orientation ? [next] : ['landscape', 'portrait']).map((option) => (
          <button
            key={option}
            type="button"
            title={`Show as ${option === 'portrait' ? 'vertical' : 'horizontal'}`}
            aria-label={`Show as ${option === 'portrait' ? 'vertical' : 'horizontal'} photo`}
            onClick={() => onSetOrientation(item, option)}
            className="flex h-7 items-center justify-center rounded-full bg-white/95 px-2 text-[10px] font-semibold text-[#4F46E5] shadow-sm hover:bg-indigo-50"
          >
            {option === 'portrait' ? '↕ Vertical' : '↔ Horizontal'}
          </button>
        ))}
        <button
          type="button"
          title="Remove photo"
          aria-label="Remove photo"
          onClick={() => onDelete(item)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#A5162D] shadow-sm transition hover:bg-rose-50"
        >
          <FiTrash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// One public Gallery page section (Events, Tours, …) — images only. The
// public page shows exactly these uploads, with no built-in fallback photos.
// Photos are added as Horizontal or Vertical so the public grid gives each
// the right tile shape (components/GalleryPhotoTile.jsx) and none is cropped.
function GallerySectionCard({ category, items, onAdd, onDelete, onSetOrientation, notice }) {
  const counts = items.reduce((acc, item) => {
    const o = itemOrientation(item) || 'unset';
    acc[o] = (acc[o] || 0) + 1;
    return acc;
  }, {});
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start justify-between gap-4 border-b border-[#E4E9FB] bg-[#F8F9FF] px-5 py-4 sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">Gallery section</p>
          <h2 className="mt-1 text-lg font-bold text-ink">{category.label}</h2>
          <p className="mt-1 max-w-xl text-xs text-muted">{category.description}</p>
        </div>
        <span className="flex-none rounded-full bg-white px-3 py-1 text-right text-[11px] font-semibold text-[#4F46E5] shadow-sm">
          {items.length} photo{items.length === 1 ? '' : 's'}
          {items.length > 0 && (
            <span className="block text-[10px] font-medium text-muted">
              {counts.landscape || 0} horizontal · {counts.portrait || 0} vertical{counts.unset ? ` · ${counts.unset} not set` : ''}
            </span>
          )}
        </span>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        {items.length ? (
          // Same tile shapes as the public grid (wide = 2 columns, tall = 1).
          <div className="grid grid-flow-row-dense grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {items.map((item) => (
              <GalleryThumb key={item.id} item={item} label={category.label} onDelete={onDelete} onSetOrientation={onSetOrientation} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#D7DDF0] bg-[#FAFBFF] px-4 text-center text-xs text-muted">
            <FiImage size={20} className="text-[#A3AAC4]" />
            No photos yet — this section is hidden on the public Gallery page until you add some.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {ORIENTATION_UPLOADS.map((option) => (
            <ImageUpload
              key={option.key}
              label={`Add ${option.label.toLowerCase()}`}
              multiple
              value={[]}
              onChange={(urls) => urls.length && onAdd(urls, option.key)}
              onUpload={async (files) => {
                await onAdd(files, option.key);
                return [];
              }}
              hint={option.hint}
            />
          ))}
        </div>
        {notice && <p className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">{notice}</p>}
      </div>
    </Card>
  );
}

export default function GalleryManagement() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [notices, setNotices] = useState({});

  useEffect(() => { api.get('/admin/gallery').then((result) => setItems(result.gallery || result.items || [])).catch((err) => setError(err.message || 'Unable to load gallery images.')).finally(() => setLoading(false)); }, []);

  async function uploadImage(file) {
    const data = new FormData(); data.append('image', file);
    const result = await api.postForm('/admin/gallery/image', data);
    return result.url;
  }

  // Adds photos to a public Gallery section as Horizontal ('landscape') or
  // Vertical ('portrait'). `entries` are File objects (uploaded first) or
  // already-hosted image URLs (pasted links). Each photo's real pixel size is
  // saved too, and a photo whose shape doesn't match the area it was dropped
  // into is flagged (it's still added as chosen — the switch on its
  // thumbnail changes it).
  async function addGalleryImages(category, entries, orientation) {
    setNotices((current) => ({ ...current, [category.key]: '' }));
    let mismatched = 0;
    // One at a time, each shown as soon as it's saved — if one fails the
    // ones before it still appear, and ImageUpload shows the error.
    for (const entry of entries) {
      const size = await measureImage(entry);
      if (size && size.width !== size.height && (size.height > size.width ? 'portrait' : 'landscape') !== orientation) mismatched += 1;
      const url = typeof entry === 'string' ? entry : await uploadImage(entry);
      const result = await api.post('/admin/gallery', {
        category: category.key,
        title: `${category.label} photo`,
        imageUrl: url,
        orientation,
        ...(size || {}),
      });
      const saved = result.galleryItem || result.item || result.gallery;
      setItems((current) => [...current, saved]);
    }
    if (mismatched) {
      const added = orientation === 'portrait' ? 'vertical' : 'horizontal';
      const looks = orientation === 'portrait' ? 'horizontal' : 'vertical';
      setNotices((current) => ({
        ...current,
        [category.key]: `${mismatched} photo${mismatched === 1 ? ' looks' : 's look'} ${looks} but ${mismatched === 1 ? 'was' : 'were'} added as ${added}. Hover a photo and use its switch to change it if that wasn't intended.`,
      }));
    }
  }

  async function setPhotoOrientation(item, orientation) {
    try {
      setError('');
      const result = await api.patch(`/admin/gallery/${item.id}`, { orientation });
      const saved = result.galleryItem || result.item || result.gallery;
      setItems((current) => current.map((entry) => (entry.id === item.id ? saved : entry)));
    } catch (err) {
      setError(err.message || 'Unable to change the photo orientation.');
    }
  }

  // Persists the Landing Page Hero (Hero.jsx background). Called by
  // ImageUpload's onChange with the uploaded URL, or a pasted image link.
  async function saveLandingPageHero(url) {
    if (!url) return;
    const existing = items.find((item) => (item.category || item.type) === LANDING_HERO_KEY);
    const payload = { category: LANDING_HERO_KEY, title: 'Landing page hero', imageUrl: url };
    try {
      setError('');
      const result = existing ? await api.patch(`/admin/gallery/${existing.id}`, payload) : await api.post('/admin/gallery', payload);
      const saved = result.galleryItem || result.item || result.gallery;
      setItems((current) => existing ? current.map((entry) => entry.id === existing.id ? saved : entry) : [saved, ...current]);
    } catch (err) {
      setError(err.message || 'Unable to save the landing page hero image.');
    }
  }

  // Deletes every 'landing-hero' item so the public page falls back to
  // /HeroImage.png.
  async function resetLandingPageHero() {
    const heroes = items.filter((item) => (item.category || item.type) === LANDING_HERO_KEY);
    await Promise.all(heroes.map((item) => api.del(`/admin/gallery/${item.id}`)));
    setItems((current) => current.filter((entry) => (entry.category || entry.type) !== LANDING_HERO_KEY));
  }

  async function saveLandingHero(file) {
    const existing = items.find((item) => (item.category || item.type) === 'gallery-hero');
    const url = await uploadImage(file);
    const payload = { category: 'gallery-hero', title: 'Gallery landing hero', imageUrl: url };
    const result = existing ? await api.patch(`/admin/gallery/${existing.id}`, payload) : await api.post('/admin/gallery', payload);
    const saved = result.galleryItem || result.item || result.gallery;
    setItems((current) => existing ? current.map((entry) => entry.id === existing.id ? saved : entry) : [saved, ...current]);
  }

  function removeImage(item) {
    setConfirm({
      title: 'Remove photo',
      message: 'Remove this photo? It will disappear from the public Gallery page straight away.',
      confirmLabel: 'Remove photo',
      busyLabel: 'Deleting…',
      onConfirm: async () => {
        await api.del(`/admin/gallery/${item.id}`);
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      },
    });
  }

  // Landing page card — upserts its slot item ('landing-tour-N' /
  // 'landing-activity-N'). Saving every field empty (Reset) makes the card
  // show its default content.
  async function saveLandingCard(key, form) {
    const existing = items.find((item) => (item.category || item.type) === key);
    const payload = { category: key, ...Object.fromEntries(Object.entries(form).map(([field, value]) => [field, (value || '').trim()])) };
    const result = existing ? await api.patch(`/admin/gallery/${existing.id}`, payload) : await api.post('/admin/gallery', payload);
    const saved = result.galleryItem || result.item || result.gallery;
    setItems((current) => existing ? current.map((entry) => entry.id === existing.id ? saved : entry) : [saved, ...current]);
  }

  function confirmResetLandingCard(key, cardName) {
    setConfirm({
      title: `Reset ${cardName}`,
      message: "Remove this card's custom photo and text? The landing page will show its default content again.",
      confirmLabel: 'Reset to default',
      busyLabel: 'Resetting…',
      onConfirm: () => saveLandingCard(key, EMPTY_CARD),
    });
  }

  function confirmResetLandingPageHero() {
    setConfirm({
      title: 'Reset landing page hero',
      message: 'Remove the uploaded hero image? The landing page will go back to the default image.',
      confirmLabel: 'Reset to default',
      busyLabel: 'Resetting…',
      onConfirm: resetLandingPageHero,
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-5 lg:p-8">
    <div><h1 className="text-2xl font-bold text-ink">Landing Images</h1><p className="mt-1 max-w-2xl text-sm text-muted">Manage the images displayed across the Xclusive Oman landing page, including the hero, tour cards, activities and transfers.</p></div>
      <ErrorText>{error}</ErrorText>
      {!loading && <h2 className="pt-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">Landing page</h2>}
      {!loading && <LandingHeroCard item={items.find((item) => (item.category || item.type) === LANDING_HERO_KEY)} onUpload={uploadImage} onChange={saveLandingPageHero} onReset={confirmResetLandingPageHero} />}
      {!loading && LANDING_CARD_SECTIONS.map((section) => <LandingCardsEditor key={section.key} section={section} items={items} onUpload={uploadImage} onSave={saveLandingCard} onReset={confirmResetLandingCard} />)}
      {!loading && <h2 className="pt-4 text-xs font-bold uppercase tracking-[0.16em] text-muted">Gallery page</h2>}
      {!loading && <Card label="Gallery page hero" className="border-[#D7DDF0]"><div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px] md:items-center"><div><h2 className="text-lg font-bold text-ink">Main Gallery Hero</h2><p className="mt-1 max-w-xl text-xs text-muted">This is the full-width image displayed behind the main Gallery heading at the top of the public page.</p></div><ImageUpload label="Hero image" value={imageUrl(items.find((item) => (item.category || item.type) === 'gallery-hero'))} onChange={() => {}} onUpload={saveLandingHero} hint="Recommended: wide landscape image." /></div></Card>}
      {loading ? <Card><p className="text-sm text-muted">Loading gallery sections...</p></Card> : (
        <div className="space-y-5">
          {GALLERY_CATEGORIES.map((category) => (
            <GallerySectionCard
              key={category.key}
              category={category}
              items={items.filter((item) => (item.category || item.type || 'events') === category.key)}
              onAdd={(entries, orientation) => addGalleryImages(category, entries, orientation)}
              onDelete={removeImage}
              onSetOrientation={setPhotoOrientation}
              notice={notices[category.key]}
            />
          ))}
        </div>
      )}
      {confirm && <ConfirmPopup confirm={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
