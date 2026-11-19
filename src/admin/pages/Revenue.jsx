import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LuArrowLeftRight,
  LuBanknote,
  LuBuilding2,
  LuChartColumn,
  LuCircleAlert,
  LuHandCoins,
  LuLayoutGrid,
  LuPercent,
  LuReceiptText,
  LuStamp,
  LuTrendingUp,
  LuTriangleAlert,
  LuUndo2,
  LuUsers,
  LuWallet,
  LuX,
} from 'react-icons/lu';
import { api } from '../api/client.js';
import { Card, Pagination, Select, TextInput } from '../components/ui.jsx';
import {
  BREAKDOWN_CHART_TYPES,
  ChartTypeToggle,
  COMPARE_COLOR_A,
  COMPARE_COLOR_B,
  ComparisonBreakdownChart,
  CollectedVsOutstandingBar,
  STATUS_CHART_TYPES,
  StatusDonutChart,
  TopRevenueBarChart,
} from '../components/charts.jsx';
import {
  AbandonedCard,
  CHANNEL_LABEL,
  CollectionTrendCard,
  DATE_RANGE_OPTIONS,
  DeltaPill,
  InsightsCard,
  KpiGrid,
  MONTH_NAMES,
  RevenueTrendCard,
  STATUS_LABEL,
  STATUS_OPTIONS,
  ShareDonutCard,
  TopPerformersCard,
  fmt,
  formatDay,
  formatRange,
  resolvePreset,
  statusColor,
  useRevenueAnalysis,
  ymd,
} from '../components/revenueAnalysis.jsx';

// Admin Revenue page — a separate, more focused nav item from "Sales,
// Revenue & Profit" (Analytics.jsx), which stays exactly as it was. Every
// tab is driven by GET /admin/analytics/revenue-analysis
// (analytics.model.js#getRevenueAnalysis): one server-side aggregation that
// returns KPIs for the selected range and a comparison range, a day/week/
// month trend, abandoned bookings, and package/agency/country/channel/status
// breakdowns — so every number on every tab agrees. Each tab's own filters
// (search, country, status) are real query params, never a client-side
// .filter() over fetched rows.
//
// Comparison: by default every figure is shown against the equal-length
// period immediately before the selected one ("prev …"). The Compare button
// swaps that for two explicitly chosen periods (day / month / year).
//
// FD-only, same as every number in Analytics.jsx — package_request/mice_rfq
// bookings don't exist yet. Profit/margin is intentionally absent: the
// schema has no cost basis for FD bookings (see getSummary's profitMargin).
const TABS = [
  { key: 'overview', label: 'Overview', icon: LuBanknote },
  { key: 'byPackage', label: 'By Package', icon: LuLayoutGrid },
  { key: 'byAgent', label: 'By Agent', icon: LuBuilding2 },
  { key: 'payments', label: 'Payments Collected vs Outstanding', icon: LuReceiptText },
  { key: 'visa', label: 'Visa Fees', icon: LuStamp },
];

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// --- Compare mode ------------------------------------------------------------

const COMPARE_MODES = [
  { value: 'day', label: 'Day' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

// Period values: day = 'YYYY-MM-DD', month = 'YYYY-MM', year = 'YYYY'.
function defaultPeriods(mode) {
  const now = new Date();
  if (mode === 'day') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return { a: ymd(now), b: ymd(yesterday) };
  }
  if (mode === 'month') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { a: ymd(now).slice(0, 7), b: ymd(prev).slice(0, 7) };
  }
  return { a: String(now.getFullYear()), b: String(now.getFullYear() - 1) };
}

function periodRange(mode, value) {
  if (mode === 'day') return { dateFrom: value, dateTo: value };
  if (mode === 'month') {
    const [y, m] = value.split('-').map(Number);
    return { dateFrom: `${value}-01`, dateTo: ymd(new Date(y, m, 0)) };
  }
  return { dateFrom: `${value}-01-01`, dateTo: `${value}-12-31` };
}

function periodLabel(mode, value) {
  if (!value) return '—';
  if (mode === 'day') return formatDay(value);
  if (mode === 'month') {
    const [y, m] = value.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }
  return value;
}

const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i));

