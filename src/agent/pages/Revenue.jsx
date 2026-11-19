import { useEffect, useState } from 'react';
import { LuBanknote, LuLayoutGrid, LuReceiptText } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, Select, Table, TextInput } from '../components/ui.jsx';
import {
  BREAKDOWN_CHART_TYPES,
  ChartTypeToggle,
  PaidVsOutstandingBar,
  SpendTrendChart,
  STATUS_CHART_TYPES,
  StatusDonutChart,
  TopRevenueBarChart,
  TREND_CHART_TYPES,
} from '../components/charts.jsx';
import { formatCurrency } from '../../shared/fdPackage/index.js';

// Agent Portal Revenue page — this agency's own spend with Xclusive Oman
// (what they've booked and paid), mirroring the admin console's own
// Revenue page (admin/pages/Revenue.jsx) tab-for-tab, minus its "By Agent"
// tab (there's only ever one agency in view here — this agency). Every
// number comes from a real server-side MySQL aggregation
// (agentRevenue.model.js) scoped to req.user.agency_id on the backend —
// every filter below (date range, package search, payment status) is a
// bound query parameter that re-runs the aggregation, never a client-side
// .filter() over an already-fetched list. FD-only — see
// agentRevenue.model.js's own header comment for why (package_request/
// mice_rfq bookings don't exist yet anywhere in this codebase).
const TABS = [
  { key: 'overview', label: 'Overview', icon: LuBanknote },
  { key: 'byPackage', label: 'By Package', icon: LuLayoutGrid },
  { key: 'payments', label: 'Payments Made vs Outstanding', icon: LuReceiptText },
];

const STATUS_OPTIONS = [
  'pending_payment', 'deposit_paid', 'confirmed', 'balance_due', 'fully_paid',
  'amendment_requested', 'cancellation_requested', 'cancelled', 'completed', 'waitlisted',
];
const STATUS_LABEL = {
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

// A Card with its label and a ChartTypeToggle sharing one header row,
// instead of Card's own plain string `label` prop.
function ChartCard({ title, toggle, children }) {
  return (
    <Card className="border-white">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-agent-accent-dark">{title}</div>
        {toggle}
      </div>
      {children}
    </Card>
  );
}

function StatCard({ label, value, loading, sub }) {
  return (
    <Card className="border-white">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-agent-muted">{label}</div>
      <div className="mt-2 text-3xl font-bold text-agent-ink">{loading ? '—' : value}</div>
      {!loading && sub && <div className="mt-1 text-xs text-agent-muted">{sub}</div>}
    </Card>
  );
}

// Simple Previous/Next pager — agent/components/ui.jsx has no shared
// Pagination component (unlike admin's), so this is a small local one
// rather than pulling the admin one across the portal boundary.
function Pager({ page, totalPages, total, onChange, itemLabel = 'items' }) {
  if (total === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-agent-muted">
        Page {page} of {totalPages} · {total} {itemLabel}
      </span>
      <div className="flex gap-2">
        <Button disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}>
          Previous
        </Button>
        <Button disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function DateRangeFilter({ dateFrom, dateTo, onChangeFrom, onChangeTo }) {
  return (
    <Card className="mb-5 border-white">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <TextInput type="date" value={dateFrom} onChange={(e) => onChangeFrom(e.target.value)} />
          <p className="mt-1 text-[10px] text-agent-muted">From</p>
        </div>
        <div>
          <TextInput type="date" value={dateTo} onChange={(e) => onChangeTo(e.target.value)} />
          <p className="mt-1 text-[10px] text-agent-muted">To</p>
        </div>
      </div>
    </Card>
  );
}

// Tab 1 — Overview.
function OverviewTab({ dateFrom, dateTo }) {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [months, setMonths] = useState([]);
  const [monthsLoading, setMonthsLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartType, setChartType] = useState('area');

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const qs = params.toString();

    setError('');
    setSummaryLoading(true);
    api
      .get(`/bookings/revenue/summary?${qs}`)
      .then(setSummary)
      .catch((err) => setError(err.message || 'Unable to load revenue summary'))
      .finally(() => setSummaryLoading(false));

    setMonthsLoading(true);
    api
      .get(`/bookings/revenue/by-month?${qs}`)
      .then(({ months: m }) => setMonths(m))
      .catch(() => {})
      .finally(() => setMonthsLoading(false));
  }, [dateFrom, dateTo]);

  return (
    <>
      <ErrorText>{error}</ErrorText>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Paid" value={summary && formatCurrency(summary.totalPaid)} loading={summaryLoading} />
        <StatCard label="Total Bookings" value={summary?.totalBookings} loading={summaryLoading} />
        <StatCard
          label="Avg. Booking Value"
          value={summary && formatCurrency(summary.averageBookingValue)}
          loading={summaryLoading}
        />
      </div>
      <ChartCard title="Spend by Month" toggle={<ChartTypeToggle options={TREND_CHART_TYPES} value={chartType} onChange={setChartType} />}>
        {monthsLoading ? <p className="text-sm text-agent-muted">Loading…</p> : <SpendTrendChart months={months} type={chartType} />}
      </ChartCard>
    </>
  );
}

