import { useEffect, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LuSparkles } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Card } from './ui.jsx';
import { ChartTypeToggle, STATUS_COLORS } from './charts.jsx';
import { formatCompactNumber, formatCurrency } from '../../shared/currency.js';

// Shared building blocks for the admin Revenue page's tabs (Revenue.jsx) and
// the Detailed Revenue Analysis page (RevenueAnalysis.jsx). Everything here
// renders the response of GET /admin/analytics/revenue-analysis (see
// analytics.model.js#getRevenueAnalysis on the backend): KPIs for a range
// plus a comparison range, a day/week/month trend, abandoned bookings, and
// package/agency/country/channel/status breakdowns.

const INK = '#172554';
const MUTED = '#64748B';
const GRID = '#E4E9FB';
const ACCENT = '#4F46E5';
const ACCENT_LIGHT = '#818CF8';
const PREV = '#94A3B8';
const DANGER = '#EF4444';
const SERIES_COLORS = ['#4F46E5', '#2563EB', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DB2777', '#64748B'];

const TOOLTIP_BOX = 'rounded-lg border border-[#E4E9FB] bg-white px-3 py-2 text-xs shadow-[0_4px_16px_rgba(15,23,42,0.08)]';

// --- Dates & presets -------------------------------------------------------

// Local-time YYYY-MM-DD — toISOString() would shift to UTC and, east of
// GMT, turn e.g. "1 Sep 00:00" into "31 Aug".
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Same lookback windows BookingsDocuments.jsx offers, plus calendar ones.
// Every preset resolves to a concrete dateFrom/dateTo pair.
export const DATE_RANGE_OPTIONS = [
  { value: '', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '1d', label: 'Last 1 day' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: '1m', label: 'Last 1 month' },
  { value: '3m', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'thisYear', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

export function resolvePreset(preset) {
  const now = new Date();
  const today = ymd(now);
  const y = now.getFullYear();
  const m = now.getMonth();
  const back = (fn) => {
    const d = new Date(now);
    fn(d);
    return { dateFrom: ymd(d), dateTo: today };
  };
  switch (preset) {
    case 'today':
      return { dateFrom: today, dateTo: today };
    case '1d':
      return back((d) => d.setDate(d.getDate() - 1));
    case '7d':
      return back((d) => d.setDate(d.getDate() - 7));
    case '1m':
      return back((d) => d.setMonth(d.getMonth() - 1));
    case '3m':
      return back((d) => d.setMonth(d.getMonth() - 3));
    case '6m':
      return back((d) => d.setMonth(d.getMonth() - 6));
    case '12m':
      return back((d) => d.setMonth(d.getMonth() - 12));
    case 'thisMonth':
      return { dateFrom: ymd(new Date(y, m, 1)), dateTo: today };
    case 'lastMonth':
      return { dateFrom: ymd(new Date(y, m - 1, 1)), dateTo: ymd(new Date(y, m, 0)) };
    case 'thisYear':
      return { dateFrom: ymd(new Date(y, 0, 1)), dateTo: today };
    default:
      return { dateFrom: '', dateTo: '' };
  }
}

export function formatDay(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatRange(range) {
  if (!range) return '';
  if (range.dateFrom === range.dateTo) return formatDay(range.dateFrom);
  return `${formatDay(range.dateFrom)} – ${formatDay(range.dateTo)}`;
}

function parseBucket(bucket) {
  return new Date(`${bucket}T00:00:00`);
}

// Axis tick for a trend bucket ("14 Sep" / "Sep '26").
export function bucketTick(bucket, granularity) {
  const d = parseBucket(bucket);
  if (granularity === 'month') return `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

// Full label for tooltips / tables.
export function bucketLabel(bucket, granularity) {
  if (!bucket) return '—';
  const d = parseBucket(bucket);
  if (granularity === 'month') return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  if (granularity === 'week') return `Week of ${formatDay(bucket)}`;
  return formatDay(bucket);
}

// --- Labels ----------------------------------------------------------------

export const STATUS_OPTIONS = [
  'pending_payment', 'deposit_paid', 'confirmed', 'balance_due', 'fully_paid',
  'amendment_requested', 'cancellation_requested', 'cancelled', 'completed', 'waitlisted',
];
export const STATUS_LABEL = {
  pending_payment: 'Pending Payment',
  deposit_paid: 'Deposit Paid',
  confirmed: 'Confirmed',
  balance_due: 'Balance Due',
  fully_paid: 'Fully Paid',
  amendment_requested: 'Amendment Requested',
  cancellation_requested: 'Cancellation Requested',
  cancelled: 'Cancelled',
  completed: 'Completed',
  waitlisted: 'Waitlisted',
};
export const CHANNEL_LABEL = { self_service: 'Self-service (agent portal)', manual_admin: 'Manual (admin-created)' };

export const GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

// --- Formatters ------------------------------------------------------------

export const fmt = {
  currency: formatCurrency,
  count: (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN')),
  pct: (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`),
  decimal: (v) => (v == null ? '—' : Number(v).toFixed(2)),
};

function compactTick(v) {
  return formatCompactNumber(v);
}

export function percentChange(current, previous) {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous);
}

// --- Data hook -------------------------------------------------------------

// Fetches /admin/analytics/revenue-analysis. Keeps the last response on
// screen while a new one loads (no flash back to "Loading…" on every
// filter change); `loading` still flips so callers can dim the stale data.
export function useRevenueAnalysis(params) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api
      .get(`/admin/analytics/revenue-analysis?${qs}`)
      .then((data) => !cancelled && setState({ data, loading: false, error: '' }))
      .catch((err) => !cancelled && setState((s) => ({ ...s, loading: false, error: err.message || 'Unable to load revenue analysis' })));
    return () => {
      cancelled = true;
    };
  }, [qs]);

  return state;
}

