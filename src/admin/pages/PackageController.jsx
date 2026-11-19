import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LuArrowDown,
  LuArrowUp,
  LuBox,
  LuCalendar,
  LuChevronLeft,
  LuChevronRight,
  LuChevronsUpDown,
  LuCircleDot,
  LuCreditCard,
  LuEllipsisVertical,
  LuFilterX,
  LuImage,
  LuPencil,
  LuPercent,
  LuRotateCcw,
  LuSave,
  LuSearch,
  LuSettings,
  LuStamp,
  LuX,
} from 'react-icons/lu';
import { api } from '../api/client.js';
import { Button, ErrorText } from '../components/ui.jsx';

// Payments → Package Controller. Controls the FD pre-booking (deposit) an
// agent pays to hold seats, mirroring the backend rule in
// prebooking.service.js:
//   - Global: on/off + a percentage of the booking total.
//   - Per package: 'global' follows that, 'none' always takes the full amount
//     up front, 'custom' uses the package's own percentage.
// Bookings within 15 days of departure always pay in full, whatever is set here.
const MODE_OPTIONS = [
  { value: 'global', label: 'Admin configured' },
  { value: 'none', label: 'No amount' },
  { value: 'custom', label: 'Custom' },
];
const MODE_LABEL = Object.fromEntries(MODE_OPTIONS.map((o) => [o.value, o.label]));
const PLATFORM_FEE_MODE_OPTIONS = [
  { value: 'global', label: 'Admin configured' },
  { value: 'none', label: 'Disabled' },
  { value: 'custom', label: 'Custom' },
];

const STATUS_OPTIONS = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed', label: 'Closed' },
];
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_STYLE = {
  published: 'bg-[#ECFDF5] text-[#047857]',
  draft: 'bg-[#F1F3F9] text-[#64748B]',
  closed: 'bg-[#FEF2F2] text-[#B91C1C]',
};

const PAYMENT_OPTIONS = [
  { value: 'prebooking', label: 'Pre-booking required' },
  { value: 'full', label: 'Full payment' },
];
const PLATFORM_FEE_APPLICATION_OPTIONS = [
  { value: 'active', label: 'Fee applied' },
  { value: 'disabled', label: 'No fee' },
];
const PAYMENT_LABEL = Object.fromEntries(PAYMENT_OPTIONS.map((o) => [o.value, o.label]));

// Filters on each package's next upcoming departure date.
const DEPARTURE_OPTIONS = [
  { value: '30', label: 'Next 30 days' },
  { value: '90', label: 'Next 3 months' },
  { value: '180', label: 'Next 6 months' },
  { value: 'none', label: 'No upcoming departures' },
];
const DEPARTURE_LABEL = Object.fromEntries(DEPARTURE_OPTIONS.map((o) => [o.value, o.label]));

const PAGE_SIZES = [5, 10, 20, 50];
const EMPTY_FILTERS = { status: 'published', mode: '', payment: '', departure: '' };

// Percentage due at booking for a package, or null when it pays in full.
function effectivePercentage(mode, percentage, settings) {
  if (mode === 'none') return null;
  if (mode === 'custom') return Number(percentage) > 0 ? Number(percentage) : null;
  return settings.enabled ? settings.percentage : null;
}

function effectivePlatformFee(mode, percentage, settings) {
  if (mode === 'none') return 0;
  if (mode === 'custom') return Number(percentage) || 0;
  return settings?.enabled ? Number(settings.percentage) || 0 : 0;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function matchesDeparture(pkg, period) {
  if (!period) return true;
  if (period === 'none') return !pkg.nextDepartureDate;
  if (!pkg.nextDepartureDate) return false;
  const days = (new Date(pkg.nextDepartureDate).getTime() - Date.now()) / 86400000;
  return days <= Number(period);
}

const inputClass =
  'w-full rounded-md border border-[#D7DDF0] bg-white px-3 py-2.5 text-sm text-ink shadow-sm placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15';

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 flex-none items-center rounded-full transition ${
        checked ? 'bg-[#4F46E5]' : 'bg-[#CBD5E1]'
      }`}
    >
      <span
        className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

function PercentInput({ value, onChange, disabled, className = '', ...props }) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="number"
        min="0.01"
        max="100"
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pr-8 disabled:bg-[#F1F3F9] disabled:text-muted`}
        {...props}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">%</span>
    </div>
  );
}