// Tab 2 — By Package.
function ByPackageTab({ dateFrom, dateTo }) {
  const [search, setSearch] = useState('');
  const [packages, setPackages] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 10, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartType, setChartType] = useState('bar');

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (search) params.set('search', search);
    params.set('page', page);

    setError('');
    setLoading(true);
    api
      .get(`/bookings/revenue/by-package?${params.toString()}`)
      .then(({ packages: p, pagination: pg }) => {
        setPackages(p);
        setPagination(pg);
      })
      .catch((err) => setError(err.message || 'Unable to load spend by package'))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, search, page]);

  return (
    <>
      <Card className="mb-5 border-white">
        <TextInput placeholder="Search by package name…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>
      <Card className="border-white">
        <ErrorText>{error}</ErrorText>
        {loading ? (
          <p className="text-sm text-agent-muted">Loading…</p>
        ) : packages.length === 0 ? (
          <p className="text-sm text-agent-muted">No bookings match these filters.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-agent-accent-dark">Spend by Package</div>
              <ChartTypeToggle options={BREAKDOWN_CHART_TYPES} value={chartType} onChange={setChartType} />
            </div>
            <div className="mb-5">
              <TopRevenueBarChart data={packages} nameKey="packageTitle" type={chartType} />
            </div>
            <Table
              columns={['Package', 'Bookings', 'Amount Paid']}
              rows={packages}
              renderRow={(p) => (
                <tr key={p.packageId} className="border-b border-agent-line-light last:border-0">
                  <td className="px-3 py-2 font-semibold">{p.packageTitle}</td>
                  <td className="px-3 py-2">{p.bookingCount}</td>
                  <td className="px-3 py-2 font-semibold">{formatCurrency(p.revenue)}</td>
                </tr>
              )}
            />
            <Pager
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onChange={setPage}
              itemLabel="packages"
            />
          </>
        )}
      </Card>
    </>
  );
}

// Tab 3 — Payments Made vs Outstanding.
function PaymentsTab({ dateFrom, dateTo }) {
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusChartType, setStatusChartType] = useState('donut');

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (status) params.set('status', status);

    setError('');
    setLoading(true);
    api
      .get(`/bookings/revenue/payments-overview?${params.toString()}`)
      .then(setData)
      .catch((err) => setError(err.message || 'Unable to load payments overview'))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, status]);

  const collectionPct = data ? Math.round(data.collectionRate * 100) : 0;

  return (
    <>
      <Card className="mb-5 border-white">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </Card>

      <ErrorText>{error}</ErrorText>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Booked Value" value={data && formatCurrency(data.totalBookedValue)} loading={loading} />
        <StatCard label="Paid So Far" value={data && formatCurrency(data.totalCollected)} loading={loading} sub={data && `${collectionPct}% of booked value`} />
        <StatCard label="Outstanding" value={data && formatCurrency(data.totalOutstanding)} loading={loading} />
      </div>

      {!loading && data && (
        <Card label="Paid vs Outstanding" className="mb-5 border-white">
          <PaidVsOutstandingBar
            totalBookedValue={data.totalBookedValue}
            totalCollected={data.totalCollected}
            totalOutstanding={data.totalOutstanding}
          />
        </Card>
      )}

      <ChartCard
        title="Bookings by Status"
        toggle={<ChartTypeToggle options={STATUS_CHART_TYPES} value={statusChartType} onChange={setStatusChartType} />}
      >
        {loading ? (
          <p className="text-sm text-agent-muted">Loading…</p>
        ) : (
          <StatusDonutChart data={data?.byStatus || []} statusLabel={(s) => STATUS_LABEL[s] || s} type={statusChartType} />
        )}
      </ChartCard>
    </>
  );
}

export default function Revenue() {
  const [tab, setTab] = useState('overview');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  return (
    <div className="p-4 md:p-6">
      <h2 className="mb-1 text-3xl font-extrabold text-agent-ink">Revenue</h2>
      <p className="mb-5 text-sm text-agent-muted">
        Your agency's own spend with Xclusive Oman — total paid, broken down by package, and how much is still
        outstanding.
      </p>

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
                  ? 'border-transparent bg-agent-accent text-agent-ink-dark shadow-sm shadow-agent-accent/30'
                  : 'border-agent-line-light bg-white text-agent-muted hover:border-agent-accent hover:text-agent-ink-dark'
              }`}
            >
              <Icon size={14} className="flex-none" />
              {t.label}
            </button>
          );
        })}
      </div>

      <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} />

      {tab === 'overview' ? (
        <OverviewTab dateFrom={dateFrom} dateTo={dateTo} />
      ) : tab === 'byPackage' ? (
        <ByPackageTab dateFrom={dateFrom} dateTo={dateTo} />
      ) : (
        <PaymentsTab dateFrom={dateFrom} dateTo={dateTo} />
      )}
    </div>
  );
}
