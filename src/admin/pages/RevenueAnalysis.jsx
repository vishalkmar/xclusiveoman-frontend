import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LuArrowLeft,
  LuArrowLeftRight,
  LuBanknote,
  LuBuilding2,
  LuCircleAlert,
  LuDownload,
  LuHandCoins,
  LuLayoutGrid,
  LuPercent,
  LuPrinter,
  LuReceiptText,
  LuTrendingUp,
  LuTriangleAlert,
  LuUndo2,
  LuUsers,
  LuWallet,
  LuX,
} from 'react-icons/lu';
import { Card, Select, TextInput } from '../components/ui.jsx';
import {
  AbandonedCard,
  CHANNEL_LABEL,
  CollectionTrendCard,
  DATE_RANGE_OPTIONS,
  InsightsCard,
  KpiGrid,
  PeriodTable,
  RevenueTrendCard,
  STATUS_LABEL,
  STATUS_OPTIONS,
  ShareDonutCard,
  TopPerformersCard,
  buildAnalysisCsv,
  downloadCsv,
  fmt,
  formatRange,
  resolvePreset,
  statusColor,
  useRevenueAnalysis,
} from '../components/revenueAnalysis.jsx';

// Detailed Revenue Analysis (/admin/revenue/analysis) — reached from the
// Revenue page's "View Detailed Revenue Analysis" button. Same
// /admin/analytics/revenue-analysis response the Revenue tabs render, with
// every filter the endpoint supports exposed at once (period, country,
// package, agency, channel, booking status), a free-form comparison range,
// CSV export of every table on the page, and a print/PDF layout.

const KPI_CARDS = [
  { key: 'totalRevenue', label: 'Total Revenue', icon: LuBanknote, highlight: true, sub: (c) => `${fmt.count(c.revenueBookings)} paid booking(s)` },
  {
    key: 'netRevenue',
    label: 'Net Revenue',
    icon: LuUndo2,
    sub: (c) => (c.refundRequestedAmount > 0 ? `after ${fmt.currency(c.refundRequestedAmount)} refund requests` : 'no refund requests'),
  },
  { key: 'bookedValue', label: 'Booked Value', icon: LuWallet, sub: () => 'total price of live bookings' },
  { key: 'collectionRate', label: 'Collection Rate', icon: LuPercent, format: fmt.pct, points: true, sub: () => 'collected ÷ booked value' },
  { key: 'averageBookingValue', label: 'Avg Booking Value', icon: LuTrendingUp, sub: () => 'per paid booking' },
  { key: 'totalBookings', label: 'Total Bookings', icon: LuReceiptText, format: fmt.count, sub: (c) => `${fmt.count(c.totalPax)} travellers` },
  { key: 'averagePaxPerBooking', label: 'Avg Travellers / Booking', icon: LuUsers, format: fmt.decimal },
  { key: 'outstanding', label: 'Pending Revenue', icon: LuCircleAlert, invert: true, sub: () => 'booked, not yet paid' },
  {
    key: 'abandonedValue',
    label: 'Abandoned Value',
    icon: LuTriangleAlert,
    invert: true,
    sub: (c) => `${fmt.count(c.abandonedCount)} booking(s) · ${fmt.pct(c.abandonmentRate)} of all`,
  },
  { key: 'refundRequestedAmount', label: 'Refund Requested', icon: LuHandCoins, invert: true, sub: (c) => `${fmt.count(c.refundRequestCount)} request(s)` },
  { key: 'cancelledValue', label: 'Cancelled Value', icon: LuX, invert: true, sub: (c) => `${fmt.count(c.cancelledCount)} booking(s)` },
  { key: 'activeAgencies', label: 'Active Agencies', icon: LuBuilding2, format: fmt.count, sub: (c) => `${fmt.count(c.activePackages)} package(s) booked` },
];