function IconTile({ Icon }) {
  return (
    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-[#EEF0FF] text-[#4F46E5]">
      <Icon className="h-6 w-6" />
    </div>
  );
}

function GlobalSettingsCard({ settings, onSaved }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [percentage, setPercentage] = useState(String(settings.percentage));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const dirty = enabled !== settings.enabled || Number(percentage) !== settings.percentage;

  async function save() {
    const pct = Number(percentage);
    if (!(pct > 0 && pct <= 100)) {
      setError('Pre-booking % must be more than 0 and at most 100.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const { settings: next } = await api.put('/admin/package-controller/settings', { enabled, percentage: pct });
      onSaved(next);
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-[#E4E9FB] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex gap-4">
          <IconTile Icon={LuPercent} />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-ink">Global pre-booking payment</h3>
            <p className="mt-0.5 text-xs text-muted">
              Configure how much agents pay at the time of booking for all FD packages.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Switch
                checked={enabled}
                label="Pre-booking payment"
                onChange={(v) => {
                  setEnabled(v);
                  setSaved(false);
                }}
              />
              <span className="text-sm font-semibold text-ink">Pre-booking payment is {enabled ? 'ON' : 'OFF'}</span>
            </div>
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted">
              {enabled
                ? `Agents pay ${percentage || '—'}% of the booking total to hold seats, the balance is collected later.`
                : 'Agents pay the full booking amount at the time of booking.'}{' '}
              Applies to every FD package set to “Admin configured”. Bookings within 15 days of departure always pay in
              full.
            </p>
          </div>
        </div>

        <div className="border-t border-[#E4E9FB] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <label htmlFor="global-prebooking-pct" className="text-sm font-semibold text-ink">
            Pre-booking %
          </label>
          <p className="mb-2 mt-0.5 text-xs text-muted">Percentage of booking amount to be collected at the time of booking.</p>
          <PercentInput
            id="global-prebooking-pct"
            value={percentage}
            disabled={!enabled}
            onChange={(v) => {
              setPercentage(v);
              setSaved(false);
            }}
          />
          <Button variant="accent" className="mt-3 gap-2" disabled={!dirty || saving} onClick={save}>
            <LuSave className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save global setting'}
          </Button>
          {saved && !dirty && <span className="ml-3 text-xs text-[#047857]">Saved</span>}
          <div className="mt-2">
            <ErrorText>{error}</ErrorText>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatformFeeSettingsCard({ settings, onSaved }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [percentage, setPercentage] = useState(String(settings.percentage));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmAboveDefault, setConfirmAboveDefault] = useState(false);
  const dirty = enabled !== settings.enabled || Number(percentage) !== Number(settings.percentage);

  async function persist() {
    const pct = Number(percentage);
    setError(''); setSaving(true);
    try {
      const { platformFee } = await api.put('/admin/package-controller/platform-fee/settings', { enabled, percentage: pct });
      onSaved(platformFee); setSaved(true);
    } catch (err) { setError(err.message || 'Unable to save settings'); } finally { setSaving(false); }
  }

  function save() {
    const pct = Number(percentage);
    if (!(pct >= 0 && pct <= 100)) { setError('Platform fee % must be between 0 and 100.'); return; }
    if (pct > 4) { setConfirmAboveDefault(true); return; }
    persist();
  }

  return (
    <section className="mb-6 rounded-xl border border-[#E4E9FB] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex gap-4"><IconTile Icon={LuPercent} /><div className="min-w-0">
          <h3 className="text-base font-bold text-ink">Global FD platform fee</h3>
          <p className="mt-0.5 text-xs text-muted">Configure the percentage included in FD package prices.</p>
          <div className="mt-4 flex items-center gap-3"><Switch checked={enabled} label="FD platform fee" onChange={(v) => { setEnabled(v); setSaved(false); }} /><span className="text-sm font-semibold text-ink">Platform fee is {enabled ? 'ON' : 'OFF'}</span></div>
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted">{enabled ? `A ${percentage || '0'}% platform fee is added to the calculated package price. It is included in the final rate and is not shown separately to agents.` : 'No platform fee is added by default.'} Applies to every FD package set to “Admin configured”.</p>
        </div></div>
        <div className="border-t border-[#E4E9FB] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <label className="text-sm font-semibold text-ink">Platform fee %</label><p className="mb-2 mt-0.5 text-xs text-muted">Percentage added to the calculated package price.</p>
          <PercentInput value={percentage} disabled={!enabled} onChange={(v) => { setPercentage(v); setSaved(false); }} />
          <Button variant="accent" className="mt-3 gap-2" disabled={!dirty || saving} onClick={save}><LuSave className="h-4 w-4" />{saving ? 'Saving…' : 'Save global setting'}</Button>
          {saved && !dirty && <span className="ml-3 text-xs text-[#047857]">Saved</span>}<div className="mt-2"><ErrorText>{error}</ErrorText></div>
        </div>
      </div>
      {confirmAboveDefault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close confirmation" className="fixed inset-0 bg-slate-950/35" onClick={() => !saving && setConfirmAboveDefault(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-ink">Save a platform fee above 4%?</h3>
            <p className="mt-2 text-sm text-muted">The platform fee is set to {percentage}%. This is higher than the default 4% and will be included in the final package price for every package using Admin configured.</p>
            <div className="mt-6 flex justify-end gap-2"><Button disabled={saving} onClick={() => setConfirmAboveDefault(false)}>Cancel</Button><Button variant="accent" disabled={saving} onClick={() => { setConfirmAboveDefault(false); persist(); }}>{saving ? 'Saving…' : 'Yes, save fee'}</Button></div>
          </div>
        </div>
      )}
    </section>
  );
}

function FilterSelect({ Icon, label, value, onChange, options, allLabel }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterChip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF0FF] px-3 py-1 text-xs font-medium text-[#4338CA]">
      {children}
      <button type="button" onClick={onRemove} aria-label={`Remove filter ${children}`} className="hover:text-ink">
        <LuX className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function SortHeader({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort.key === sortKey;
  const Icon = !active ? LuChevronsUpDown : sort.dir === 'asc' ? LuArrowUp : LuArrowDown;
  return (
    <th className={`whitespace-nowrap px-3 py-3 text-left font-semibold ${className}`} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-ink">
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? 'text-[#4F46E5]' : 'text-[#94A3B8]'}`} />
      </button>
    </th>
  );
}

function RowMenu({ pkg, onReset }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`More actions for ${pkg.title}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#D7DDF0] bg-white text-muted hover:text-ink"
      >
        <LuEllipsisVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-[#E4E9FB] bg-white py-1 text-left text-xs shadow-lg">
          <Link
            to={`/admin/catalog/fd-packages/${pkg.id}`}
            className="flex items-center gap-2 px-3 py-2 text-ink hover:bg-[#F3F4FF]"
          >
            <LuPencil className="h-3.5 w-3.5" /> Edit package
          </Link>
          <button
            type="button"
            disabled={pkg.prebookingMode === 'global'}
            onClick={() => {
              setOpen(false);
              onReset();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-ink hover:bg-[#F3F4FF] disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
          >
            <LuRotateCcw className="h-3.5 w-3.5" /> Reset to admin configured
          </button>
        </div>
      )}
    </div>
  );
}

function EffectivePill({ percentage }) {
  const Icon = percentage == null ? LuCreditCard : LuPercent;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-[#EEF0FF] px-3 py-1.5 text-xs font-medium text-[#4338CA]">
      <Icon className="h-3.5 w-3.5" />
      {percentage == null ? 'Full payment' : `${percentage}% pre-booking`}
    </span>
  );
}

function PackageRow({ pkg, settings, selected, onSelect, onSaved }) {
  const [mode, setMode] = useState(pkg.prebookingMode);
  const [percentage, setPercentage] = useState(pkg.prebookingPercentage == null ? '' : String(pkg.prebookingPercentage));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = mode !== pkg.prebookingMode || (mode === 'custom' && Number(percentage) !== Number(pkg.prebookingPercentage));

  async function save(next = { mode, percentage }) {
    const pct = Number(next.percentage);
    if (next.mode === 'custom' && !(pct > 0 && pct <= 100)) {
      setError('Enter a % between 0 and 100');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const { package: updated } = await api.patch(`/admin/package-controller/packages/${pkg.id}`, {
        mode: next.mode,
        percentage: next.mode === 'custom' ? pct : null,
      });
      onSaved([updated]);
    } catch (err) {
      setError(err.message || 'Unable to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className={`border-b border-[#E4E9FB] last:border-b-0 ${selected ? 'bg-[#F8F8FF]' : ''}`}>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`Select ${pkg.title}`}
          className="h-4 w-4 rounded border-[#CBD5E1] accent-[#4F46E5]"
        />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          {pkg.imageUrl ? (
            <img src={pkg.imageUrl} alt="" className="h-10 w-10 flex-none rounded-md object-cover" />
          ) : (
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#F1F3F9] text-[#94A3B8]">
              <LuImage className="h-4 w-4" />
            </div>
          )}
          <span className="font-semibold text-ink">{pkg.title}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${STATUS_STYLE[pkg.status] || STATUS_STYLE.draft}`}>
          {STATUS_LABEL[pkg.status] || pkg.status}
        </span>
      </td>
      <td className="px-3 py-3">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          aria-label={`Pre-booking setting for ${pkg.title}`}
          className={`${inputClass} min-w-[150px] !py-2 text-xs`}
        >
          {MODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        {mode === 'custom' ? (
          <PercentInput
            className="w-24"
            value={percentage}
            onChange={setPercentage}
            aria-label={`Custom pre-booking % for ${pkg.title}`}
          />
        ) : (
          <span className="text-muted">—</span>
        )}
        {error && <div className="mt-1 text-[11px] text-[#a5162d]">{error}</div>}
      </td>
      <td className="px-3 py-3">
        <EffectivePill percentage={effectivePercentage(mode, percentage, settings)} />
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-xs">
        <div className="font-medium text-ink">{formatDate(pkg.updatedAt)}</div>
        {pkg.updatedByName && <div className="text-muted">by {pkg.updatedByName}</div>}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button variant="accent" size="sm" className="gap-1.5" disabled={!dirty || saving} onClick={() => save()}>
            <LuSave className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <RowMenu pkg={pkg} onReset={() => save({ mode: 'global', percentage: null })} />
        </div>
      </td>
    </tr>
  );
}

function PlatformFeePackageRow({ pkg, platformFee, onSaved }) {
  const [mode, setMode] = useState(pkg.platformFeeMode || 'global');
  const [percentage, setPercentage] = useState(pkg.platformFeePercentage == null ? '' : String(pkg.platformFeePercentage));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = mode !== (pkg.platformFeeMode || 'global') || (mode === 'custom' && Number(percentage) !== Number(pkg.platformFeePercentage));
  async function save() {
    const pct = Number(percentage);
    if (mode === 'custom' && !(pct >= 0 && pct <= 100)) { setError('Enter a platform fee between 0 and 100'); return; }
    setError(''); setSaving(true);
    try {
      const { package: updated } = await api.patch(`/admin/package-controller/platform-fee/packages/${pkg.id}`, { mode, percentage: mode === 'custom' ? pct : null });
      onSaved([updated]);
    } catch (err) { setError(err.message || 'Unable to save'); } finally { setSaving(false); }
  }
  const effective = effectivePlatformFee(mode, percentage, platformFee);
  return <tr className="border-b border-[#E4E9FB] last:border-b-0"><td className="px-3 py-3"><div className="flex items-center gap-3">{pkg.imageUrl ? <img src={pkg.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#F1F3F9] text-[#94A3B8]"><LuImage className="h-4 w-4" /></div>}<span className="font-semibold text-ink">{pkg.title}</span></div></td><td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${STATUS_STYLE[pkg.status] || STATUS_STYLE.draft}`}>{STATUS_LABEL[pkg.status] || pkg.status}</span></td><td className="px-3 py-3"><select value={mode} onChange={(e) => setMode(e.target.value)} className={`${inputClass} min-w-[160px] !py-2 text-xs`}>{PLATFORM_FEE_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td><td className="px-3 py-3">{mode === 'custom' ? <PercentInput className="w-24" value={percentage} onChange={setPercentage} /> : <span className="text-muted">—</span>}{error && <div className="mt-1 text-[11px] text-[#a5162d]">{error}</div>}</td><td className="px-3 py-3"><span className={`inline-flex rounded-md px-3 py-1.5 text-xs font-medium ${effective > 0 ? 'bg-[#EEF0FF] text-[#4338CA]' : 'bg-[#F1F3F9] text-muted'}`}>{effective > 0 ? `${effective}% platform fee` : 'No fee'}</span></td><td className="whitespace-nowrap px-3 py-3 text-xs"><div className="font-medium text-ink">{formatDate(pkg.updatedAt)}</div>{pkg.updatedByName && <div className="text-muted">by {pkg.updatedByName}</div>}</td><td className="px-3 py-3 text-right"><Button variant="accent" size="sm" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button></td></tr>;
}

// ── Visa tab ────────────────────────────────────────────────────────────
// ONE per-person visa price for every visa package (backend:
// visaPricing.service.js). Visa Setup defines the types/categories; their
// price is set only here. Agents pay price × number of travellers.
function formatOmr(value) {
  return `OMR ${Number(value).toFixed(3)}`;
}

function VisaPricingTab() {
  const [data, setData] = useState(null);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get('/admin/package-controller/visa')
      .then((d) => {
        setData(d);
        setPrice(d.defaultPrice == null ? String(d.pricePerPerson ?? '') : String(d.defaultPrice));
      })
      .catch((err) => setError(err.message || 'Unable to load visa price'))
      .finally(() => setLoading(false));
  }, []);

  const next = price.trim() === '' ? null : Number(price);
  const valid = next == null || (Number.isFinite(next) && next > 0);
  const current = data?.defaultPrice ?? data?.pricePerPerson ?? null;
  const dirty = next !== current;

  async function save() {
    if (!valid) {
      setError('Enter a price more than 0, or leave it empty to use the default (8).');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const result = await api.put('/admin/package-controller/visa', { defaultPrice: next, pricePerPerson: next });
      const savedPrice = result.defaultPrice ?? result.pricePerPerson ?? next;
      setData((d) => ({ ...d, defaultPrice: savedPrice, pricePerPerson: savedPrice }));
      setPrice(savedPrice == null ? '' : String(savedPrice));
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Unable to save visa price');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <section className="mb-6 rounded-xl border border-[#E4E9FB] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex gap-4">
          <IconTile Icon={LuStamp} />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-ink">Visa fee</h3>
            <p className="mt-0.5 text-xs text-muted">Default price per person for visas set to Admin configured.</p>
            <div className="mt-4 flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium ${
                  current != null ? 'bg-[#EEF0FF] text-[#4338CA]' : 'bg-[#FFF7ED] text-[#B45309]'
                }`}
              >
                <LuCreditCard className="h-3.5 w-3.5" />
                {current != null ? `Agents pay ${formatOmr(current)} per traveller` : 'Price not set'}
              </span>
            </div>
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted">
              {current != null
                ? `An application for 3 travellers costs ${formatOmr(current * 3)}. `
                : 'Until a price is set, agents see no total on “Apply for Visa”. '}
              Applies as the default to all {data?.packages?.length ?? data?.visaPackageCount ?? 0} visa package{(data?.packages?.length ?? data?.visaPackageCount ?? 0) === 1 ? '' : 's'} set up in{' '}
              <Link to="/admin/visa-setup" className="font-semibold text-[#4F46E5] hover:underline">
                Visa Creation
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="border-t border-[#E4E9FB] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <label htmlFor="visa-price" className="text-sm font-semibold text-ink">
            Default price per person
          </label>
          <p className="mb-2 mt-0.5 text-xs text-muted">In OMR. Leave empty to clear the price.</p>
          <div className="relative">
            <input
              id="visa-price"
              type="number"
              min="0"
              step="0.001"
              placeholder="0.000"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setSaved(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && dirty && !saving && save()}
              className={`${inputClass} pr-14`}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">OMR</span>
          </div>
          <Button variant="accent" className="mt-3 gap-2" disabled={!dirty || saving} onClick={save}>
            <LuSave className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save visa price'}
          </Button>
          {saved && !dirty && <span className="ml-3 text-xs text-[#047857]">Saved</span>}
          <div className="mt-2">
            <ErrorText>{error}</ErrorText>
          </div>
        </div>
      </div>
      <VisaPriceRows packages={data?.packages || []} defaultPrice={current} />
    </section>
  );
}

function VisaPriceRows({ packages, defaultPrice }) {
  if (!packages.length) return <p className="mt-5 border-t border-[#E4E9FB] pt-5 text-sm text-muted">No visas have been created yet. Create them in Visa Creation first.</p>;
  return <div className="mt-6 overflow-x-auto border-t border-[#E4E9FB] pt-5"><h4 className="mb-3 text-sm font-bold text-ink">Created visas</h4><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#F3F4FF] text-xs text-[#4F46E5]"><tr><th className="px-3 py-3">Visa</th><th className="px-3 py-3">Information</th><th className="px-3 py-3">Price method</th><th className="px-3 py-3">Custom price</th><th className="px-3 py-3">Effective fee</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody>{packages.map((pkg) => <VisaPriceRow key={pkg.id} pkg={pkg} defaultPrice={defaultPrice} />)}</tbody></table></div>;
}

function VisaPriceRow({ pkg, defaultPrice }) {
  const [mode, setMode] = useState(pkg.priceMethod || pkg.priceMode || 'global');
  const [custom, setCustom] = useState(pkg.customPrice == null ? '' : String(pkg.customPrice));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const effective = mode === 'custom' ? Number(custom) : Number(defaultPrice);
  async function save() {
    if (mode === 'custom' && !(effective > 0)) return setError('Enter a price more than 0.');
    setSaving(true); setError('');
    try { await api.put(`/admin/package-controller/visa/${pkg.id}`, { priceMode: mode, priceMethod: mode, customPrice: mode === 'custom' ? effective : null }); } catch (err) { setError(err.message || 'Unable to save visa price'); } finally { setSaving(false); }
  }
  return <tr className="border-b border-[#E4E9FB] last:border-b-0"><td className="px-3 py-3"><div className="flex items-center gap-3">{pkg.imageUrl && <img src={pkg.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover" />}<span className="font-semibold text-ink">{pkg.name || `${pkg.durationDays} day visa`}</span></div></td><td className="px-3 py-3 text-xs text-muted">{pkg.entryType} · valid {pkg.validForDays} days · stay {pkg.maxStayDays} days</td><td className="px-3 py-3"><select value={mode} onChange={(e) => setMode(e.target.value)} className={`${inputClass} min-w-[160px] !py-2 text-xs`}><option value="global">Admin configured</option><option value="custom">Custom</option></select></td><td className="px-3 py-3">{mode === 'custom' ? <input type="number" min="0" step="0.001" value={custom} onChange={(e) => setCustom(e.target.value)} className={`${inputClass} w-28 !py-2 text-xs`} /> : <span className="text-muted">—</span>}{error && <div className="mt-1 text-[11px] text-[#a5162d]">{error}</div>}</td><td className="px-3 py-3 font-semibold">{effective > 0 ? formatOmr(effective) : 'Not set'}</td><td className="px-3 py-3 text-right"><Button variant="accent" size="sm" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button></td></tr>;
}

function BulkBar({ count, onApply, onClear }) {
  const [mode, setMode] = useState('global');
  const [percentage, setPercentage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function apply() {
    const pct = Number(percentage);
    if (mode === 'custom' && !(pct > 0 && pct <= 100)) {
      setError('Enter a % between 0 and 100');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onApply({ mode, percentage: mode === 'custom' ? pct : null });
    } catch (err) {
      setError(err.message || 'Unable to update packages');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#C7D2FE] bg-[#EEF0FF] px-4 py-3 text-sm">
      <span className="font-semibold text-[#4338CA]">{count} selected</span>
      <span className="text-muted">Set pre-booking to</span>
      <select value={mode} onChange={(e) => setMode(e.target.value)} className={`${inputClass} !w-auto !py-1.5 text-xs`} aria-label="Pre-booking setting for selected packages">
        {MODE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {mode === 'custom' && <PercentInput className="w-24" value={percentage} onChange={setPercentage} aria-label="Custom % for selected packages" />}
      <Button variant="accent" size="sm" disabled={busy} onClick={apply}>
        {busy ? 'Applying…' : 'Apply'}
      </Button>
      <button type="button" onClick={onClear} className="text-xs font-medium text-muted hover:text-ink">
        Clear selection
      </button>
      {error && <span className="text-xs text-[#a5162d]">{error}</span>}
    </div>
  );
}

function Pager({ page, totalPages, onChange }) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  const btn = 'flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm';
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)} className={`${btn} border-[#D7DDF0] bg-white text-muted disabled:opacity-40`}>
        <LuChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((n) => (
        <button
          key={n}
          type="button"
          aria-current={n === page ? 'page' : undefined}
          onClick={() => onChange(n)}
          className={`${btn} ${n === page ? 'border-[#4F46E5] bg-[#4F46E5] font-semibold text-white' : 'border-transparent text-ink hover:border-[#D7DDF0]'}`}
        >
          {n}
        </button>
      ))}
      <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className={`${btn} border-[#D7DDF0] bg-white text-muted disabled:opacity-40`}>
        <LuChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PackageController() {
  const [settings, setSettings] = useState(null);
  const [platformFee, setPlatformFee] = useState(null);
  // ?tab=visa opens the Visa tab directly (linked from Visa Setup).
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => (searchParams.get('tab') === 'visa' ? 'visa' : 'prebooking'));
  const [platformFeeSearch, setPlatformFeeSearch] = useState('');
  const [platformFeeModeFilter, setPlatformFeeModeFilter] = useState('');
  const [platformFeeStatusFilter, setPlatformFeeStatusFilter] = useState('published');
  const [platformFeeApplicationFilter, setPlatformFeeApplicationFilter] = useState('');
  const [platformFeeDepartureFilter, setPlatformFeeDepartureFilter] = useState('');
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState({ key: 'updatedAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    api
      .get('/admin/package-controller')
      .then((data) => {
        setSettings(data.settings);
        setPlatformFee(data.platformFee);
        setPackages(data.packages);
      })
      .catch((err) => setError(err.message || 'Unable to load package controller'))
      .finally(() => setLoading(false));
  }, []);

  // Any filter/search/sort change starts back on page 1.
  useEffect(() => setPage(1), [search, filters, sort, pageSize]);

  const filtered = useMemo(() => {
    if (!settings) return [];
    const q = search.trim().toLowerCase();
    return packages.filter((p) => {
      if (q && !p.title?.toLowerCase().includes(q)) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.mode && p.prebookingMode !== filters.mode) return false;
      if (filters.payment) {
        const pays = effectivePercentage(p.prebookingMode, p.prebookingPercentage, settings) == null ? 'full' : 'prebooking';
        if (pays !== filters.payment) return false;
      }
      return matchesDeparture(p, filters.departure);
    });
  }, [packages, search, filters, settings]);

  const sorted = useMemo(() => {
    const value = (p) => {
      switch (sort.key) {
        case 'title':
          return p.title?.toLowerCase() || '';
        case 'status':
          return p.status || '';
        case 'mode':
          return MODE_LABEL[p.prebookingMode] || '';
        case 'percentage':
          return p.prebookingMode === 'custom' ? Number(p.prebookingPercentage) || 0 : -1;
        case 'effective':
          return effectivePercentage(p.prebookingMode, p.prebookingPercentage, settings) ?? 101;
        default:
          return p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
      }
    };
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      return va < vb ? -dir : va > vb ? dir : 0;
    });
  }, [filtered, sort, settings]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const platformFeeRows = packages.filter((pkg) => {
    const matchesSearch = !platformFeeSearch.trim() || pkg.title?.toLowerCase().includes(platformFeeSearch.trim().toLowerCase());
    const matchesMode = !platformFeeModeFilter || (pkg.platformFeeMode || 'global') === platformFeeModeFilter;
    const effective = effectivePlatformFee(pkg.platformFeeMode || 'global', pkg.platformFeePercentage, platformFee);
    const matchesStatus = !platformFeeStatusFilter || pkg.status === platformFeeStatusFilter;
    const matchesApplication = !platformFeeApplicationFilter || (platformFeeApplicationFilter === 'active' ? effective > 0 : effective === 0);
    const matchesPlatformDeparture = matchesDeparture(pkg, platformFeeDepartureFilter);
    return matchesSearch && matchesMode && matchesStatus && matchesApplication && matchesPlatformDeparture;
  });
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((p) => selected.has(p.id));

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function toggleSelected(id, on) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePage(on) {
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((p) => (on ? next.add(p.id) : next.delete(p.id)));
      return next;
    });
  }

  function handleSaved(updatedList) {
    const byId = new Map(updatedList.map((p) => [p.id, p]));
    setPackages((list) => list.map((p) => byId.get(p.id) || p));
  }

  async function applyBulk(setting) {
    const { packages: updated } = await api.patch('/admin/package-controller/packages', { ids: [...selected], ...setting });
    handleSaved(updated);
    setSelected(new Set());
  }

  const chips = [
    filters.status && { key: 'status', label: `Status: ${STATUS_LABEL[filters.status]}` },
    filters.mode && { key: 'mode', label: `Pre-booking setting: ${MODE_LABEL[filters.mode]}` },
    filters.payment && { key: 'payment', label: `Payment at booking: ${PAYMENT_LABEL[filters.payment]}` },
    filters.departure && { key: 'departure', label: `Departure: ${DEPARTURE_LABEL[filters.departure]}` },
  ].filter(Boolean);
  const hasFilters = chips.length > 0 || search.trim() !== '';

  const rangeStart = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, sorted.length);

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-7xl p-6 lg:p-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">FD Payment &amp; Platform Fee Settings</h2>
            <p className="mt-1 text-sm text-muted">
              Control pre-booking payments and hidden platform fees for FD packages, and per-person visa prices.
            </p>
          </div>
          <Link
            to="/admin/catalog"
            className="inline-flex items-center gap-2 rounded-md border border-[#D7DDF0] bg-white px-3.5 py-2 text-xs font-medium text-ink shadow-sm hover:border-[#6366F1]"
          >
            <LuSettings className="h-4 w-4 text-[#4F46E5]" />
            FD Package Settings
          </Link>
        </div>

        {loading && <p className="text-sm text-muted">Loading…</p>}
        <ErrorText>{error}</ErrorText>

        {settings && (
          <>
            <div className="mb-6 inline-flex rounded-lg border border-[#D7DDF0] bg-white p-1 shadow-sm">
              <button type="button" onClick={() => setActiveTab('prebooking')} className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === 'prebooking' ? 'bg-[#4F46E5] text-white' : 'text-muted hover:text-ink'}`}>Pre-booking Payment</button>
              <button type="button" onClick={() => setActiveTab('platformFee')} className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === 'platformFee' ? 'bg-[#4F46E5] text-white' : 'text-muted hover:text-ink'}`}>Platform Fee</button>
              <button type="button" onClick={() => setActiveTab('visa')} className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === 'visa' ? 'bg-[#4F46E5] text-white' : 'text-muted hover:text-ink'}`}>Visa</button>
            </div>
            {activeTab === 'visa' && <VisaPricingTab />}
            {activeTab === 'prebooking' && <>
            <GlobalSettingsCard settings={settings} onSaved={setSettings} />

            <section className="rounded-xl border border-[#E4E9FB] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)] sm:p-6">
              <div className="mb-5 flex gap-4">
                <IconTile Icon={LuBox} />
                <div>
                  <h3 className="text-lg font-bold text-ink">FD packages</h3>
                  <p className="text-xs text-muted">
                    Admin configured follows the global setting, ‘No amount’ and ‘Custom’ override it for that package.
                  </p>
                </div>
              </div>

              {/* Filter bar */}
              <div className="grid gap-3 rounded-lg border border-[#E4E9FB] bg-[#FAFBFF] p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end">
                <label className="relative block">
                  <span className="sr-only">Search packages</span>
                  <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type="search"
                    placeholder="Search packages..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`${inputClass} pl-9`}
                  />
                </label>
                <FilterSelect Icon={LuCircleDot} label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} options={STATUS_OPTIONS} allLabel="All statuses" />
                <FilterSelect Icon={LuSettings} label="Pre-booking setting" value={filters.mode} onChange={(v) => setFilter('mode', v)} options={MODE_OPTIONS} allLabel="All settings" />
                <FilterSelect Icon={LuCreditCard} label="Payment at booking" value={filters.payment} onChange={(v) => setFilter('payment', v)} options={PAYMENT_OPTIONS} allLabel="All" />
                <FilterSelect Icon={LuCalendar} label="Departure period" value={filters.departure} onChange={(v) => setFilter('departure', v)} options={DEPARTURE_OPTIONS} allLabel="All time" />
                <button
                  type="button"
                  disabled={!hasFilters}
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setSearch('');
                  }}
                  className="inline-flex h-[42px] items-center justify-center gap-2 rounded-md border border-[#D7DDF0] bg-white px-3.5 text-xs font-semibold text-[#4F46E5] hover:border-[#6366F1] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LuFilterX className="h-4 w-4" />
                  Clear filters
                </button>
              </div>

              {chips.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted">Active filters:</span>
                  {chips.map((c) => (
                    <FilterChip key={c.key} onRemove={() => setFilter(c.key, '')}>
                      {c.label}
                    </FilterChip>
                  ))}
                </div>
              )}

              <div className="mt-4">
                {selected.size > 0 && <BulkBar count={selected.size} onApply={applyBulk} onClear={() => setSelected(new Set())} />}

                <div className="overflow-x-auto rounded-lg border border-[#E4E9FB]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#F3F4FF] text-xs text-[#4F46E5]">
                      <tr>
                        <th className="w-10 px-3 py-3">
                          <input
                            type="checkbox"
                            checked={allOnPageSelected}
                            onChange={(e) => togglePage(e.target.checked)}
                            aria-label="Select all packages on this page"
                            className="h-4 w-4 rounded border-[#CBD5E1] accent-[#4F46E5]"
                          />
                        </th>
                        <SortHeader label="Package" sortKey="title" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Pre-booking setting" sortKey="mode" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Custom %" sortKey="percentage" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Agent pays at booking" sortKey="effective" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Updated" sortKey="updatedAt" sort={sort} onSort={toggleSort} />
                        <th className="px-3 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted">
                            {packages.length === 0 ? 'No FD packages yet.' : 'No packages match these filters.'}
                          </td>
                        </tr>
                      ) : (
                        pageRows.map((pkg) => (
                          <PackageRow
                            key={`${pkg.id}-${pkg.prebookingMode}-${pkg.prebookingPercentage}-${pkg.updatedAt}`}
                            pkg={pkg}
                            settings={settings}
                            selected={selected.has(pkg.id)}
                            onSelect={(on) => toggleSelected(pkg.id, on)}
                            onSaved={handleSaved}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                  <span>
                    Showing {rangeStart}–{rangeEnd} of {sorted.length} package{sorted.length === 1 ? '' : 's'}
                  </span>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2">
                      Rows per page
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="rounded-md border border-[#D7DDF0] bg-white px-2 py-1.5 text-xs text-ink"
                      >
                        {PAGE_SIZES.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Pager page={currentPage} totalPages={totalPages} onChange={setPage} />
                  </div>
                </div>
              </div>
            </section>
            </>}

            {activeTab === 'platformFee' && <>
            {platformFee && <PlatformFeeSettingsCard settings={platformFee} onSaved={setPlatformFee} />}
            <section className="rounded-xl border border-[#E4E9FB] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)] sm:p-6">
              <div className="mb-5 flex gap-4"><IconTile Icon={LuPercent} /><div><h3 className="text-lg font-bold text-ink">Platform fee by package</h3><p className="text-xs text-muted">Manage each package's platform fee independently of pre-booking payments.</p></div></div>
              <div className="mb-4 grid gap-3 rounded-lg border border-[#E4E9FB] bg-[#FAFBFF] p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end"><label className="relative block"><span className="sr-only">Search packages</span><LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" /><LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" /><input type="search" placeholder="Search packages..." value={platformFeeSearch} onChange={(e) => setPlatformFeeSearch(e.target.value)} className={`${inputClass} pl-9`} /></label><FilterSelect Icon={LuCircleDot} label="Status" value={platformFeeStatusFilter} onChange={setPlatformFeeStatusFilter} options={STATUS_OPTIONS} allLabel="All statuses" /><FilterSelect Icon={LuSettings} label="Platform fee setting" value={platformFeeModeFilter} onChange={setPlatformFeeModeFilter} options={PLATFORM_FEE_MODE_OPTIONS} allLabel="All settings" /><FilterSelect Icon={LuPercent} label="Platform fee applied" value={platformFeeApplicationFilter} onChange={setPlatformFeeApplicationFilter} options={PLATFORM_FEE_APPLICATION_OPTIONS} allLabel="All" /><FilterSelect Icon={LuCalendar} label="Departure period" value={platformFeeDepartureFilter} onChange={setPlatformFeeDepartureFilter} options={DEPARTURE_OPTIONS} allLabel="All time" /><button type="button" onClick={() => { setPlatformFeeSearch(''); setPlatformFeeModeFilter(''); setPlatformFeeStatusFilter(''); setPlatformFeeApplicationFilter(''); setPlatformFeeDepartureFilter(''); }} disabled={!platformFeeSearch && !platformFeeModeFilter && !platformFeeStatusFilter && !platformFeeApplicationFilter && !platformFeeDepartureFilter} className="inline-flex h-[42px] items-center justify-center gap-2 rounded-md border border-[#D7DDF0] bg-white px-3.5 text-xs font-semibold text-[#4F46E5] disabled:cursor-not-allowed disabled:opacity-50"><LuFilterX className="h-4 w-4" />Clear filters</button></div>
              <div className="overflow-x-auto rounded-lg border border-[#E4E9FB]"><table className="w-full text-left text-sm"><thead className="bg-[#F3F4FF] text-xs text-[#4F46E5]"><tr><th className="px-3 py-3 font-semibold">Package</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Platform fee setting</th><th className="px-3 py-3 font-semibold">Custom %</th><th className="px-3 py-3 font-semibold">Platform fee applied</th><th className="px-3 py-3 font-semibold">Updated</th><th className="px-3 py-3 text-right font-semibold">Actions</th></tr></thead><tbody>{platformFeeRows.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted">No published packages match these filters.</td></tr> : platformFeeRows.map((pkg) => <PlatformFeePackageRow key={`${pkg.id}-${pkg.platformFeeMode}-${pkg.platformFeePercentage}`} pkg={pkg} platformFee={platformFee} onSaved={handleSaved} />)}</tbody></table></div>
            </section>
            </>}
          </>
        )}
      </div>
    </div>
  );
}
