import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  LuArrowLeft,
  LuCalendarDays,
  LuCheck,
  LuCircleDollarSign,
  LuClock3,
  LuPlaneTakeoff,
  LuUsers,
  LuWallet,
  LuX,
} from 'react-icons/lu';
import { Card } from '../ui.jsx';
import { CHART_THEME, CollectedVsOutstandingBar, StatusDonutChart } from '../charts.jsx';
import { formatCompactCurrency, formatCurrency } from '../../../shared/currency.js';

// Booking & Visa Processing analytics (admin/pages/BookingsDocuments.jsx).
// The page itself keeps only the summary cards; the charts live behind its
// "View Analytics" button in BookingAnalyticsView below.
//
// Money fields come straight off GET /admin/bookings: `depositPaid` is the
// running amount paid to date (paymentConfirmation.service.js adds every
// payment to it), so "collected" = depositPaid and "outstanding" =
// balanceDue. Cancelled bookings are left out of value/collection totals —
// they're still counted in volume and the status breakdown.

const { INK, MUTED, GRID, ACCENT, ACCENT_LIGHT, TOOLTIP_STYLE } = CHART_THEME;
const AXIS = { tick: { fontSize: 11, fill: MUTED }, tickLine: false };
const OPEN_PAYMENT_STATUSES = new Set(['pending_payment', 'balance_due', 'deposit_paid']);

// Status donut colours for this view. The shared STATUS_COLORS (charts.jsx)
// makes pending_payment/balance_due two near-identical ambers and
// fully_paid/confirmed two greens; these are the CVD-checked violet / sky /
// amber / green hues used elsewhere in the admin, with cancelled as a
// deliberate neutral. Every slice is also labelled with count and %.
const BOOKING_STATUS_COLORS = {
  pending_payment: '#7C3AED',
  confirmed: '#0284C7',
  deposit_paid: '#0284C7',
  balance_due: '#D97706',
  fully_paid: '#059669',
  completed: '#059669',
  cancelled: '#64748B',
};

const PERIODS = [
  { value: 6, label: '6M' },
  { value: 12, label: '12M' },
  { value: 0, label: 'All' },
];

const statusLabel = (status) => String(status || 'other').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const compactMoney = (value) => formatCompactCurrency(Number(value) || 0);
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key, withYear) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, withYear ? { month: 'short', year: '2-digit' } : { month: 'short' });
};

function summarize(bookings) {
  let value = 0;
  let collected = 0;
  let outstanding = 0;
  let pax = 0;
  let awaitingPayment = 0;
  let fullyPaid = 0;
  for (const b of bookings) {
    pax += Number(b.pax) || 0;
    if (b.status === 'fully_paid') fullyPaid += 1;
    if (OPEN_PAYMENT_STATUSES.has(b.status)) awaitingPayment += 1;
    if (b.status === 'cancelled') continue;
    value += Number(b.totalPrice) || 0;
    collected += Number(b.depositPaid) || 0;
    outstanding += Number(b.balanceDue) || 0;
  }
  return { count: bookings.length, value, collected, outstanding, pax, awaitingPayment, fullyPaid };
}

// Ranked roll-up by agency or package — the "View All" tables and the
// top-5 bars both read from this.
function rank(bookings, keyField, nameField, fallback) {
  const map = new Map();
  for (const b of bookings) {
    const key = b[keyField] || b[nameField] || fallback;
    const row = map.get(key) || { key, name: b[nameField] || fallback, bookings: 0, pax: 0, value: 0, collected: 0, outstanding: 0 };
    row.bookings += 1;
    row.pax += Number(b.pax) || 0;
    if (b.status !== 'cancelled') {
      row.value += Number(b.totalPrice) || 0;
      row.collected += Number(b.depositPaid) || 0;
      row.outstanding += Number(b.balanceDue) || 0;
    }
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.bookings - a.bookings || b.value - a.value);
}

// Real calendar months, oldest first, every month present even when empty —
// the old version bucketed by month *name* only (Sep 2025 and Sep 2026
// merged) in whatever order bookings happened to arrive.
function monthlySeries(bookings, months) {
  const now = new Date();
  let keys;
  if (months > 0) {
    keys = Array.from({ length: months }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)));
  } else {
    const all = bookings.map((b) => monthKey(new Date(b.createdAt))).sort();
    keys = [];
    if (all.length) {
      const [y0, m0] = all[0].split('-').map(Number);
      for (let d = new Date(y0, m0 - 1, 1); monthKey(d) <= monthKey(now); d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) keys.push(monthKey(d));
    }
  }
  const multiYear = new Set(keys.map((k) => k.slice(0, 4))).size > 1;
  const rows = new Map(keys.map((k) => [k, { key: k, month: monthLabel(k, multiYear), bookings: 0, pax: 0, collected: 0, outstanding: 0 }]));
  for (const b of bookings) {
    const row = rows.get(monthKey(new Date(b.createdAt)));
    if (!row) continue;
    row.bookings += 1;
    row.pax += Number(b.pax) || 0;
    if (b.status !== 'cancelled') {
      row.collected += Number(b.depositPaid) || 0;
      row.outstanding += Number(b.balanceDue) || 0;
    }
  }
  return [...rows.values()];
}