// --- Small pieces ----------------------------------------------------------

// Change vs the comparison period. `invert` flips good/bad for metrics where
// up is bad (outstanding, abandoned); `points` shows a rate's change in
// percentage points instead of a relative %.
export function DeltaPill({ current, previous, invert = false, points = false, className = '' }) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (diff === 0) return <span className={`text-[11px] font-semibold text-muted ${className}`}>No change</span>;
  const up = diff > 0;
  const good = invert ? !up : up;
  let text;
  if (points) text = `${up ? '+' : ''}${(diff * 100).toFixed(1)} pts`;
  else if (previous === 0) text = 'New';
  else text = `${up ? '+' : ''}${((diff / Math.abs(previous)) * 100).toFixed(1)}%`;
  return (
    <span
      className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
        good ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'
      } ${className}`}
    >
      {up ? '▲' : '▼'} {text}
    </span>
  );
}

export function KpiCard({ label, value, previous, format = fmt.currency, icon: Icon, sub, invert, points, highlight, loading, prevPrefix = 'prev' }) {
  return (
    <div
      className={`relative rounded-lg border p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)] ${
        highlight ? 'border-transparent bg-gradient-to-br from-[#312E81] to-[#4F46E5] text-white' : 'border-white bg-white/95'
      } ${loading ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`text-xs font-medium ${highlight ? 'text-white/80' : 'text-muted'}`}>{label}</div>
        {Icon && <Icon size={16} className={`flex-none ${highlight ? 'text-white/80' : 'text-accent'}`} />}
      </div>
      <div className={`mt-2 text-2xl font-bold ${highlight ? 'text-white' : 'text-ink'}`}>{value == null ? '—' : format(value)}</div>
      {previous != null && (
        <div className={`mt-1.5 flex flex-wrap items-center gap-2 text-xs ${highlight ? 'text-white/75' : 'text-muted'}`}>
          <span>
            {prevPrefix} {format(previous)}
          </span>
          <DeltaPill current={value} previous={previous} invert={invert} points={points} />
        </div>
      )}
      {sub && <div className={`mt-1 text-xs ${highlight ? 'text-white/75' : 'text-muted'}`}>{sub}</div>}
    </div>
  );
}