function PeriodPicker({ mode, value, onChange }) {
  if (mode === 'day') {
    return <TextInput type="date" value={value} max={ymd(new Date())} onChange={(e) => onChange(e.target.value)} />;
  }
  if (mode === 'month') {
    // Two selects rather than <input type="month"> — Firefox/Safari desktop
    // still render that as a plain text box.
    const [y, m] = value.split('-');
    return (
      <div className="grid grid-cols-2 gap-2">
        <Select value={m} onChange={(e) => onChange(`${y}-${e.target.value}`)}>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={String(i + 1).padStart(2, '0')}>
              {name}
            </option>
          ))}
        </Select>
        <Select value={y} onChange={(e) => onChange(`${e.target.value}-${m}`)}>
          {YEAR_OPTIONS.map((yr) => (
            <option key={yr} value={yr}>
              {yr}
            </option>
          ))}
        </Select>
      </div>
    );
  }
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {YEAR_OPTIONS.map((yr) => (
        <option key={yr} value={yr}>
          {yr}
        </option>
      ))}
    </Select>
  );
}

function Swatch({ color }) {
  return <span className="inline-block h-2.5 w-2.5 flex-none rounded-full" style={{ background: color }} />;
}

// --- Shared filter bar -------------------------------------------------------

// Period preset (or custom range) + the Compare toggle. With Compare on, the
// preset is replaced by two period pickers (Period A vs Period B, at Day /
// Month / Year granularity) and every tab shows A against B.
function DateRangeFilter({
  preset,
  onChangePreset,
  customFrom,
  customTo,
  onChangeFrom,
  onChangeTo,
  dateFrom,
  dateTo,
  compareOn,
  onToggleCompare,
  compareMode,
  onChangeCompareMode,
  periods,
  onChangePeriods,
}) {
  const compareButton = (
    <button
      type="button"
      onClick={onToggleCompare}
      className={`flex h-9 flex-none items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-colors ${
        compareOn
          ? 'border-transparent bg-gradient-to-r from-accent to-[#7C3AED] text-white shadow-sm shadow-accent/25'
          : 'border-line-light bg-white text-[#666] hover:border-accent/40 hover:text-accent'
      }`}
    >
      {compareOn ? <LuX size={14} className="flex-none" /> : <LuArrowLeftRight size={14} className="flex-none" />}
      {compareOn ? 'Stop comparing' : 'Compare'}
    </button>
  );

  if (compareOn) {
    return (
      <Card className="mb-5 border-white">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-semibold uppercase text-[#4F46E5]">Compare by</div>
            <ChartTypeToggle options={COMPARE_MODES} value={compareMode} onChange={onChangeCompareMode} />
          </div>
          {compareButton}
        </div>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <p className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase text-muted">
              <Swatch color={COMPARE_COLOR_A} /> Period A
            </p>
            <PeriodPicker mode={compareMode} value={periods.a} onChange={(a) => a && onChangePeriods({ ...periods, a })} />
          </div>
          <button
            type="button"
            onClick={() => onChangePeriods({ a: periods.b, b: periods.a })}
            title="Swap periods"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-line-light bg-white text-muted transition-colors hover:border-accent/40 hover:text-accent"
          >
            <LuArrowLeftRight size={14} />
          </button>
          <div>
            <p className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase text-muted">
              <Swatch color={COMPARE_COLOR_B} /> Period B (baseline)
            </p>
            <PeriodPicker mode={compareMode} value={periods.b} onChange={(b) => b && onChangePeriods({ ...periods, b })} />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-5 border-white">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <Select value={preset} onChange={(e) => onChangePreset(e.target.value)}>
            {DATE_RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-[10px] text-muted">
            {dateFrom || dateTo
              ? `${dateFrom ? formatDay(dateFrom) : 'Beginning'} – ${dateTo ? formatDay(dateTo) : 'Today'}`
              : 'Period'}
          </p>
        </div>
        {preset === 'custom' && (
          <>
            <div>
              <TextInput type="date" value={customFrom} max={customTo || undefined} onChange={(e) => onChangeFrom(e.target.value)} />
              <p className="mt-1 text-[10px] text-muted">From</p>
            </div>
            <div>
              <TextInput type="date" value={customTo} min={customFrom || undefined} onChange={(e) => onChangeTo(e.target.value)} />
              <p className="mt-1 text-[10px] text-muted">To</p>
            </div>
          </>
        )}
        <div className="sm:col-start-4 sm:row-start-1">{compareButton}</div>
      </div>
    </Card>
  );
}

// --- Tab plumbing ------------------------------------------------------------

// The range params every tab sends; prevFrom/prevTo only in Compare mode
// (otherwise the backend picks the equal-length period right before).
function scopeParams(scope, granularity) {
  return {
    dateFrom: scope.dateFrom,
    dateTo: scope.dateTo,
    prevFrom: scope.prevFrom,
    prevTo: scope.prevTo,
    granularity,
  };
}

function prevLabelFor(scope, data) {
  if (scope.prevLabel) return scope.prevLabel;
  return data?.previousRange ? 'Previous period' : '';
}

// One line under the filters saying exactly which dates are shown and what
// they're compared against.
function RangeNote({ data, scope, loading }) {
  if (!data) return null;
  return (
    <p className="mb-4 flex flex-wrap items-center gap-x-2 text-xs text-muted">
      <span>
        Showing <strong className="text-ink">{scope.currentLabel || formatRange(data.range)}</strong>
        {scope.currentLabel && ` (${formatRange(data.range)})`}
      </span>
      {data.previousRange ? (
        <span>
          · compared with <strong className="text-ink">{formatRange(data.previousRange)}</strong>
        </span>
      ) : (
        <span>· all-time view has no previous period to compare with</span>
      )}
      {loading && <span className="text-accent">· updating…</span>}
    </p>
  );
}

function TabState({ data, error, children }) {
  if (error && !data) return <p className="text-sm text-[#a5162d]">{error}</p>;
  if (!data) return <p className="text-sm text-muted">Loading…</p>;
  return (
    <>
      {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}
      {children}
    </>
  );
}

// --- Tab 1: Overview ---------------------------------------------------------

const OVERVIEW_CARDS = [
  { key: 'totalRevenue', label: 'Total Revenue', icon: LuBanknote, highlight: true, sub: (c) => `Avg ${fmt.currency(c.averageBookingValue)} / paid booking` },
  { key: 'averageBookingValue', label: 'Avg Revenue / Booking', icon: LuTrendingUp, sub: (c) => `${fmt.count(c.revenueBookings)} paid booking(s)` },
  { key: 'bookedValue', label: 'Booked Value', icon: LuWallet, sub: (c) => `${fmt.pct(c.collectionRate)} collected` },
  { key: 'averagePaxPerBooking', label: 'Avg Travellers / Booking', icon: LuUsers, format: fmt.decimal, sub: (c) => `${fmt.count(c.totalPax)} travellers in total` },
  {
    key: 'netRevenue',
    label: 'Net Revenue',
    icon: LuUndo2,
    sub: (c) => (c.refundRequestedAmount > 0 ? `after ${fmt.currency(c.refundRequestedAmount)} in refund requests` : 'no refund requests'),
  },
  { key: 'outstanding', label: 'Pending Revenue', icon: LuCircleAlert, invert: true, sub: () => 'booked but not yet paid' },
  { key: 'totalBookings', label: 'Total Bookings', icon: LuReceiptText, format: fmt.count, sub: (c) => `${fmt.count(c.cancelledCount)} cancelled` },
  {
    key: 'abandonedCount',
    label: 'Abandoned Bookings',
    icon: LuTriangleAlert,
    format: fmt.count,
    invert: true,
    sub: (c) => `${fmt.currency(c.abandonedValue)} potential · ${fmt.pct(c.abandonmentRate)} of bookings`,
  },
];

function OverviewTab({ scope, granularity, onGranularityChange }) {
  const { data, loading, error } = useRevenueAnalysis(scopeParams(scope, granularity));
  const prevLabel = prevLabelFor(scope, data);
  const currentLabel = scope.currentLabel || 'This period';

  return (
    <TabState data={data} error={error}>
      {data && (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-70' : ''}`}>
          <RangeNote data={data} scope={scope} loading={loading} />
          <KpiGrid kpis={data.kpis} cards={OVERVIEW_CARDS} prevPrefix={scope.prevLabel || 'prev'} />
          <InsightsCard data={data} prevLabel={scope.prevLabel || 'the previous period'} />
          <RevenueTrendCard
            data={data}
            granularity={granularity}
            onGranularityChange={onGranularityChange}
            currentLabel={currentLabel}
            prevLabel={prevLabel}
          />
          <AbandonedCard data={data} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <TopPerformersCard
              title="Top performing packages"
              subtitle="Share of revenue, bookings and travellers"
              rows={data.topPackages}
              totalRevenue={data.kpis.current.totalRevenue}
              showPrev={Boolean(data.previousRange)}
            />
            <TopPerformersCard
              title="Top agencies"
              subtitle="Who is driving the revenue"
              rows={data.topAgencies}
              totalRevenue={data.kpis.current.totalRevenue}
              showPrev={Boolean(data.previousRange)}
              secondary={(r) => r.country}
            />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ShareDonutCard
              title="Revenue by channel"
              subtitle="Self-service (agent portal) vs admin-created bookings"
              rows={data.byChannel}
              labelFor={(r) => CHANNEL_LABEL[r.createdVia] || r.createdVia}
            />
            <ShareDonutCard title="Revenue by country" subtitle="Agency country" rows={data.byCountry} labelFor={(r) => r.country} />
          </div>
        </div>
      )}
    </TabState>
  );
}

// --- Tabs 2 & 3: By Package / By Agent ----------------------------------------

const BREAKDOWN_PAGE_SIZE = 10;

function BreakdownTab({ scope, granularity, kind }) {
  const isAgent = kind === 'agent';
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);
  const [chartType, setChartType] = useState('bar');
  const q = useDebounced(search);

  const { data, loading, error } = useRevenueAnalysis({
    ...scopeParams(scope, granularity),
    search: q,
    country,
    breakdownLimit: 100,
    includeOptions: isAgent ? 1 : '',
  });

  useEffect(() => {
    setPage(1);
  }, [q, country, scope.dateFrom, scope.dateTo, scope.prevFrom, scope.prevTo]);

  const rows = data ? (isAgent ? data.topAgencies : data.topPackages) : [];
  const hasPrev = Boolean(data?.previousRange);
  const prevLabel = scope.prevLabel || 'Prev. period';
  const cur = data?.kpis.current;
  const prev = data?.kpis.previous;
  const totalRevenue = cur?.totalRevenue || 0;
  const countKey = isAgent ? 'activeAgencies' : 'activePackages';
  const noun = isAgent ? 'Agency' : 'Package';
  const top = rows[0];

  // Revenue per active package/agency — derived here from the same KPIs.
  const perItem = (k) => (k && k[countKey] > 0 ? k.totalRevenue / k[countKey] : 0);
  const kpis = data
    ? {
        current: { ...cur, perItem: perItem(cur), topName: top?.revenue > 0 ? top.name : '—' },
        previous: prev ? { ...prev, perItem: perItem(prev) } : null,
      }
    : null;
  const cards = [
    { key: 'totalRevenue', label: 'Total Revenue', icon: LuBanknote, highlight: true, sub: (c) => `${fmt.currency(c.bookedValue)} booked` },
    { key: countKey, label: isAgent ? 'Agencies Booking' : 'Packages Booked', icon: isAgent ? LuBuilding2 : LuLayoutGrid, format: fmt.count },
    { key: 'perItem', label: `Avg Revenue / ${noun}`, icon: LuTrendingUp },
    {
      key: 'topName',
      label: `Top ${noun}`,
      icon: LuChartColumn,
      format: (v) => v,
      sub: () => (top && totalRevenue > 0 ? `${fmt.currency(top.revenue)} · ${Math.round((top.revenue / totalRevenue) * 100)}% of revenue` : null),
    },
    { key: 'outstanding', label: 'Outstanding', icon: LuCircleAlert, invert: true },
    { key: 'totalBookings', label: 'Bookings', icon: LuReceiptText, format: fmt.count },
    { key: 'totalPax', label: 'Travellers', icon: LuUsers, format: fmt.count },
    { key: 'abandonedCount', label: 'Abandoned Bookings', icon: LuTriangleAlert, format: fmt.count, invert: true, sub: (c) => `${fmt.currency(c.abandonedValue)} potential` },
  ];

  const chartOptions = hasPrev ? [...BREAKDOWN_CHART_TYPES, { value: 'compare', label: 'vs Prev' }] : BREAKDOWN_CHART_TYPES;
  const chartRows = rows.slice(0, 8);
  const totalPages = Math.max(1, Math.ceil(rows.length / BREAKDOWN_PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * BREAKDOWN_PAGE_SIZE, page * BREAKDOWN_PAGE_SIZE);

  const headers = [
    noun,
    ...(isAgent ? ['Country'] : []),
    'Bookings',
    'Travellers',
    'Booked Value',
    'Revenue',
    'Outstanding',
    'Abandoned',
    'Share',
    ...(hasPrev ? [prevLabel, 'Change'] : []),
  ];

  return (
    <>
      <Card className="mb-5 border-white">
        <div className={`grid grid-cols-1 gap-3 ${isAgent ? 'sm:grid-cols-2' : ''}`}>
          <TextInput
            placeholder={isAgent ? 'Search by agency (or package) name…' : 'Search by package (or agency) name…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isAgent && (
            <Select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">All countries</option>
              {(data?.options?.countries || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </div>
      </Card>

      <TabState data={data} error={error}>
        {data && (
          <div className={`space-y-5 transition-opacity ${loading ? 'opacity-70' : ''}`}>
            <RangeNote data={data} scope={scope} loading={loading} />
            <KpiGrid kpis={kpis} cards={cards} prevPrefix={scope.prevLabel || 'prev'} />

            <Card className="border-white">
              {rows.length === 0 ? (
                <p className="text-sm text-muted">No FD bookings match these filters.</p>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-base font-bold text-ink">Revenue by {noun.toLowerCase()}</div>
                      <div className="text-xs text-muted">
                        Top {chartRows.length} of {rows.length}
                      </div>
                    </div>
                    <ChartTypeToggle options={chartOptions} value={chartType} onChange={setChartType} />
                  </div>
                  <div className="mb-5">
                    {chartType === 'compare' && hasPrev ? (
                      <ComparisonBreakdownChart
                        rows={chartRows.map((r) => ({ name: r.name, a: r.revenue, b: r.prevRevenue }))}
                        labelA={scope.currentLabel || 'This period'}
                        labelB={prevLabel}
                      />
                    ) : (
                      <TopRevenueBarChart data={chartRows} nameKey="name" type={chartType === 'compare' ? 'bar' : chartType} />
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-[#E4E9FB]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[#F3F4FF]">
                          {headers.map((h, i) => (
                            <th
                              key={h}
                              className={`whitespace-nowrap border-b border-[#E4E9FB] px-3 py-2 font-semibold uppercase text-[#4F46E5] ${
                                i === 0 || (isAgent && i === 1) ? '' : 'text-right'
                              }`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((r) => (
                          <tr key={r.id ?? r.name} className="border-b border-line-light last:border-0">
                            <td className="px-3 py-2 font-semibold">{r.name}</td>
                            {isAgent && <td className="px-3 py-2">{r.country || '—'}</td>}
                            <td className="px-3 py-2 text-right">{fmt.count(r.bookings)}</td>
                            <td className="px-3 py-2 text-right">{fmt.count(r.pax)}</td>
                            <td className="px-3 py-2 text-right">{fmt.currency(r.bookedValue)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{fmt.currency(r.revenue)}</td>
                            <td className="px-3 py-2 text-right">{fmt.currency(r.outstanding)}</td>
                            <td className="px-3 py-2 text-right">{r.abandoned || '—'}</td>
                            <td className="px-3 py-2 text-right">{totalRevenue > 0 ? `${((r.revenue / totalRevenue) * 100).toFixed(1)}%` : '—'}</td>
                            {hasPrev && <td className="px-3 py-2 text-right text-muted">{fmt.currency(r.prevRevenue)}</td>}
                            {hasPrev && (
                              <td className="px-3 py-2 text-right">
                                <DeltaPill current={r.revenue} previous={r.prevRevenue} />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={rows.length}
                    pageSize={BREAKDOWN_PAGE_SIZE}
                    onChange={setPage}
                    itemLabel={isAgent ? 'agencies' : 'packages'}
                  />
                </>
              )}
            </Card>
          </div>
        )}
      </TabState>
    </>
  );
}

// --- Tab 4: Payments Collected vs Outstanding ---------------------------------

const PAYMENT_CARDS = [
  { key: 'bookedValue', label: 'Total Booked Value', icon: LuWallet, highlight: true, sub: (c) => `${fmt.count(c.totalBookings)} booking(s)` },
  { key: 'totalRevenue', label: 'Collected', icon: LuHandCoins, sub: (c) => `${fmt.pct(c.collectionRate)} of booked value` },
  { key: 'outstanding', label: 'Outstanding', icon: LuCircleAlert, invert: true, sub: () => 'balance still due' },
  { key: 'collectionRate', label: 'Collection Rate', icon: LuPercent, format: fmt.pct, points: true },
  { key: 'abandonedValue', label: 'Abandoned (unpaid)', icon: LuTriangleAlert, invert: true, sub: (c) => `${fmt.count(c.abandonedCount)} booking(s) never paid` },
  {
    key: 'refundRequestedAmount',
    label: 'Refund Requests',
    icon: LuUndo2,
    invert: true,
    sub: (c) => `${fmt.count(c.refundRequestCount)} request(s)`,
  },
  { key: 'cancelledValue', label: 'Cancelled Value', icon: LuX, invert: true, sub: (c) => `${fmt.count(c.cancelledCount)} cancelled booking(s)` },
  { key: 'averageBookingValue', label: 'Avg Collected / Booking', icon: LuTrendingUp },
];

function PaymentsTab({ scope, granularity }) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [statusChartType, setStatusChartType] = useState('donut');
  const q = useDebounced(search);
  const { data, loading, error } = useRevenueAnalysis({ ...scopeParams(scope, granularity), status, search: q });
  const cur = data?.kpis.current;

  return (
    <>
      <Card className="mb-5 border-white">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <TextInput placeholder="Search by agency or package name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <TabState data={data} error={error}>
        {data && (
          <div className={`space-y-5 transition-opacity ${loading ? 'opacity-70' : ''}`}>
            <RangeNote data={data} scope={scope} loading={loading} />
            <KpiGrid kpis={data.kpis} cards={PAYMENT_CARDS} prevPrefix={scope.prevLabel || 'prev'} />

            <Card label="Collected vs Outstanding" className="border-white">
              <CollectedVsOutstandingBar totalBookedValue={cur.bookedValue} totalCollected={cur.totalRevenue} totalOutstanding={cur.outstanding} />
            </Card>

            <CollectionTrendCard data={data} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card className="border-white">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-base font-bold text-ink">Bookings by status</div>
                  <ChartTypeToggle options={STATUS_CHART_TYPES} value={statusChartType} onChange={setStatusChartType} />
                </div>
                <StatusDonutChart
                  data={data.byStatus.map((r) => ({ status: r.status, count: r.bookings }))}
                  statusLabel={(s) => STATUS_LABEL[s] || s}
                  type={statusChartType}
                />
              </Card>
              <ShareDonutCard
                title="Booking value by status"
                subtitle="Total price of bookings in each status"
                rows={data.byStatus}
                valueKey="value"
                labelFor={(r) => STATUS_LABEL[r.status] || r.status}
                colorFor={statusColor}
              />
            </div>

            <Card label="Status detail" className="border-white">
              <div className="overflow-x-auto rounded-lg border border-[#E4E9FB]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F3F4FF]">
                      {['Status', 'Bookings', 'Total Value', 'Collected', 'Share of bookings'].map((h, i) => (
                        <th key={h} className={`border-b border-[#E4E9FB] px-3 py-2 font-semibold uppercase text-[#4F46E5] ${i ? 'text-right' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.byStatus.map((r) => (
                      <tr key={r.status} className="border-b border-line-light last:border-0">
                        <td className="px-3 py-2 font-semibold">
                          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: statusColor(r) }} />
                          {STATUS_LABEL[r.status] || r.status}
                        </td>
                        <td className="px-3 py-2 text-right">{fmt.count(r.bookings)}</td>
                        <td className="px-3 py-2 text-right">{fmt.currency(r.value)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmt.currency(r.revenue)}</td>
                        <td className="px-3 py-2 text-right">{cur.totalBookings > 0 ? fmt.pct(r.bookings / cur.totalBookings) : '—'}</td>
                      </tr>
                    ))}
                    {data.byStatus.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-muted">
                          No bookings match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </TabState>
    </>
  );
}

// --- Tab 5: Visa fees ------------------------------------------------------------
// Visa fees collected (GET /admin/analytics/visa-revenue — confirmed
// visa_payments by the day they were paid), with the same date range and
// comparison as the other tabs. Row keys follow the booking analysis
// (bookings = applications paid, pax = travellers) so the shared cards fit.

function useVisaRevenue(params) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api
      .get(`/admin/analytics/visa-revenue?${qs}`)
      .then((data) => !cancelled && setState({ data, loading: false, error: '' }))
      .catch((err) => !cancelled && setState((s) => ({ ...s, loading: false, error: err.message || 'Unable to load visa revenue' })));
    return () => {
      cancelled = true;
    };
  }, [qs]);
  return state;
}

const VISA_CARDS = [
  { key: 'collected', label: 'Visa Fees Collected', icon: LuStamp, highlight: true, sub: (c) => `${fmt.count(c.payments)} application(s) paid` },
  { key: 'averagePerApplication', label: 'Avg Fee / Application', icon: LuTrendingUp, sub: (c) => `${fmt.count(c.travellers)} traveller(s) in total` },
  { key: 'travellers', label: 'Travellers', icon: LuUsers, format: fmt.count, sub: () => 'on paid applications' },
  {
    key: 'pendingVerification',
    label: 'NEFT Awaiting Verification',
    icon: LuCircleAlert,
    invert: true,
    sub: (c) => `${fmt.count(c.pendingVerificationCount)} slip(s) — see NEFT Verification`,
  },
  { key: 'cardAmount', label: 'Collected by Card', icon: LuHandCoins, sub: (c) => `${fmt.count(c.cardPayments)} payment(s)` },
  { key: 'neftAmount', label: 'Collected by NEFT', icon: LuWallet, sub: (c) => `${fmt.count(c.neftPayments)} payment(s)` },
  {
    key: 'unpaidApplications',
    label: 'Unpaid Applications',
    icon: LuTriangleAlert,
    format: fmt.count,
    invert: true,
    sub: () => 'started in this period, not paid yet',
  },
];

const VISA_TREND_METRICS = [
  { value: 'revenue', label: 'Fees collected', prevKey: 'prevRevenue', format: fmt.currency },
  { value: 'bookings', label: 'Applications paid', prevKey: 'prevBookings', format: fmt.count },
  { value: 'pax', label: 'Travellers', format: fmt.count },
];

const METHOD_LABEL = { cashfree: 'Card (Cashfree)', neft: 'NEFT' };

function VisaTab({ scope, granularity, onGranularityChange }) {
  const { data, loading, error } = useVisaRevenue(scopeParams(scope, granularity));
  const prevLabel = prevLabelFor(scope, data);
  const currentLabel = scope.currentLabel || 'This period';
  const total = data?.kpis.current.collected || 0;
  const units = { count: 'apps', people: 'travellers' };

  return (
    <TabState data={data} error={error}>
      {data && (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-70' : ''}`}>
          <RangeNote data={data} scope={scope} loading={loading} />
          <KpiGrid kpis={data.kpis} cards={VISA_CARDS} prevPrefix={scope.prevLabel || 'prev'} />
          <RevenueTrendCard
            data={data}
            granularity={granularity}
            onGranularityChange={onGranularityChange}
            currentLabel={currentLabel}
            prevLabel={prevLabel}
            metrics={VISA_TREND_METRICS}
            revenueNote={(p) => `${fmt.count(p.bookings)} application(s) paid · ${fmt.count(p.pax)} traveller(s)`}
          />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <TopPerformersCard
              title="Visa fees by visa"
              subtitle="Share of visa fees, applications and travellers"
              rows={data.byType}
              totalRevenue={total}
              showPrev={Boolean(data.previousRange)}
              units={units}
              emptyText="No visa fees collected in this period."
            />
            <TopPerformersCard
              title="Top agencies by visa fees"
              subtitle="Who is paying for visas"
              rows={data.byAgency}
              totalRevenue={total}
              showPrev={Boolean(data.previousRange)}
              units={units}
              emptyText="No visa fees collected in this period."
            />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ShareDonutCard
              title="Visa fees by payment method"
              subtitle="Card (Cashfree) vs NEFT bank transfer"
              rows={data.byMethod}
              labelFor={(r) => METHOD_LABEL[r.method] || r.method}
              countUnit="payment(s)"
              countShort="paid"
            />
            <ShareDonutCard
              title="Visa fees by visa option"
              subtitle="Visa · entry type"
              rows={data.byCategory}
              labelFor={(r) => r.name}
              countUnit="application(s)"
              countShort="apps"
            />
          </div>
        </div>
      )}
    </TabState>
  );
}

// --- Page ----------------------------------------------------------------------

export default function Revenue() {
  const [tab, setTab] = useState('overview');
  const [preset, setPreset] = useState('3m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [compareOn, setCompareOn] = useState(false);
  const [compareMode, setCompareMode] = useState('month');
  const [periods, setPeriods] = useState(() => defaultPeriods('month'));
  // '' = let the backend pick day/week/month from the range length.
  const [granularity, setGranularity] = useState('');

  const { dateFrom, dateTo } = useMemo(
    () => (preset === 'custom' ? { dateFrom: customFrom, dateTo: customTo } : resolvePreset(preset)),
    [preset, customFrom, customTo]
  );

  const scope = useMemo(() => {
    if (!compareOn) return { dateFrom, dateTo };
    const a = periodRange(compareMode, periods.a);
    const b = periodRange(compareMode, periods.b);
    return {
      dateFrom: a.dateFrom,
      dateTo: a.dateTo,
      prevFrom: b.dateFrom,
      prevTo: b.dateTo,
      currentLabel: periodLabel(compareMode, periods.a),
      prevLabel: periodLabel(compareMode, periods.b),
    };
  }, [compareOn, compareMode, periods, dateFrom, dateTo]);

  function changePreset(next) {
    setPreset(next);
    setGranularity('');
  }

  function changeCompareMode(next) {
    setCompareMode(next);
    setPeriods(defaultPeriods(next));
    setGranularity('');
  }

  const tabProps = { scope, granularity, onGranularityChange: setGranularity };

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 text-3xl font-bold">Revenue</h2>
            <p className="text-sm text-muted">
              Which packages and agencies earn, when, and how much is actually collected — with abandoned-booking insight.
            </p>
          </div>
          <Link
            to="/admin/revenue/analysis"
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <LuChartColumn size={16} /> View Detailed Revenue Analysis
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-transparent bg-gradient-to-r from-accent to-[#7C3AED] text-white shadow-sm shadow-accent/25'
                    : 'border-line-light bg-white text-[#666] hover:border-accent/40 hover:text-accent'
                }`}
              >
                <Icon size={14} className="flex-none" />
                {t.label}
              </button>
            );
          })}
        </div>

        <DateRangeFilter
          preset={preset}
          onChangePreset={changePreset}
          customFrom={customFrom}
          customTo={customTo}
          onChangeFrom={setCustomFrom}
          onChangeTo={setCustomTo}
          dateFrom={dateFrom}
          dateTo={dateTo}
          compareOn={compareOn}
          onToggleCompare={() => {
            setCompareOn((v) => !v);
            setGranularity('');
          }}
          compareMode={compareMode}
          onChangeCompareMode={changeCompareMode}
          periods={periods}
          onChangePeriods={setPeriods}
        />

        {tab === 'overview' ? (
          <OverviewTab {...tabProps} />
        ) : tab === 'byPackage' ? (
          <BreakdownTab {...tabProps} kind="package" />
        ) : tab === 'byAgent' ? (
          <BreakdownTab {...tabProps} kind="agent" />
        ) : tab === 'visa' ? (
          <VisaTab {...tabProps} />
        ) : (
          <PaymentsTab {...tabProps} />
        )}
      </div>
    </div>
  );
}