function FilterField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export default function RevenueAnalysis() {
  const [preset, setPreset] = useState('3m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [country, setCountry] = useState('');
  const [packageId, setPackageId] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [createdVia, setCreatedVia] = useState('');
  const [status, setStatus] = useState('');
  const [granularity, setGranularity] = useState('');
  const [compareOn, setCompareOn] = useState(false);
  const [prevFrom, setPrevFrom] = useState('');
  const [prevTo, setPrevTo] = useState('');

  const { dateFrom, dateTo } = useMemo(
    () => (preset === 'custom' ? { dateFrom: customFrom, dateTo: customTo } : resolvePreset(preset)),
    [preset, customFrom, customTo]
  );
  const customCompare = compareOn && prevFrom && prevTo;

  const { data, loading, error } = useRevenueAnalysis({
    dateFrom,
    dateTo,
    prevFrom: customCompare ? prevFrom : '',
    prevTo: customCompare ? prevTo : '',
    granularity,
    country,
    packageId,
    agencyId,
    createdVia,
    status,
    includeOptions: 1,
  });

  const options = data?.options || { packages: [], agencies: [], countries: [] };
  const prevLabel = customCompare ? `${formatRange({ dateFrom: prevFrom, dateTo: prevTo })}` : 'Previous period';

  function toggleCompare() {
    if (!compareOn && data?.previousRange) {
      // Start from the automatic comparison range so the admin only has to
      // adjust it.
      setPrevFrom(data.previousRange.dateFrom);
      setPrevTo(data.previousRange.dateTo);
    }
    setCompareOn((v) => !v);
  }

  const filterSummary = [
    ['Country', country || 'All countries'],
    ['Package', options.packages.find((p) => p.id === packageId)?.title || 'All packages'],
    ['Agency', options.agencies.find((a) => a.id === agencyId)?.name || 'All agencies'],
    ['Channel', CHANNEL_LABEL[createdVia] || 'All channels'],
    ['Booking status', STATUS_LABEL[status] || 'All'],
  ];

  function exportCsv() {
    if (!data) return;
    downloadCsv(`revenue-analysis_${data.range.dateFrom}_to_${data.range.dateTo}.csv`, buildAnalysisCsv(data, filterSummary));
  }

  function resetFilters() {
    setCountry('');
    setPackageId('');
    setAgencyId('');
    setCreatedVia('');
    setStatus('');
  }
  const filtersActive = country || packageId || agencyId || createdVia || status;

  return (
    <div className="min-h-screen bg-[#F4F7FF] print:bg-white">
      {/* Print: drop the admin sidebar and page chrome, keep cards whole. */}
      <style>{`@media print {
        aside { display: none !important; }
        body { background: #fff !important; }
        .print-avoid-break { break-inside: avoid; }
      }`}</style>

      <div className="mx-auto max-w-6xl p-6 lg:p-10 print:max-w-none print:p-0">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link to="/admin/revenue" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent print:hidden">
              <LuArrowLeft size={14} /> Revenue overview
            </Link>
            <h2 className="mb-1 text-3xl font-bold">Revenue Analysis</h2>
            <p className="text-sm text-muted">Why the numbers moved — trends, collections, funnel leakage, packages, agencies, markets & channels.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={toggleCompare}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${
                compareOn ? 'bg-gradient-to-r from-accent to-[#7C3AED] text-white' : 'bg-[#F59E0B] text-white hover:bg-[#D97706]'
              }`}
            >
              {compareOn ? <LuX size={16} /> : <LuArrowLeftRight size={16} />} {compareOn ? 'Stop comparing' : 'Compare'}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!data}
              className="flex items-center gap-2 rounded-lg border border-line-light bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:border-accent/40 disabled:opacity-50"
            >
              <LuDownload size={16} /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!data}
              className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              <LuPrinter size={16} /> Print / PDF
            </button>
          </div>
        </div>

        <Card className="mb-5 border-white print:hidden">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <FilterField label="Period">
              <Select
                value={preset}
                onChange={(e) => {
                  setPreset(e.target.value);
                  setGranularity('');
                }}
              >
                {DATE_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Country">
              <Select value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">All countries</option>
                {options.countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Package">
              <Select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                <option value="">All packages</option>
                {options.packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Agency">
              <Select value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
                <option value="">All agencies</option>
                {options.agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Channel">
              <Select value={createdVia} onChange={(e) => setCreatedVia(e.target.value)}>
                <option value="">All channels</option>
                {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Booking status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </FilterField>
          </div>

          {(preset === 'custom' || compareOn) && (
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line-light pt-4 sm:grid-cols-2 lg:grid-cols-4">
              {preset === 'custom' && (
                <>
                  <FilterField label="From">
                    <TextInput type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} />
                  </FilterField>
                  <FilterField label="To">
                    <TextInput type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} />
                  </FilterField>
                </>
              )}
              {compareOn && (
                <>
                  <FilterField label="Compare against — from">
                    <TextInput type="date" value={prevFrom} max={prevTo || undefined} onChange={(e) => setPrevFrom(e.target.value)} />
                  </FilterField>
                  <FilterField label="Compare against — to">
                    <TextInput type="date" value={prevTo} min={prevFrom || undefined} onChange={(e) => setPrevTo(e.target.value)} />
                  </FilterField>
                </>
              )}
            </div>
          )}

          {filtersActive && (
            <button type="button" onClick={resetFilters} className="mt-3 text-xs font-semibold text-accent hover:underline">
              Clear filters
            </button>
          )}
        </Card>

        {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}
        {!data ? (
          !error && <p className="text-sm text-muted">Loading…</p>
        ) : (
          <div className={`space-y-5 transition-opacity ${loading ? 'opacity-70' : ''}`}>
            <p className="flex flex-wrap gap-x-2 text-xs text-muted">
              <span>
                Showing <strong className="text-ink">{formatRange(data.range)}</strong>
              </span>
              {data.previousRange ? (
                <span>
                  · compared with <strong className="text-ink">{formatRange(data.previousRange)}</strong>
                </span>
              ) : (
                <span>· all-time view has no previous period to compare with</span>
              )}
              <span className="hidden print:inline">· {filterSummary.map(([k, v]) => `${k}: ${v}`).join(' · ')}</span>
              {loading && <span className="text-accent print:hidden">· updating…</span>}
            </p>

            <KpiGrid kpis={data.kpis} cards={KPI_CARDS} prevPrefix="prev" />

            <div className="print-avoid-break">
              <InsightsCard data={data} prevLabel={customCompare ? prevLabel : 'the previous period'} />
            </div>

            <div className="print-avoid-break">
              <RevenueTrendCard data={data} granularity={granularity} onGranularityChange={setGranularity} prevLabel={prevLabel} />
            </div>

            <div className="print-avoid-break">
              <CollectionTrendCard data={data} />
            </div>

            <div className="print-avoid-break">
              <AbandonedCard data={data} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="print-avoid-break">
                <TopPerformersCard
                  title="Top performing packages"
                  subtitle="Share of revenue · bookings · travellers"
                  rows={data.topPackages}
                  totalRevenue={data.kpis.current.totalRevenue}
                  showPrev={Boolean(data.previousRange)}
                />
              </div>
              <div className="print-avoid-break">
                <ShareDonutCard
                  title="Revenue by channel"
                  subtitle="Self-service (agent portal) vs admin-created"
                  rows={data.byChannel}
                  labelFor={(r) => CHANNEL_LABEL[r.createdVia] || r.createdVia}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="print-avoid-break">
                <TopPerformersCard
                  title="Top agencies"
                  subtitle="Who is driving the revenue"
                  rows={data.topAgencies}
                  totalRevenue={data.kpis.current.totalRevenue}
                  showPrev={Boolean(data.previousRange)}
                  secondary={(r) => r.country}
                />
              </div>
              <div className="print-avoid-break">
                <ShareDonutCard title="Revenue by country" subtitle="Agency country" rows={data.byCountry} labelFor={(r) => r.country} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="print-avoid-break">
                <ShareDonutCard
                  title="Bookings by status"
                  subtitle="Number of bookings in each status"
                  rows={data.byStatus}
                  valueKey="bookings"
                  format={fmt.count}
                  labelFor={(r) => STATUS_LABEL[r.status] || r.status}
                  colorFor={statusColor}
                />
              </div>
              <div className="print-avoid-break">
                <ShareDonutCard
                  title="Booking value by status"
                  subtitle="Total price of bookings in each status"
                  rows={data.byStatus}
                  valueKey="value"
                  labelFor={(r) => STATUS_LABEL[r.status] || r.status}
                  colorFor={statusColor}
                />
              </div>
            </div>

            <Card className="border-white">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-base font-bold text-ink">Period-by-period detail</div>
                  <div className="text-xs text-muted">Every {data.granularity} in the range, newest first</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted print:hidden">
                  <LuLayoutGrid size={14} /> Included in the CSV export
                </div>
              </div>
              <PeriodTable data={data} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
