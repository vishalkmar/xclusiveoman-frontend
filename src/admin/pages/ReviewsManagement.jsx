import { useCallback, useEffect, useRef, useState } from 'react';
import { FaStar } from 'react-icons/fa';
import {
  LuArrowRight,
  LuCalendar,
  LuChevronDown,
  LuCircleCheck,
  LuClock3,
  LuEllipsisVertical,
  LuEye,
  LuEyeOff,
  LuMapPin,
  LuMessageSquareText,
  LuPackage,
  LuPlus,
  LuSearch,
  LuSlidersHorizontal,
  LuStar,
  LuX,
} from 'react-icons/lu';
import { api } from '../api/client.js';
import { Button, ErrorText, Pagination } from '../components/ui.jsx';

// Admin Reviews Management (Task 21 — Item 33, Screen 33, REV-3/REV-4).
// Stat cards + Rating Overview come from GET /admin/reviews/stats (across
// every review); the list is GET /admin/reviews with every filter applied
// server-side (search, status, rating, FD package, destination, submitted
// date). Publishing/hiding a review re-rolls the package's public rating on
// the backend (reviewsAdmin.model.js#rollupPackageRating).

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'needs_review', label: 'Pending' },
  { value: 'published', label: 'Published' },
  { value: 'hidden', label: 'Hidden' },
];
const STATUS_LABEL = { needs_review: 'Pending', published: 'Published', hidden: 'Hidden' };
const STATUS_PILL = {
  needs_review: 'bg-amber-50 text-amber-700 ring-amber-200',
  published: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  hidden: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const RATING_OPTIONS = [
  { value: '', label: 'All ratings' },
  ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? '' : 's'}` })),
];

const DATE_OPTIONS = [
  { value: '', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: '6m', label: 'Last 6 months' },
  { value: 'custom', label: 'Custom range' },
];

const PAGE_SIZES = [10, 20, 50];
const AVATAR_TONES = [
  'bg-indigo-50 text-indigo-600',
  'bg-emerald-50 text-emerald-600',
  'bg-rose-50 text-rose-600',
  'bg-sky-50 text-sky-600',
  'bg-orange-50 text-orange-600',
  'bg-violet-50 text-violet-600',
];

// Local-calendar YYYY-MM-DD — toISOString() would shift the day east of UTC.
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateRangeFor(preset) {
  const today = new Date();
  const from = new Date(today);
  if (preset === '7d') from.setDate(from.getDate() - 7);
  else if (preset === '30d') from.setDate(from.getDate() - 30);
  else if (preset === '6m') from.setMonth(from.getMonth() - 6);
  else if (preset === 'thisMonth') from.setDate(1);
  else return {};
  return { dateFrom: isoDate(from), dateTo: isoDate(today) };
}

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function avatarTone(name) {
  let hash = 0;
  for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatTime = (value) =>
  new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

// --- Small building blocks ---------------------------------------------------

function Stars({ rating, size = 15 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <FaStar key={n} size={size} className={n <= rating ? 'text-amber-400' : 'text-slate-200'} />
      ))}
    </span>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${STATUS_PILL[status] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function StatCard({ icon: Icon, tone, label, value, hint }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#EEF1F8] bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
      <span className={`flex h-12 w-12 flex-none items-center justify-center rounded-full ${tone}`}>
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[#4B5575]">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-[#0F1B4C]">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-[#6B7394]">{hint}</p>}
      </div>
    </div>
  );
}

function RatingOverview({ stats }) {
  const max = Math.max(1, ...Object.values(stats.byRating));
  return (
    <div className="h-full rounded-2xl border border-[#EEF1F8] bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#0F1B4C]">
          <LuStar size={18} className="text-[#4F46E5]" /> Rating Overview
        </h2>
        <div className="text-right">
          <p className="text-2xl font-bold text-[#0F1B4C]">{stats.averageRating.toFixed(1)} / 5</p>
          <p className="text-[11px] text-[#6B7394]">Average Rating</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = stats.byRating[star] || 0;
          return (
            <div key={star} className="grid grid-cols-[14px_16px_minmax(0,1fr)_36px] items-center gap-2 text-xs text-[#4B5575]">
              <span>{star}</span>
              <FaStar size={13} className="text-amber-400" />
              <div className="h-2 overflow-hidden rounded-full bg-[#EEF1F8]">
                <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <span className="text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddReviewModal({ onSaved, onClose }) {
  const [packages, setPackages] = useState([]);
  const [packageId, setPackageId] = useState('');
  const [rating, setRating] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const carouselRef = useRef(null);
  useEffect(() => { api.get('/admin/reviews/published-packages').then((r) => setPackages(r.packages || [])).catch((e) => setError(e.message || 'Unable to load packages')); }, []);
  async function save(e) { e.preventDefault(); if (!packageId || !rating || !reviewText.trim()) { setError('Select a package, rating, and write a review before publishing.'); return; } setBusy(true); setError(''); try { await api.post('/admin/reviews/create', { fdPackageId: packageId, rating: Number(rating), reviewText: reviewText.trim() }); onSaved(); } catch (e) { setError(e.message || 'Unable to save review'); } finally { setBusy(false); } }
  const selected = packages.find((p) => p.id === packageId);
  const slide = (direction) => carouselRef.current?.scrollBy({ left: direction * 360, behavior: 'smooth' });
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"><div className="fixed inset-0 bg-slate-950/45" onClick={onClose} /><form onSubmit={save} className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-[#E4E9FB] px-6 py-5"><div><h3 className="text-2xl font-bold text-[#172554]">Add review</h3><p className="mt-1 text-sm text-[#64748B]">Choose a published package and add its customer feedback.</p></div><button type="button" onClick={onClose} aria-label="Close" className="text-[#172554] hover:text-[#4F46E5]"><LuX size={22} /></button></div><div className="overflow-y-auto px-6 py-5"><div className="text-sm font-bold text-[#172554]">Published packages</div><div className="mt-3 flex gap-4 overflow-x-auto pb-3">{packages.map((p) => <button key={p.id} type="button" onClick={() => setPackageId(p.id)} className={`w-64 flex-none overflow-hidden rounded-xl border-2 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md ${packageId === p.id ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/15' : 'border-[#E4E9FB]'}`}><div className="h-32 bg-[#EEF0FF]">{p.hero_image_url ? <img src={p.hero_image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-[#64748B]">No image</div>}</div><div className="p-3"><div className="line-clamp-2 text-sm font-bold text-[#172554]">{p.title}</div><div className="mt-1 text-xs text-[#64748B]">{[p.category, p.duration && `${p.duration} days`].filter(Boolean).join(' · ') || 'Published package'}</div></div></button>)}</div>{selected && <div className="mt-3 rounded-lg bg-[#EEF0FF] px-3 py-2 text-sm font-semibold text-[#3730A3]">Selected: {selected.title}</div>}<div className="mt-6 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]"><label className="block text-sm font-semibold text-[#172554]">Rating<select value={rating} onChange={(e) => setRating(e.target.value)} className={`${CONTROL} mt-1.5`}><option value="">Select rating</option>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} stars</option>)}</select></label><label className="block text-sm font-semibold text-[#172554]">Review<textarea required minLength={1} maxLength={5000} value={reviewText} onChange={(e) => setReviewText(e.target.value)} className={`${CONTROL} mt-1.5 h-28 resize-y p-3`} placeholder="Write a positive review..." /></label></div>{error && <p className="mt-3 text-xs text-red-600">{error}</p>}</div><div className="flex justify-end gap-2 border-t border-[#E4E9FB] px-6 py-4"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="accent" type="submit" disabled={busy || !packageId || !packages.length}>{busy ? 'Saving…' : 'Save review'}</Button></div></form></div>;
}

const CONTROL =
  'h-10 w-full rounded-lg border border-[#DDE2F0] bg-white text-sm text-[#0F1B4C] placeholder:text-[#8A92AD] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15';

function FilterSelect({ label, icon: Icon, value, onChange, options }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-[#0F1B4C]">{label}</span>
      <span className="relative block">
        {Icon && <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5575]" />}
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${CONTROL} cursor-pointer appearance-none pr-9 ${Icon ? 'pl-9' : 'pl-3'}`}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <LuChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5575]" />
      </span>
    </label>
  );
}

// Row actions menu — fixed-positioned so it isn't clipped by the table's
// horizontal scroll container.
function RowMenu({ review, busy, onView, onModerate }) {
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    const onPointer = (event) => {
      if (!event.target.closest?.('[data-row-menu]')) close();
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  function toggle() {
    if (pos) return setPos(null);
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = 120;
    const top = rect.bottom + menuHeight > window.innerHeight ? rect.top - menuHeight - 4 : rect.bottom + 4;
    setPos({ top, right: window.innerWidth - rect.right });
  }

  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-[#F4F6FF] disabled:opacity-50';
  return (
    <>
      <button ref={buttonRef} type="button" onClick={toggle} aria-label="More actions" data-row-menu className="flex h-8 w-8 items-center justify-center rounded-md text-[#0F1B4C] hover:bg-[#F1F4FB]">
        <LuEllipsisVertical size={17} />
      </button>
      {pos && (
        <div data-row-menu style={{ top: pos.top, right: pos.right }} className="fixed z-50 w-44 overflow-hidden rounded-lg border border-[#E4E9FB] bg-white py-1 shadow-lg">
          <button type="button" className={`${item} text-[#0F1B4C]`} onClick={() => { setPos(null); onView(); }}>
            <LuMessageSquareText size={14} /> View review
          </button>
          {review.status !== 'published' && (
            <button type="button" disabled={busy} className={`${item} text-emerald-700`} onClick={() => { setPos(null); onModerate('published'); }}>
              <LuEye size={14} /> Publish
            </button>
          )}
          {review.status !== 'hidden' && (
            <button type="button" disabled={busy} className={`${item} text-[#A5162D]`} onClick={() => { setPos(null); onModerate('hidden'); }}>
              <LuEyeOff size={14} /> Hide
            </button>
          )}
        </div>
      )}
    </>
  );
}

function ReviewPopup({ review, busy, onModerate, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = review.reviewerName || review.agencyName;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/35" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col rounded-xl border border-line-light bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line-light px-5 py-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-full text-sm font-bold ${avatarTone(name)}`}>{initials(name)}</span>
            <div>
              <h3 className="text-base font-bold text-ink">{name}</h3>
              <p className="text-xs text-muted">{review.agencyName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
            <LuX size={18} />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Stars rating={review.rating} size={18} />
            <StatusPill status={review.status} />
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-[#1E293B]">{review.reviewText || 'No written review — rating only.'}</p>
          <dl className="grid grid-cols-2 gap-3 rounded-lg bg-[#F8F9FD] p-3 text-xs">
            <div><dt className="text-muted">Package</dt><dd className="mt-0.5 font-medium text-ink">{review.packageTitle}</dd></div>
            <div><dt className="text-muted">Destination</dt><dd className="mt-0.5 font-medium text-ink">{review.destination || '—'}</dd></div>
            <div><dt className="text-muted">Submitted</dt><dd className="mt-0.5 font-medium text-ink">{formatDate(review.submittedAt)}, {formatTime(review.submittedAt)}</dd></div>
            <div><dt className="text-muted">Booking</dt><dd className="mt-0.5 font-mono font-medium text-ink">{review.bookingId.slice(0, 8).toUpperCase()}</dd></div>
          </dl>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line-light px-5 py-4">
          <Button type="button" onClick={onClose}>Close</Button>
          {review.status !== 'hidden' && (
            <Button variant="danger" type="button" disabled={busy} onClick={() => onModerate('hidden')}>
              <LuEyeOff size={14} className="mr-1.5" /> Hide
            </Button>
          )}
          {review.status !== 'published' && (
            <Button variant="accent" type="button" disabled={busy} onClick={() => onModerate('published')}>
              <LuEye size={14} className="mr-1.5" /> Publish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReferenceAddReviewModal({ onSaved, onClose }) {
  const [packages, setPackages] = useState([]);
  const [packageSearch, setPackageSearch] = useState('');
  const [packageId, setPackageId] = useState('');
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const carouselRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const query = packageSearch.trim() ? `?search=${encodeURIComponent(packageSearch.trim())}` : '';
      api.get(`/admin/reviews/published-packages${query}`).then((r) => setPackages(r.packages || [])).catch((e) => setError(e.message || 'Unable to load packages'));
    }, 250);
    return () => clearTimeout(timer);
  }, [packageSearch]);

  const selected = packages.find((p) => p.id === packageId);
  const valid = Boolean(packageId && rating && reviewText.trim());
  const slide = (direction) => carouselRef.current?.scrollBy({ left: direction * 340, behavior: 'smooth' });

  async function save(event) {
    event.preventDefault();
    if (!valid) return setError('Select a package, rating, and write a review before publishing.');
    setBusy(true); setError('');
    try {
      await api.post('/admin/reviews/create', { fdPackageId: packageId, rating, reviewText: reviewText.trim() });
      onSaved();
    } catch (err) { setError(err.message || 'Unable to save review'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={save} className="relative z-10 flex max-h-[calc(100vh-32px)] w-full max-w-[1390px] flex-col overflow-hidden rounded-[18px] border border-[#E5E7F5] bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-[#E5E7F5] px-8 py-7 sm:px-11">
          <div className="border-l-4 border-[#5145CD] pl-5"><h2 className="text-[34px] font-bold leading-tight text-[#172554]">Add review</h2><p className="mt-1 text-lg text-[#64748B]">Choose a published package and share customer feedback.</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F1EFFF] text-[#172554] hover:text-[#5145CD]"><LuX size={22} /></button>
        </header>
        <div className="overflow-y-auto px-8 py-7 sm:px-11">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-2xl font-bold text-[#172554]">Select a package</h3><p className="mt-1 text-base text-[#64748B]">Choose the trip this review belongs to.</p></div><input type="search" value={packageSearch} onChange={(e) => setPackageSearch(e.target.value)} placeholder="Search package by title..." aria-label="Search package by title" className={`${CONTROL} w-full max-w-sm px-4`} /></div>
          <div className="relative mt-6">
            <button type="button" onClick={() => slide(-1)} aria-label="Previous packages" className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-3xl text-[#172554] shadow-md ring-1 ring-[#D9DDF2]">‹</button>
            <div ref={carouselRef} className="flex gap-4 overflow-x-auto scroll-smooth px-2 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {packages.map((p) => <button key={p.id} type="button" onClick={() => setPackageId(p.id)} className={`w-[298px] flex-none overflow-hidden rounded-[15px] border-2 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${packageId === p.id ? 'border-[#5546E8] bg-[#F1EFFF] shadow-md' : 'border-[#D9DDF2] bg-white'}`}><div className="relative h-[132px] bg-[#EEF0FF]">{p.hero_image_url ? <img src={p.hero_image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-[#64748B]">No image</div>}{packageId === p.id && <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#5546E8] text-xl text-white">✓</span>}</div><div className="p-4"><div className="line-clamp-1 text-lg font-bold text-[#172554]">{p.title}</div><div className="mt-1 text-sm text-[#64748B]">{[p.type === 'readymade' ? 'Readymade' : 'FD Package', p.category, p.duration && `${p.duration} days`].filter(Boolean).join(' · ')}</div></div></button>)}
            </div>
            <button type="button" onClick={() => slide(1)} aria-label="Next packages" className="absolute right-0 top-1/2 z-10 flex h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-3xl text-[#172554] shadow-md ring-1 ring-[#D9DDF2]">›</button>
          </div>
          <div className="mt-8 grid gap-7 border-t border-[#E5E7F5] pt-7 lg:grid-cols-[300px_minmax(0,1fr)]">
            <section className="border-b border-[#E5E7F5] pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8"><h3 className="text-xl font-bold text-[#172554]">Your rating <span className="text-[#D92D20]">*</span></h3><div className="mt-4 rounded-xl bg-[#F1EFFF] p-5"><div className="flex justify-center gap-2">{[1,2,3,4,5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`} className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#5145CD]"><FaStar size={34} className={n <= rating ? 'text-[#F5A400]' : 'text-[#D9DCE7]'} /></button>)}</div></div><p className="mt-3 text-center text-sm font-semibold text-[#64748B]">{rating ? `${rating} out of 5` : 'Select a rating'}</p></section>
            <section><label className="block text-xl font-bold text-[#172554]">Your review <span className="text-[#D92D20]">*</span><textarea required maxLength={500} value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Share what made this experience memorable..." className={`${CONTROL} mt-4 min-h-[115px] resize-y rounded-xl p-4 text-base`} /><span className="mt-1 block text-right text-xs text-[#64748B]">{reviewText.length} / 500</span></label><p className="mt-1 text-sm text-[#64748B]">Your review will appear with the selected package.</p></section>
          </div>
          {error && <p className="mt-4 text-sm text-[#B42318]">{error}</p>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E7F5] px-8 py-5 sm:px-11"><p className="text-sm text-[#64748B]">ⓘ &nbsp;Select a package, rating, and written review to continue.</p><div className="flex gap-3"><Button type="button" onClick={onClose} className="h-[54px] min-w-[135px] border border-[#D9DDF2] bg-white text-[#172554]">Cancel</Button><Button variant="accent" type="submit" disabled={!valid || busy} className="h-[54px] min-w-[200px]">{busy ? 'Publishing…' : 'Publish review'}</Button></div></footer>
      </form>
    </div>
  );
}

// --- Page -------------------------------------------------------------------

const EMPTY_STATS = { total: 0, pending: 0, published: 0, hidden: 0, averageRating: 0, byRating: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

export default function ReviewsManagement() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [rating, setRating] = useState('');
  const [fdPackageId, setFdPackageId] = useState('');
  const [destination, setDestination] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [options, setOptions] = useState({ destinations: [], packages: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState('');
  const [viewing, setViewing] = useState(null);
  const [adding, setAdding] = useState(false);

  const loadStats = useCallback(() => {
    api.get('/admin/reviews/stats').then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    loadStats();
    api
      .get('/admin/reviews/filter-options')
      .then((res) => setOptions({ destinations: res.destinations || [], packages: res.packages || [] }))
      .catch(() => {});
  }, [loadStats]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status) params.set('status', status);
    if (rating) params.set('rating', rating);
    if (fdPackageId) params.set('fdPackageId', fdPackageId);
    if (destination) params.set('destination', destination);
    const range = datePreset === 'custom' ? { dateFrom: customFrom, dateTo: customTo } : dateRangeFor(datePreset);
    if (range.dateFrom) params.set('dateFrom', range.dateFrom);
    if (range.dateTo) params.set('dateTo', range.dateTo);

    api
      .get(`/admin/reviews?${params.toString()}`)
      .then((res) => {
        if (!active) return;
        setRows(res.rows);
        setTotal(res.total);
      })
      .catch((err) => active && setError(err.message || 'Unable to load reviews'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debouncedSearch, status, rating, fdPackageId, destination, datePreset, customFrom, customTo, page, pageSize]);

  // Every filter change goes back to page 1.
  const setFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setStatus('');
    setRating('');
    setFdPackageId('');
    setDestination('');
    setDatePreset('');
    setCustomFrom('');
    setCustomTo('');
    setPage(1);
  }

  function refreshAfterAdd() {
    setAdding(false);
    loadStats();
    setPage(1);
    setDebouncedSearch((value) => value);
  }

  async function moderate(review, newStatus) {
    setActingId(review.id);
    setError('');
    try {
      const { review: updated } = await api.patch(`/admin/reviews/${review.id}`, { status: newStatus });
      setRows((list) => list.map((r) => (r.id === review.id ? { ...r, ...updated } : r)));
      setViewing((current) => (current?.id === review.id ? { ...current, ...updated } : current));
      loadStats();
    } catch (err) {
      setError(err.message || 'Unable to update review status');
    } finally {
      setActingId('');
    }
  }

  const packageTitle = options.packages.find((p) => p.id === fdPackageId)?.title;
  const activeFilters = [
    debouncedSearch && { key: 'search', label: `Search: ${debouncedSearch}`, clear: () => setSearch('') },
    status && { key: 'status', label: `Status: ${STATUS_LABEL[status]}`, clear: () => setFilter(setStatus)('') },
    rating && { key: 'rating', label: `Rating: ${rating} star${rating === '1' ? '' : 's'}`, clear: () => setFilter(setRating)('') },
    fdPackageId && { key: 'package', label: `Package: ${packageTitle || 'Selected'}`, clear: () => setFilter(setFdPackageId)('') },
    destination && { key: 'destination', label: `Destination: ${destination}`, clear: () => setFilter(setDestination)('') },
    datePreset && {
      key: 'date',
      label: `Date: ${DATE_OPTIONS.find((o) => o.value === datePreset)?.label}`,
      clear: () => {
        setDatePreset('');
        setCustomFrom('');
        setCustomTo('');
        setPage(1);
      },
    },
  ].filter(Boolean);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-screen bg-[#F6F8FC]">
      <div className="mx-auto max-w-7xl p-5 lg:p-8">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4"><div><h1 className="text-[28px] font-bold leading-tight text-[#0F1B4C]">Reviews Management</h1>
          <p className="mt-1 text-sm text-[#4B5575]">Moderate agent-submitted trip reviews — publishing updates the package's rating shown to all agents.</p>
          </div><Button variant="accent" type="button" onClick={() => setAdding(true)} className="min-h-11 px-5 text-base font-semibold"><LuPlus size={19} strokeWidth={2.5} />Add review</Button></div></div>

        <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={LuMessageSquareText} tone="bg-indigo-50 text-indigo-600" label="Total Reviews" value={stats.total} />
              <StatCard icon={LuClock3} tone="bg-amber-50 text-amber-600" label="Pending Review" value={stats.pending} />
              <StatCard icon={LuCircleCheck} tone="bg-emerald-50 text-emerald-600" label="Published" value={stats.published} />
              <StatCard icon={LuStar} tone="bg-orange-50 text-orange-500" label="Average Rating" value={`${stats.averageRating.toFixed(1)} / 5`} hint={`Based on ${stats.total} review${stats.total === 1 ? '' : 's'}`} />
            </div>

            <div className="rounded-2xl border border-[#EEF1F8] bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block min-w-0 sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-medium text-[#0F1B4C]">Search</span>
                  <span className="relative block">
                    <LuSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5575]" />
                    <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agency, package, destination, reviewer or review text..." className={`${CONTROL} pl-9 pr-3`} />
                  </span>
                </label>
                <FilterSelect label="Status" value={status} onChange={setFilter(setStatus)} options={STATUS_OPTIONS} />
                <FilterSelect label="Rating" value={rating} onChange={setFilter(setRating)} options={RATING_OPTIONS} />
                <FilterSelect
                  label="FD Package"
                  icon={LuPackage}
                  value={fdPackageId}
                  onChange={setFilter(setFdPackageId)}
                  options={[{ value: '', label: 'All packages' }, ...options.packages.map((p) => ({ value: p.id, label: p.title }))]}
                />
                <FilterSelect
                  label="Destination"
                  icon={LuMapPin}
                  value={destination}
                  onChange={setFilter(setDestination)}
                  options={[{ value: '', label: 'All destinations' }, ...options.destinations.map((d) => ({ value: d, label: d }))]}
                />
                <FilterSelect
                  label="Date"
                  icon={LuCalendar}
                  value={datePreset}
                  onChange={(v) => {
                    setDatePreset(v);
                    if (v !== 'custom') {
                      setCustomFrom('');
                      setCustomTo('');
                    }
                    setPage(1);
                  }}
                  options={DATE_OPTIONS}
                />
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={clearFilters}
                    disabled={!activeFilters.length && !search}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#DDE2F0] bg-[#EEF1FF] px-4 text-sm font-medium text-[#4F46E5] hover:bg-[#E3E7FF] disabled:cursor-default disabled:opacity-60"
                  >
                    <LuSlidersHorizontal size={16} /> Clear filters
                  </button>
                </div>
              </div>
              {datePreset === 'custom' && (
                <div className="mt-4 flex flex-wrap gap-3 border-t border-[#EEF1F8] pt-4">
                  <label className="text-xs font-medium text-[#4B5575]">
                    Submitted from
                    <input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setFilter(setCustomFrom)(e.target.value)} className={`${CONTROL} mt-1.5 w-44 px-3`} />
                  </label>
                  <label className="text-xs font-medium text-[#4B5575]">
                    Submitted to
                    <input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setFilter(setCustomTo)(e.target.value)} className={`${CONTROL} mt-1.5 w-44 px-3`} />
                  </label>
                </div>
              )}
            </div>
          </div>
          <RatingOverview stats={stats} />
        </div>

        {activeFilters.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#0F1B4C]">Active filters:</span>
            {activeFilters.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1.5 rounded-full bg-[#E8EBFF] px-3 py-1 text-xs font-medium text-[#3730A3]">
                {f.label}
                <button type="button" onClick={f.clear} aria-label={`Remove ${f.label}`} className="text-[#4F46E5] hover:text-[#312E81]">
                  <LuX size={13} />
                </button>
              </span>
            ))}
          </div>
        )}

        <ErrorText>{error}</ErrorText>

        <div className="overflow-hidden rounded-2xl border border-[#EEF1F8] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#EEF1F8] text-[11px] font-semibold uppercase tracking-wide text-[#4F46E5]">
                  <th className="px-5 py-3.5">Review</th>
                  <th className="px-3 py-3.5">Agency</th>
                  <th className="px-3 py-3.5">Package</th>
                  <th className="px-3 py-3.5">Destination</th>
                  <th className="px-3 py-3.5">Rating</th>
                  <th className="px-3 py-3.5">Submitted</th>
                  <th className="px-3 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-muted">Loading reviews…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-muted">{activeFilters.length ? 'No reviews match these filters.' : 'No reviews have been submitted yet.'}</td></tr>
                ) : (
                  rows.map((r) => {
                    const name = r.reviewerName || r.agencyName;
                    return (
                      <tr key={r.id} className="border-b border-[#EEF1F8] align-middle last:border-0 hover:bg-[#FAFBFF]">
                        <td className="max-w-[320px] px-5 py-3.5">
                          <div className="flex gap-3">
                            <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-bold ${avatarTone(name)}`}>{initials(name)}</span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#0F1B4C]">{name}</p>
                              <p className="line-clamp-2 text-xs leading-relaxed text-[#4B5575]">{r.reviewText || 'Rating only — no written review.'}</p>
                              <button type="button" onClick={() => setViewing(r)} className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[#4F46E5] hover:underline">
                                Read full review <LuArrowRight size={12} />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-[13px] text-[#0F1B4C]">{r.agencyName}</td>
                        <td className="max-w-[160px] px-3 py-3.5 text-[13px] text-[#0F1B4C]">{r.packageTitle}</td>
                        <td className="px-3 py-3.5 text-xs text-[#0F1B4C]">
                          <span className="inline-flex items-center gap-1.5"><LuMapPin size={14} className="flex-none text-[#4B5575]" />{r.destination || '—'}</span>
                        </td>
                        <td className="px-3 py-3.5"><Stars rating={r.rating} /></td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-[13px] text-[#0F1B4C]">
                          {formatDate(r.submittedAt)}
                          <span className="block text-xs text-[#6B7394]">{formatTime(r.submittedAt)}</span>
                        </td>
                        <td className="px-3 py-3.5"><StatusPill status={r.status} /></td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setViewing(r)} className="text-xs font-semibold text-[#4F46E5] hover:underline">View</button>
                            <RowMenu review={r} busy={actingId === r.id} onView={() => setViewing(r)} onModerate={(s) => moderate(r, s)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF1F8] px-5 pb-4">
              <div className="min-w-0 flex-1">
                <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} itemLabel="reviews" />
              </div>
              <label className="relative mt-4">
                <span className="sr-only">Reviews per page</span>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-8 cursor-pointer appearance-none rounded-md border border-[#D7DDF0] bg-white pl-3 pr-8 text-xs font-medium text-[#0F1B4C] focus:border-[#6366F1] focus:outline-none">
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
                <LuChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4B5575]" />
              </label>
            </div>
          )}
        </div>
      </div>

      {viewing && (
        <ReviewPopup review={viewing} busy={actingId === viewing.id} onModerate={(s) => moderate(viewing, s)} onClose={() => setViewing(null)} />
      )}
      {adding && <ReferenceAddReviewModal onClose={() => setAdding(false)} onSaved={refreshAfterAdd} />}
    </div>
  );
}