// `cards`: [{ key, label, icon, format, sub?(current, previous), invert?, points?, highlight? }]
// where `key` is a field of kpis.current / kpis.previous.
export function KpiGrid({ kpis, cards, loading, columns = 'lg:grid-cols-4', prevPrefix }) {
  const cur = kpis?.current;
  const prev = kpis?.previous;
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${columns}`}>
      {cards.map((c) => (
        <KpiCard
          key={c.key + c.label}
          label={c.label}
          icon={c.icon}
          format={c.format}
          value={cur ? cur[c.key] : null}
          previous={prev ? prev[c.key] : null}
          invert={c.invert}
          points={c.points}
          highlight={c.highlight}
          loading={loading}
          prevPrefix={prevPrefix}
          sub={cur && c.sub ? c.sub(cur, prev) : null}
        />
      ))}
    </div>
  );
}

function SectionCard({ title, subtitle, action, children, className = '' }) {
  return (
    <Card className={`border-white ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-bold text-ink">{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-muted">{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

// --- Trend -----------------------------------------------------------------

const TREND_METRICS = [
  { value: 'revenue', label: 'Revenue', prevKey: 'prevRevenue', format: fmt.currency },
  { value: 'bookedValue', label: 'Booked value', format: fmt.currency },
  { value: 'bookings', label: 'Bookings', prevKey: 'prevBookings', format: fmt.count },
  { value: 'pax', label: 'Travellers', format: fmt.count },
];

// Revenue (or another metric) per day/week/month, with the comparison
// period's matching bucket overlaid as a dashed line — bucket i of the
// comparison range sits under bucket i of the current range.
// `metrics` / `revenueNote(row)` let another revenue stream (visa fees) reuse
// the card with its own metric list and tooltip line.
export function RevenueTrendCard({
  data,
  granularity,
  onGranularityChange,
  currentLabel = 'This period',
  prevLabel = 'Previous period',
  metrics = TREND_METRICS,
  revenueNote = (p) => `${fmt.count(p.bookings)} booking(s) · ${fmt.count(p.pax)} traveller(s) · booked ${fmt.currency(p.bookedValue)}`,
}) {
  const [metric, setMetric] = useState('revenue');
  const def = metrics.find((m) => m.value === metric);
  const hasPrev = Boolean(def.prevKey) && data.previousRange;
  const rows = data.trend.map((t) => ({
    ...t,
    current: t[metric],
    prev: hasPrev ? t[def.prevKey] : null,
  }));
  const total = data.trend.reduce((s, t) => s + (t[metric] || 0), 0);
  const g = data.granularity;

  return (
    <SectionCard
      title={`Total ${def.label.toLowerCase()} — ${def.format(total)}`}
      subtitle={`Aggregated by ${g}${hasPrev ? ` · dashed line: ${prevLabel}` : ''}`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <ChartTypeToggle options={metrics} value={metric} onChange={setMetric} />
          {onGranularityChange && <ChartTypeToggle options={GRANULARITY_OPTIONS} value={granularity || g} onChange={onGranularityChange} />}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev-analysis-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="bucket"
            tickFormatter={(b) => bucketTick(b, g)}
            tick={{ fontSize: 11, fill: MUTED }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={def.format === fmt.currency ? compactTick : undefined}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: MUTED }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <div className={TOOLTIP_BOX}>
                  <div className="mb-1 font-bold text-ink">{bucketLabel(p.bucket, g)}</div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: ACCENT }} />
                    {currentLabel}: <strong>{def.format(p.current)}</strong>
                  </div>
                  {hasPrev && p.prevBucket && (
                    <div className="mt-0.5 flex items-center gap-2 text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: PREV }} />
                      {bucketLabel(p.prevBucket, g)}: {def.format(p.prev)}
                    </div>
                  )}
                  {metric === 'revenue' && <div className="mt-1 border-t border-[#E4E9FB] pt-1 text-muted">{revenueNote(p)}</div>}
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="current" stroke={ACCENT} strokeWidth={2.5} fill="url(#rev-analysis-fill)" dot={false} activeDot={{ r: 5 }} />
          {hasPrev && <Line type="monotone" dataKey="prev" stroke={PREV} strokeWidth={2} strokeDasharray="5 4" dot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-5 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: ACCENT }} /> {currentLabel}
        </span>
        {hasPrev && (
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: PREV }} /> {prevLabel}
          </span>
        )}
      </div>
    </SectionCard>
  );
}