function upcomingDepartures(bookings) {
  const now = new Date();
  const keys = Array.from({ length: 6 }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  const rows = new Map(keys.map((k) => [k, { key: k, month: monthLabel(k, false), bookings: 0, pax: 0 }]));
  for (const b of bookings) {
    if (b.status === 'cancelled' || !b.departureDate) continue;
    const row = rows.get(String(b.departureDate).slice(0, 7));
    if (!row) continue;
    row.bookings += 1;
    row.pax += Number(b.pax) || 0;
  }
  return [...rows.values()];
}

// --- Summary cards (always on the page) -------------------------------------

// `title` carries the exact figure when `value` is a compacted amount.
function Metric({ label, value, title, hint, icon: Icon, tone }) {
  return (
    <Card className="border-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
          <div className="mt-2 truncate text-xl font-bold tabular-nums text-ink" title={title}>{value}</div>
          {hint && <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted">{hint}</div>}
        </div>
        <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${tone}`}>
          <Icon size={17} />
        </span>
      </div>
    </Card>
  );
}

function MetricGrid({ summary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Metric label="Total bookings" value={summary.count} hint={`${summary.pax} travellers`} icon={LuCalendarDays} tone="bg-blue-50 text-blue-600" />
      <Metric label="Booking value" value={compactMoney(summary.value)} title={formatCurrency(summary.value)} hint="Excludes cancelled" icon={LuCircleDollarSign} tone="bg-emerald-50 text-emerald-600" />
      <Metric label="Amount collected" value={compactMoney(summary.collected)} title={formatCurrency(summary.collected)} hint={summary.value ? `${Math.round((summary.collected / summary.value) * 100)}% of value` : undefined} icon={LuWallet} tone="bg-indigo-50 text-indigo-600" />
      <Metric label="Balance due" value={compactMoney(summary.outstanding)} title={formatCurrency(summary.outstanding)} hint="Still to collect" icon={LuClock3} tone="bg-rose-50 text-rose-600" />
      <Metric label="Fully paid" value={summary.fullyPaid} hint="Bookings" icon={LuCheck} tone="bg-emerald-50 text-emerald-600" />
      <Metric label="Awaiting payment" value={summary.awaitingPayment} hint="Pending or balance due" icon={LuUsers} tone="bg-amber-50 text-amber-600" />
    </div>
  );
}

export function BookingSummaryCards({ bookings, loading }) {
  const summary = useMemo(() => summarize(bookings), [bookings]);
  if (loading) {
    return (
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[92px] animate-pulse rounded-lg bg-white" />)}
      </div>
    );
  }
  return (
    <div className="mb-5">
      <MetricGrid summary={summary} />
    </div>
  );
}

// --- Analytics view ----------------------------------------------------------

function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <Card className={`min-w-0 border-white p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Empty({ text = 'No bookings in this period.', height = 240 }) {
  return (
    <div className="flex items-center justify-center rounded-md bg-panel/50 text-xs text-muted" style={{ height }}>
      {text}
    </div>
  );
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function RankedBars({ rows, height = 230 }) {
  if (!rows.length) return <Empty height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...AXIS} axisLine={{ stroke: GRID }} />
        <YAxis type="category" dataKey="name" width={165} tick={{ fontSize: 11, fill: INK }} axisLine={false} tickLine={false} tickFormatter={(v) => (v.length > 24 ? `${v.slice(0, 23)}…` : v)} />
        <Tooltip
          {...TOOLTIP_STYLE}
          cursor={{ fill: '#F6F7FF' }}
          formatter={(value, _name, entry) => [`${value} bookings · ${entry.payload.pax} pax · ${formatCurrency(entry.payload.value)}`, 'Volume']}
        />
        <Bar dataKey="bookings" fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ViewAllButton({ onClick, count }) {
  return (
    <button type="button" onClick={onClick} disabled={!count} className="text-xs font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-40">
      View all{count ? ` (${count})` : ''}
    </button>
  );
}

const SORTS = {
  bookings: { label: 'Bookings', fn: (a, b) => b.bookings - a.bookings },
  value: { label: 'Value', fn: (a, b) => b.value - a.value },
  outstanding: { label: 'Balance due', fn: (a, b) => b.outstanding - a.outstanding },
};

function RankingModal({ title, nameLabel, rows, onClose }) {
  const [sort, setSort] = useState('bookings');
  const [query, setQuery] = useState('');
  const visible = rows
    .filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort(SORTS[sort].fn);
  const th = 'whitespace-nowrap px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#4F46E5]';
  const td = 'whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-ink';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg border border-line-light bg-white shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-line-light p-5">
          <div>
            <h3 className="text-lg font-bold text-ink">{title}</h3>
            <p className="text-xs text-muted">{rows.length} in the selected period</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
            <LuX size={18} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-line-light px-5 py-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${nameLabel.toLowerCase()}…`}
            className="h-9 min-w-0 flex-1 rounded-md border border-line-light px-3 text-xs focus:border-accent focus:outline-none sm:max-w-xs"
          />
          <div className="ml-auto flex items-center gap-1 rounded-full border border-line-light bg-panel/60 p-0.5">
            {Object.entries(SORTS).map(([key, s]) => (
              <button key={key} type="button" onClick={() => setSort(key)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${sort === key ? 'bg-white text-accent shadow-sm' : 'text-muted hover:text-ink'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[#F3F4FF]">
              <tr>
                <th className={th}>#</th>
                <th className={th}>{nameLabel}</th>
                <th className={`${th} text-right`}>Bookings</th>
                <th className={`${th} text-right`}>Pax</th>
                <th className={`${th} text-right`}>Value</th>
                <th className={`${th} text-right`}>Collected</th>
                <th className={`${th} text-right`}>Balance due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {visible.map((r, i) => (
                <tr key={r.key} className="hover:bg-panel/40">
                  <td className={`${td} text-muted`}>{i + 1}</td>
                  <td className="max-w-[260px] truncate px-3 py-2.5 text-xs font-semibold text-ink" title={r.name}>{r.name}</td>
                  <td className={`${td} text-right font-semibold`}>{r.bookings}</td>
                  <td className={`${td} text-right`}>{r.pax}</td>
                  <td className={`${td} text-right`}>{formatCurrency(r.value)}</td>
                  <td className={`${td} text-right text-[#047857]`}>{formatCurrency(r.collected)}</td>
                  <td className={`${td} text-right ${r.outstanding ? 'text-[#B45309]' : 'text-muted'}`}>{formatCurrency(r.outstanding)}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-xs text-muted">No matches.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function BookingAnalyticsView({ bookings, loading, onBack }) {
  const [months, setMonths] = useState(6);
  const [viewAll, setViewAll] = useState(null);

  const data = useMemo(() => {
    const cutoff = months > 0 ? new Date(new Date().getFullYear(), new Date().getMonth() - (months - 1), 1) : null;
    const inPeriod = cutoff ? bookings.filter((b) => new Date(b.createdAt) >= cutoff) : bookings;
    const statusCounts = {};
    const channels = { self_service: 0, manual_admin: 0 };
    for (const b of inPeriod) {
      statusCounts[b.status || 'other'] = (statusCounts[b.status || 'other'] || 0) + 1;
      if (b.createdVia in channels) channels[b.createdVia] += 1;
    }
    return {
      inPeriod,
      summary: summarize(inPeriod),
      monthly: monthlySeries(inPeriod, months),
      statuses: Object.entries(statusCounts).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
      packages: rank(inPeriod, 'fdPackageId', 'packageTitle', 'Unspecified package'),
      agents: rank(inPeriod, 'agencyId', 'agencyName', 'Unknown agency'),
      channels,
      upcoming: upcomingDepartures(bookings),
    };
  }, [bookings, months]);

  const periodLabel = months ? `Last ${months} months` : 'All time';
  const hasVolume = data.monthly.some((m) => m.bookings);
  const hasMoney = data.monthly.some((m) => m.collected || m.outstanding);
  const channelTotal = data.channels.self_service + data.channels.manual_admin;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Back to bookings" className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-line-light bg-white text-muted hover:border-accent hover:text-accent">
            <LuArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-ink">Booking Analytics</h2>
            <p className="text-sm text-muted">Volume, payments, packages and agents — {periodLabel.toLowerCase()}.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-line-light bg-white p-1 shadow-sm" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.value} type="button" onClick={() => setMonths(p.value)} aria-pressed={months === p.value} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${months === p.value ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[92px] animate-pulse rounded-lg bg-white" />)}
          </div>
          <div className="h-72 animate-pulse rounded-lg bg-white" />
        </div>
      ) : (
        <div className="space-y-4">
          <MetricGrid summary={data.summary} />

          <Panel title="Collection progress" subtitle={`${periodLabel} · excludes cancelled bookings`}>
            <CollectedVsOutstandingBar totalBookedValue={data.summary.value} totalCollected={data.summary.collected} totalOutstanding={data.summary.outstanding} />
          </Panel>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel title="Booking volume trend" subtitle={`Bookings created per month · ${periodLabel.toLowerCase()}`}>
              {hasVolume ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.monthly} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bookingVolumeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="month" {...AXIS} axisLine={{ stroke: GRID }} minTickGap={12} />
                    <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={36} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(value, _n, entry) => [`${value} bookings · ${entry.payload.pax} pax`, 'Volume']} />
                    <Area type="monotone" dataKey="bookings" stroke={ACCENT} strokeWidth={2} fill="url(#bookingVolumeFill)" dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Empty height={260} />
              )}
            </Panel>
            <Panel title="Booking status breakdown" subtitle={`${data.inPeriod.length} bookings · ${periodLabel.toLowerCase()}`}>
              <StatusDonutChart data={data.statuses} statusLabel={statusLabel} colorMap={BOOKING_STATUS_COLORS} emptyText="No bookings in this period." />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel
              title="Payment collection trend"
              subtitle="Collected vs balance due, by the month the booking was made"
              action={<Legend items={[{ label: 'Collected', color: ACCENT }, { label: 'Balance due', color: ACCENT_LIGHT }]} />}
            >
              {hasMoney ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="month" {...AXIS} axisLine={{ stroke: GRID }} minTickGap={12} />
                    <YAxis tickFormatter={compactMoney} {...AXIS} axisLine={false} width={52} />
                    <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: '#F6F7FF' }} formatter={(value, name) => [formatCurrency(value), name]} />
                    <Bar dataKey="collected" name="Collected" stackId="money" fill={ACCENT} maxBarSize={34} />
                    <Bar dataKey="outstanding" name="Balance due" stackId="money" fill={ACCENT_LIGHT} radius={[4, 4, 0, 0]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty height={250} />
              )}
            </Panel>
            <Panel title="Upcoming departures" subtitle="Booked travellers departing in the next 6 months (all bookings, not cancelled)">
              {data.upcoming.some((u) => u.pax) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.upcoming} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="month" {...AXIS} axisLine={{ stroke: GRID }} />
                    <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={36} />
                    <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: '#F6F7FF' }} formatter={(value, _n, entry) => [`${value} travellers · ${entry.payload.bookings} bookings`, 'Departing']} />
                    <Bar dataKey="pax" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty height={250} text="No departures booked in the next 6 months." />
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Top packages by booking volume" subtitle={`Top 5 of ${data.packages.length}`} action={<ViewAllButton count={data.packages.length} onClick={() => setViewAll('packages')} />}>
              <RankedBars rows={data.packages.slice(0, 5)} />
            </Panel>
            <Panel title="Bookings by agent" subtitle={`Top 5 of ${data.agents.length}`} action={<ViewAllButton count={data.agents.length} onClick={() => setViewAll('agents')} />}>
              <RankedBars rows={data.agents.slice(0, 5)} />
            </Panel>
          </div>

          <Panel title="Booking channel" subtitle="How bookings were created in this period">
            {channelTotal ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: 'self_service', label: 'Self-service by agents', icon: LuUsers },
                  { key: 'manual_admin', label: 'Manual (created by admin)', icon: LuPlaneTakeoff },
                ].map(({ key, label, icon: Icon }) => {
                  const n = data.channels[key];
                  const pct = Math.round((n / channelTotal) * 100);
                  return (
                    <div key={key} className="rounded-lg border border-line-light p-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-2 font-semibold text-ink">
                          <Icon size={14} className="text-accent" /> {label}
                        </span>
                        <span className="tabular-nums text-muted">
                          <strong className="text-ink">{n}</strong> · {pct}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty height={80} />
            )}
          </Panel>
        </div>
      )}

      {viewAll === 'packages' && <RankingModal title="All packages by booking volume" nameLabel="Package" rows={data.packages} onClose={() => setViewAll(null)} />}
      {viewAll === 'agents' && <RankingModal title="All agents by booking volume" nameLabel="Agency" rows={data.agents} onClose={() => setViewAll(null)} />}
    </div>
  );
}