// Collected vs outstanding per bucket (stacked) — Payments tab / analysis page.
export function CollectionTrendCard({ data }) {
  const g = data.granularity;
  return (
    <SectionCard title="Collected vs outstanding over time" subtitle={`Per ${g}, by booking date — booked value split into what's paid and what's still owed`}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data.trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="bucket" tickFormatter={(b) => bucketTick(b, g)} tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={16} />
          <YAxis tickFormatter={compactTick} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <div className={TOOLTIP_BOX}>
                  <div className="mb-1 font-bold text-ink">{bucketLabel(p.bucket, g)}</div>
                  <div>Booked value: <strong>{fmt.currency(p.bookedValue)}</strong></div>
                  <div style={{ color: ACCENT }}>Collected: {fmt.currency(p.revenue)}</div>
                  <div style={{ color: ACCENT_LIGHT }}>Outstanding: {fmt.currency(p.outstanding)}</div>
                </div>
              );
            }}
          />
          <Bar dataKey="revenue" stackId="v" fill={ACCENT} maxBarSize={36} />
          <Bar dataKey="outstanding" stackId="v" fill={ACCENT_LIGHT} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

// --- Abandoned bookings ----------------------------------------------------

export function AbandonedCard({ data }) {
  const g = data.granularity;
  const k = data.kpis.current;
  return (
    <SectionCard
      title="Tried booking but didn't complete payment"
      subtitle={`Bookings left at "Pending Payment" with nothing paid, per ${g} — ${fmt.count(k.abandonedCount)} booking(s), ${fmt.currency(
        k.abandonedValue
      )} potential revenue`}
    >
      {k.abandonedCount === 0 ? (
        <p className="text-sm text-muted">No abandoned bookings in this period.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="bucket" tickFormatter={(b) => bucketTick(b, g)} tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={16} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              cursor={{ fill: 'rgba(239,68,68,0.06)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className={TOOLTIP_BOX}>
                    <div className="font-bold text-ink">{bucketLabel(p.bucket, g)}</div>
                    <div className="mb-1 text-muted">
                      Abandoned: {p.abandoned} · {fmt.currency(p.abandonedValue)}
                    </div>
                    {p.abandonedByPackage.map((pk) => (
                      <div key={pk.packageTitle} className="flex items-center gap-2">
                        <span className="h-2 w-2 flex-none rounded-full" style={{ background: DANGER }} />
                        <span className="flex-1">{pk.packageTitle}</span>
                        <strong>{pk.count}</strong>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Bar dataKey="abandoned" fill={DANGER} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}

// --- Rankings & shares -----------------------------------------------------

// Ranked list — rank, name, share-of-revenue bar, revenue, change vs the
// comparison period.
// `units` labels the count columns ("bkg" / "pax" for bookings; visa fees
// use "apps" / "travellers").
export function TopPerformersCard({
  title,
  subtitle,
  rows,
  totalRevenue,
  showPrev,
  emptyText = 'Nothing to rank in this period.',
  limit = 10,
  secondary,
  units = { count: 'bkg', people: 'pax' },
}) {
  const list = rows.slice(0, limit);
  return (
    <SectionCard title={title} subtitle={subtitle}>
      {list.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <ol className="space-y-3">
          {list.map((r, i) => {
            const share = totalRevenue > 0 ? r.revenue / totalRevenue : 0;
            return (
              <li key={r.id ?? r.name} className="text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-5 flex-none text-right text-xs text-muted">{i + 1}</span>
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">
                    {r.name}
                    {secondary && secondary(r) && <span className="ml-1 text-xs font-normal text-muted">· {secondary(r)}</span>}
                  </span>
                  {showPrev && <DeltaPill current={r.revenue} previous={r.prevRevenue} />}
                  <span className="w-28 flex-none text-right font-bold text-ink">{fmt.currency(r.revenue)}</span>
                </div>
                <div className="ml-[3.25rem] mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEF1FB]">
                    <div className="h-full rounded-full" style={{ width: `${share * 100}%`, background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                  </div>
                  <span className="w-44 flex-none text-right text-[11px] text-muted">
                    {(share * 100).toFixed(1)}% · {r.bookings} {units.count} · {r.pax} {units.people}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

// Donut + legend for a small categorical split (channel, country, status).
// `countUnit` / `countShort` label the per-slice count (bookings by default).
export function ShareDonutCard({
  title,
  subtitle,
  rows,
  labelFor,
  colorFor,
  valueKey = 'revenue',
  format = fmt.currency,
  countUnit = 'booking(s)',
  countShort = 'bkg',
}) {
  const total = rows.reduce((s, r) => s + (r[valueKey] || 0), 0);
  const withValue = rows.filter((r) => r[valueKey] > 0);
  const color = (r, i) => (colorFor ? colorFor(r) : SERIES_COLORS[i % SERIES_COLORS.length]);
  return (
    <SectionCard title={title} subtitle={subtitle}>
      {withValue.length === 0 ? (
        <p className="text-sm text-muted">Nothing to show for this period.</p>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="h-48 w-48 flex-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={withValue} dataKey={valueKey} nameKey="key" innerRadius="58%" outerRadius="90%" paddingAngle={2} stroke="none">
                  {withValue.map((r, i) => (
                    <Cell key={i} fill={color(r, i)} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const r = payload[0].payload;
                    return (
                      <div className={TOOLTIP_BOX}>
                        <div className="font-bold text-ink">{labelFor(r)}</div>
                        <div>{format(r[valueKey])}</div>
                        <div className="text-muted">
                          {r.bookings} {countUnit}
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full min-w-0 flex-1 space-y-2">
            {rows.map((r, i) => (
              <div key={labelFor(r)} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: color(r, i) }} />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink" title={labelFor(r)}>
                  {labelFor(r)}
                </span>
                <span className="flex-none text-muted">
                  {r.bookings} {countShort}
                </span>
                <span className="flex-none text-right font-semibold">{format(r[valueKey])}</span>
                <span className="w-10 flex-none text-right text-muted">{total > 0 ? `${Math.round((r[valueKey] / total) * 100)}%` : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export function statusColor(r) {
  return STATUS_COLORS[r.status] || MUTED;
}

// --- Insights --------------------------------------------------------------

// Plain-language observations derived from the same response — nothing here
// is fetched separately or estimated.
export function buildInsights(data, prevLabel = 'the previous period') {
  const out = [];
  const cur = data.kpis.current;
  const prev = data.kpis.previous;
  const g = data.granularity;

  if (prev) {
    const change = percentChange(cur.totalRevenue, prev.totalRevenue);
    if (change != null && change !== 0) {
      out.push(
        `Revenue is ${change > 0 ? 'up' : 'down'} ${Math.abs(change * 100).toFixed(1)}% vs ${prevLabel} (${fmt.currency(cur.totalRevenue)} vs ${fmt.currency(
          prev.totalRevenue
        )}).`
      );
    } else if (prev.totalRevenue === 0 && cur.totalRevenue > 0) {
      out.push(`${fmt.currency(cur.totalRevenue)} earned — ${prevLabel} had no revenue.`);
    }
  }

  const topPkg = data.topPackages[0];
  if (topPkg && cur.totalRevenue > 0 && topPkg.revenue > 0) {
    out.push(`${topPkg.name} led with ${Math.round((topPkg.revenue / cur.totalRevenue) * 100)}% of revenue (${fmt.currency(topPkg.revenue)}).`);
  }
  const topAgency = data.topAgencies[0];
  if (topAgency && topAgency.revenue > 0) {
    out.push(`${topAgency.name}${topAgency.country ? ` (${topAgency.country})` : ''} generated the most revenue (${fmt.currency(topAgency.revenue)}).`);
  }
  const topCountry = data.byCountry[0];
  if (topCountry && topCountry.revenue > 0 && data.byCountry.length > 1) {
    out.push(`${topCountry.country} is the top market with ${fmt.currency(topCountry.revenue)}.`);
  }

  const best = [...data.trend].sort((a, b) => b.revenue - a.revenue)[0];
  if (best && best.revenue > 0 && data.trend.length > 1) {
    out.push(`Best ${g}: ${bucketLabel(best.bucket, g)} with ${fmt.currency(best.revenue)}.`);
  }

  if (cur.outstanding > 0) {
    out.push(`${fmt.currency(cur.outstanding)} is still outstanding — ${fmt.pct(cur.collectionRate)} of booked value collected so far.`);
  }
  if (cur.abandonedCount > 0) {
    out.push(`${fmt.currency(cur.abandonedValue)} of potential revenue is sitting in ${cur.abandonedCount} abandoned booking(s).`);
  }
  if (cur.refundRequestCount > 0) {
    out.push(`${cur.refundRequestCount} refund request(s) totalling ${fmt.currency(cur.refundRequestedAmount)} were raised.`);
  }
  const selfService = data.byChannel.find((c) => c.createdVia === 'self_service');
  if (selfService && cur.totalRevenue > 0 && data.byChannel.length > 1) {
    out.push(`Self-service bookings brought in ${Math.round((selfService.revenue / cur.totalRevenue) * 100)}% of revenue.`);
  }

  if (prev) {
    const movers = data.topPackages
      .filter((p) => p.prevRevenue != null)
      .map((p) => ({ ...p, diff: p.revenue - p.prevRevenue }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    const mover = movers[0];
    if (mover && mover.diff !== 0) {
      out.push(`Biggest mover: ${mover.name} (${mover.diff > 0 ? '+' : '−'}${fmt.currency(Math.abs(mover.diff))} vs ${prevLabel}).`);
    }
  }

  if (cur.totalBookings === 0) out.push('No bookings were made in this period.');
  return out;
}

export function InsightsCard({ data, prevLabel }) {
  const insights = buildInsights(data, prevLabel);
  if (insights.length === 0) return null;
  return (
    <Card className="border-white">
      <div className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
        <LuSparkles size={18} className="text-[#F59E0B]" /> Revenue insights
      </div>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
        {insights.map((text) => (
          <li key={text} className="flex gap-2 text-sm text-ink">
            <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-[#F59E0B]" />
            {text}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// --- Tables ----------------------------------------------------------------

export function PeriodTable({ data }) {
  const g = data.granularity;
  const hasPrev = Boolean(data.previousRange);
  const rows = [...data.trend].reverse();
  const headers = ['Period', 'Bookings', 'Travellers', 'Booked value', 'Revenue', 'Outstanding', 'Abandoned', ...(hasPrev ? ['Prev. revenue', 'Change'] : [])];
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-[#E4E9FB]">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0">
          <tr className="bg-[#F3F4FF]">
            {headers.map((h, i) => (
              <th key={h} className={`whitespace-nowrap border-b border-[#E4E9FB] px-3 py-2 font-semibold uppercase text-[#4F46E5] ${i ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.bucket} className="border-b border-line-light last:border-0">
              <td className="whitespace-nowrap px-3 py-2 font-semibold">{bucketLabel(t.bucket, g)}</td>
              <td className="px-3 py-2 text-right">{fmt.count(t.bookings)}</td>
              <td className="px-3 py-2 text-right">{fmt.count(t.pax)}</td>
              <td className="px-3 py-2 text-right">{fmt.currency(t.bookedValue)}</td>
              <td className="px-3 py-2 text-right font-semibold">{fmt.currency(t.revenue)}</td>
              <td className="px-3 py-2 text-right">{fmt.currency(t.outstanding)}</td>
              <td className="px-3 py-2 text-right">{t.abandoned || '—'}</td>
              {hasPrev && <td className="px-3 py-2 text-right text-muted">{t.prevRevenue == null ? '—' : fmt.currency(t.prevRevenue)}</td>}
              {hasPrev && (
                <td className="px-3 py-2 text-right">
                  <DeltaPill current={t.revenue} previous={t.prevRevenue} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- CSV export ------------------------------------------------------------

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename, sections) {
  const lines = [];
  for (const section of sections) {
    if (lines.length) lines.push('');
    lines.push(csvCell(section.title));
    lines.push(section.headers.map(csvCell).join(','));
    for (const row of section.rows) lines.push(row.map(csvCell).join(','));
  }
  // BOM so Excel opens non-ASCII names correctly.
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const KPI_EXPORT = [
  ['totalRevenue', 'Total revenue (collected)'],
  ['netRevenue', 'Net revenue (after refund requests)'],
  ['bookedValue', 'Booked value'],
  ['outstanding', 'Outstanding'],
  ['collectionRate', 'Collection rate'],
  ['totalBookings', 'Total bookings'],
  ['revenueBookings', 'Bookings with payment'],
  ['averageBookingValue', 'Avg. booking value'],
  ['totalPax', 'Travellers'],
  ['averagePaxPerBooking', 'Avg. travellers / booking'],
  ['abandonedCount', 'Abandoned bookings'],
  ['abandonedValue', 'Abandoned value'],
  ['cancelledCount', 'Cancelled bookings'],
  ['cancelledValue', 'Cancelled value'],
  ['refundRequestCount', 'Refund requests'],
  ['refundRequestedAmount', 'Refund requested amount'],
  ['activeAgencies', 'Active agencies'],
  ['activePackages', 'Packages booked'],
];

// Rates/averages come back as raw floats; 4 decimals is plenty for a sheet.
const round4 = (v) => (typeof v === 'number' ? Math.round(v * 10000) / 10000 : v);

export function buildAnalysisCsv(data, filterSummary) {
  const g = data.granularity;
  const cur = data.kpis.current;
  const prev = data.kpis.previous;
  const breakdownRows = (rows, withCountry) =>
    rows.map((r) => [
      r.name,
      ...(withCountry ? [r.country || ''] : []),
      r.bookings,
      r.pax,
      r.bookedValue,
      r.revenue,
      r.outstanding,
      r.abandoned,
      ...(prev ? [r.prevRevenue] : []),
    ]);
  const breakdownHeaders = (first, withCountry) => [
    first,
    ...(withCountry ? ['Country'] : []),
    'Bookings',
    'Travellers',
    'Booked value',
    'Revenue',
    'Outstanding',
    'Abandoned',
    ...(prev ? ['Prev. revenue'] : []),
  ];

  return [
    {
      title: 'Revenue analysis',
      headers: ['Field', 'Value'],
      rows: [
        ['Period', formatRange(data.range)],
        ['Compared with', data.previousRange ? formatRange(data.previousRange) : '—'],
        ['Aggregated by', g],
        ...filterSummary.map(([k, v]) => [k, v]),
      ],
    },
    {
      title: 'Key figures',
      headers: ['Metric', 'This period', ...(prev ? ['Compared period', 'Change %'] : [])],
      rows: KPI_EXPORT.map(([key, label]) => {
        const change = prev ? percentChange(cur[key], prev[key]) : null;
        return [label, round4(cur[key]), ...(prev ? [round4(prev[key]), change == null ? '' : (change * 100).toFixed(1)] : [])];
      }),
    },
    {
      title: `By ${g}`,
      headers: ['Period start', 'Bookings', 'Travellers', 'Booked value', 'Revenue', 'Outstanding', 'Abandoned', 'Abandoned value', ...(prev ? ['Prev. period start', 'Prev. revenue', 'Prev. bookings'] : [])],
      rows: data.trend.map((t) => [
        t.bucket,
        t.bookings,
        t.pax,
        t.bookedValue,
        t.revenue,
        t.outstanding,
        t.abandoned,
        t.abandonedValue,
        ...(prev ? [t.prevBucket || '', t.prevRevenue ?? '', t.prevBookings ?? ''] : []),
      ]),
    },
    { title: 'By package', headers: breakdownHeaders('Package'), rows: breakdownRows(data.topPackages) },
    { title: 'By agency', headers: breakdownHeaders('Agency', true), rows: breakdownRows(data.topAgencies, true) },
    { title: 'By country', headers: ['Country', 'Bookings', 'Revenue', 'Total value'], rows: data.byCountry.map((r) => [r.country, r.bookings, r.revenue, r.value]) },
    {
      title: 'By channel',
      headers: ['Channel', 'Bookings', 'Revenue', 'Total value'],
      rows: data.byChannel.map((r) => [CHANNEL_LABEL[r.createdVia] || r.createdVia, r.bookings, r.revenue, r.value]),
    },
    {
      title: 'By booking status',
      headers: ['Status', 'Bookings', 'Revenue', 'Total value'],
      rows: data.byStatus.map((r) => [STATUS_LABEL[r.status] || r.status, r.bookings, r.revenue, r.value]),
    },
  ];
}
