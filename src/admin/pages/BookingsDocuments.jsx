import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LuActivity, LuBox, LuBuilding2, LuCalendar, LuChartColumn, LuChevronDown, LuCircleCheck, LuCreditCard, LuFilter, LuMapPin, LuPackage, LuSearch, LuUserRound, LuUsers } from 'react-icons/lu';
import { api } from '../api/client.js';
import { BookingAnalyticsView, BookingSummaryCards } from '../components/bookings/BookingAnalytics.jsx';
import { Badge, Button, Pagination, Table } from '../components/ui.jsx';
import { formatCurrency } from '../../shared/fdPackage/index.js';

// Admin Bookings & Documents — Manual Booking Flow (Task 13 — Screen 22) and
// Booking & Visa Processing (Task 14 — Screen 23). FD-only
// (source_type='fd_package'); see bookingsAdmin.model.js's own comment for
// why. Each row's "Documents" link opens BookingDetailAdmin.jsx, Task 14's
// own traveler-document/visa/voucher management screen.
//
// Split into three tabs, all reading the same underlying bookings — there's
// no separate "payments" or "agent" table yet, each booking already carries
// its own payment status/amounts, agency, and package:
//   - Payments: one row per booking, oriented around its payment status —
//     the original flat list, backend-paginated exactly as before.
//   - Agent:    bookings grouped by agency, so booking volume/value per
//     agency is visible at a glance instead of scanning the flat list.
//   - Package:  bookings grouped by FD package, same idea.
// Each tab's "View Details" cross-references the other two — a payment's
// modal shows the agent and package behind it, an agent's modal shows every
// payment/package they've booked, and a package's modal shows every agent/
// payment booked against it.

// Narrowed to the same three payment-outcome values as transactions.status
// (0085_transactions_status_enum.sql: confirmed/balance_due/fully_paid) — the
// Payments/Agent tabs filter on payment progress, not the wider booking
// lifecycle. bookings.status itself still declares a bigger enum
// (0007_bookings.sql), but only these three (plus 'confirmed' kept for
// bookings written before paymentConfirmation.service.js started using
// balance_due) are relevant here.
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'balance_due', label: 'Balance due' },
  { value: 'fully_paid', label: 'Fully paid' },
  { value: 'confirmed', label: 'Confirmed (historical)' },
];

const STATUS_TONE = {
  pending_payment: 'amber',
  deposit_paid: 'amber',
  confirmed: 'green',
  balance_due: 'amber',
  fully_paid: 'green',
  amendment_requested: 'amber',
  cancellation_requested: 'red',
  cancelled: 'red',
  completed: 'grey',
  waitlisted: 'amber',
};

const CREATED_VIA_LABEL = { self_service: 'Self-service', manual_admin: 'Manual (admin)' };

// Payments tab's date filter — a handful of common lookback windows plus a
// custom range, all resolved to dateFrom/dateTo and sent to the backend
// (GET /admin/bookings?dateFrom=&dateTo=); filtering is server-side, this
// page never filters the already-fetched rows itself.
const DATE_RANGE_OPTIONS = [
  { value: '', label: 'All time' },
  { value: '1d', label: 'Up to 1 day' },
  { value: '7d', label: 'Up to 7 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: '1m', label: 'Up to 1 month' },
  { value: '6m', label: 'Up to 6 months' },
  { value: 'custom', label: 'Custom range' },
];

function dateRangeFrom(preset) {
  const d = new Date();
  if (preset === '1d') d.setDate(d.getDate() - 1);
  else if (preset === '7d') d.setDate(d.getDate() - 7);
  else if (preset === '1m') d.setMonth(d.getMonth() - 1);
  else if (preset === '6m') d.setMonth(d.getMonth() - 6);
  else if (preset === 'thisMonth') {
    // Local calendar month start — toISOString() would shift it to the
    // previous day east of UTC.
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  } else return null;
  return d.toISOString().slice(0, 10);
}

// Package tab's Departure Date filter — unlike DATE_RANGE_OPTIONS above
// (booking created_at), these resolve to departureFrom/departureTo, the
// trip's own departure date (GET /admin/bookings?departureFrom=&departureTo=).
const DEPARTURE_RANGE_OPTIONS = [
  { value: '', label: 'All time' },
  { value: 'next30', label: 'Next 30 days' },
  { value: 'next90', label: 'Next 3 months' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'upcoming', label: 'All upcoming' },
  { value: 'past', label: 'Past departures' },
  { value: 'custom', label: 'Custom range' },
];

// Local-calendar YYYY-MM-DD — toISOString() would shift the day east of UTC.
function toLocalIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function departureRange(preset) {
  const today = new Date();
  const todayIso = toLocalIsoDate(today);
  const plusDays = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return toLocalIsoDate(d);
  };
  if (preset === 'next30') return { departureFrom: todayIso, departureTo: plusDays(30) };
  if (preset === 'next90') return { departureFrom: todayIso, departureTo: plusDays(90) };
  if (preset === 'upcoming') return { departureFrom: todayIso };
  if (preset === 'past') return { departureTo: plusDays(-1) };
  if (preset === 'thisMonth') {
    return {
      departureFrom: toLocalIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      departureTo: toLocalIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }
  return {};
}

// Shared filter bar used by all three tabs (Payments / Agent / Package) —
// label + icon above each control, the input/select itself with a leading
// icon (and a chevron for selects), and the same Clear filters button.
function FilterField({ label, icon: Icon, children }) {
  return (
    <div className="min-w-0">
      <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#0F1B4C]">
        <Icon size={15} /> {label}
      </span>
      {children}
    </div>
  );
}

const FILTER_CONTROL =
  'h-10 w-full rounded-lg border border-[#DDE2F0] bg-white pl-10 text-sm text-[#0F1B4C] placeholder:text-[#8A92AD] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15';

function FilterSelect({ icon: Icon, value, onChange, options }) {
  return (
    <div className="relative">
      <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4B5575]" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${FILTER_CONTROL} cursor-pointer appearance-none pr-9`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <LuChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5575]" />
    </div>
  );
}

function FilterBar({ columns, children, footer }) {
  return (
    <div className="mb-5 rounded-2xl border border-[#EEF1F8] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
      <div className={`grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-3 ${columns}`}>{children}</div>
      {footer}
    </div>
  );
}

function FilterSearch({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <LuSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4B5575]" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${FILTER_CONTROL} pr-3`} />
    </div>
  );
}

// Date preset select with the calendar button in front of it — the button
// toggles the custom from/to range (CustomDateRange below).
function FilterDateSelect({ value, onChange, options }) {
  return (
    <div className="flex">
      <button
        type="button"
        onClick={() => onChange(value === 'custom' ? '' : 'custom')}
        aria-label="Pick a custom date range"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-l-lg border border-r-0 border-[#DDE2F0] ${value === 'custom' ? 'bg-[#EEF0FF] text-[#4F46E5]' : 'bg-white text-[#4B5575] hover:text-[#4F46E5]'}`}
      >
        <LuCalendar size={16} />
      </button>
      <div className="relative min-w-0 flex-1">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${FILTER_CONTROL} cursor-pointer appearance-none rounded-l-none pl-3 pr-9`}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <LuChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5575]" />
      </div>
    </div>
  );
}

function CustomDateRange({ fromLabel, toLabel, from, to, onFromChange, onToChange }) {
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[#EEF1F8] pt-4 xl:justify-end">
      <label className="text-xs font-medium text-[#4B5575]">
        {fromLabel}
        <input type="date" value={from} max={to || undefined} onChange={(e) => onFromChange(e.target.value)} className={`${FILTER_CONTROL} mt-1.5 w-44 pl-3 pr-3`} />
      </label>
      <label className="text-xs font-medium text-[#4B5575]">
        {toLabel}
        <input type="date" value={to} min={from || undefined} onChange={(e) => onToChange(e.target.value)} className={`${FILTER_CONTROL} mt-1.5 w-44 pl-3 pr-3`} />
      </label>
    </div>
  );
}

function ClearFiltersButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#DDE2F0] bg-[#EEF1FF] px-4 text-sm font-medium text-[#4F46E5] hover:bg-[#E3E7FF] disabled:cursor-default disabled:opacity-60"
    >
      <LuFilter size={16} /> Clear filters
    </button>
  );
}

const ACTIVITY_OPTIONS = [
  { value: '', label: 'All agents' },
  { value: 'active', label: 'Active booking agents' },
  { value: 'none', label: 'No bookings' },
  { value: 'high', label: 'High-volume agents' },
  { value: 'low', label: 'Low-volume agents' },
];

const toOptions = (values) => values.map((v) => ({ value: v, label: v }));

// agencies.status (AgentApprovals.jsx's own STATUS_BADGE) — reused here so
// the Agent tab's approval-status badge matches Agent Approvals exactly.
const AGENCY_STATUS_TONE = { pending: 'amber', approved: 'green', rejected: 'red', suspended: 'grey' };

const TABS = [
  { key: 'payments', label: 'Payments', icon: LuCreditCard },
  { key: 'agents', label: 'Agent', icon: LuUsers },
  { key: 'packages', label: 'Package', icon: LuPackage },
];

// Same local Modal every other admin page hand-rolls (AgentApprovals.jsx,
// ProductCatalog.jsx, Marketing.jsx, Employees.jsx) — no shared component
// exists in components/ui.jsx yet.
function Modal({ title, onClose, children, footer, size = 'md' }) {
  const sizeClass = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative z-10 flex max-h-[85vh] w-full ${sizeClass} flex-col rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lg leading-none text-muted hover:text-ink">
            ×
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line-light pt-4">{footer}</div>}
      </div>
    </div>
  );
}

function FieldTile({ label, children }) {
  return (
    <div className="rounded-md bg-panel px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-muted">{label}</div>
      <div className="text-sm text-ink">{children ?? '—'}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-muted first:mt-0">{children}</h4>;
}

function StatusBreakdown({ statusCounts }) {
  const entries = Object.entries(statusCounts);
  if (entries.length === 0) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([s, count]) => (
        <Badge key={s} tone={STATUS_TONE[s] || 'grey'}>
          {count} {s.replace(/_/g, ' ')}
        </Badge>
      ))}
    </div>
  );
}

// Pages through GET /admin/bookings at the max page size until every
// booking matching `filters` has been fetched — the Agent/Package tabs need
// the *full* set to aggregate by agency/package client-side, unlike the
// Payments tab which shows the backend's own page directly. Capped at 30
// pages (3,000 bookings); past that this should move server-side instead.
async function fetchAllBookings(filters = {}) {
  const pageSize = 100;
  const MAX_PAGES = 30;
  let all = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ ...filters, page: String(page), pageSize: String(pageSize) });
    const { bookings, pagination } = await api.get(`/admin/bookings?${params.toString()}`);
    all = all.concat(bookings);
    if (page >= pagination.totalPages) break;
  }
  return all;
}

// Groups bookings by `keyField` (agencyId or fdPackageId) for the Agent/
// Package tabs, rolling up the same payment totals each individual booking
// already carries. Sorted by booking count, busiest first.
function aggregateBookings(bookings, keyField, nameField) {
  const map = new Map();
  for (const b of bookings) {
    const key = b[keyField];
    if (key == null) continue;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: b[nameField],
        bookings: [],
        totalValue: 0,
        totalDeposit: 0,
        totalBalance: 0,
        totalPax: 0,
        statusCounts: {},
        lastBookingAt: b.createdAt,
      });
    }
    const entry = map.get(key);
    entry.bookings.push(b);
    entry.totalValue += b.totalPrice;
    entry.totalDeposit += b.depositPaid;
    entry.totalBalance += b.balanceDue;
    entry.totalPax += b.pax;
    entry.statusCounts[b.status] = (entry.statusCounts[b.status] || 0) + 1;
    if (new Date(b.createdAt) > new Date(entry.lastBookingAt)) entry.lastBookingAt = b.createdAt;
  }
  return Array.from(map.values()).sort((a, b) => b.bookings.length - a.bookings.length);
}

// Reused inside the Agent/Package "View Details" modals below — the list of
// bookings that make up that agent's or package's roll-up, with whichever
// of Agency/Package isn't the modal's own subject shown per row (so an
// agent's modal shows each booking's package, and vice versa).
function BookingRowsTable({ bookings, agencyColumn, packageColumn }) {
  return (
    <Table
      columns={[...(agencyColumn ? ['Agency'] : []), ...(packageColumn ? ['Package'] : []), 'Departure', 'Pax', 'Total', 'Deposit', 'Balance', 'Status', 'Created', '']}
      rows={bookings}
      renderRow={(b) => (
        <tr key={b.id} className="border-b border-line-light last:border-0">
          {agencyColumn && <td className="px-3 py-2 font-semibold">{b.agencyName}</td>}
          {packageColumn && <td className="px-3 py-2">{b.packageTitle}</td>}
          <td className="px-3 py-2">{new Date(b.departureDate).toLocaleDateString()}</td>
          <td className="px-3 py-2">{b.pax}</td>
          <td className="px-3 py-2">{formatCurrency(b.totalPrice)}</td>
          <td className="px-3 py-2">{formatCurrency(b.depositPaid)}</td>
          <td className="px-3 py-2">{formatCurrency(b.balanceDue)}</td>
          <td className="px-3 py-2">
            <Badge tone={STATUS_TONE[b.status] || 'grey'}>{b.status.replace(/_/g, ' ')}</Badge>
          </td>
          <td className="px-3 py-2">{new Date(b.createdAt).toLocaleDateString()}</td>
          <td className="px-3 py-2 text-right">
            <Link to={`/admin/bookings/${b.id}`} className="text-accent hover:underline">
              Documents
            </Link>
          </td>
        </tr>
      )}
    />
  );
}

// Payments tab's "View Details" — one booking's payment breakdown plus the
// agent who booked it and the package it's for, resolved from the
// agencies/fd-packages lookups the parent loaded once on mount.
function BookingDetailsModal({ booking, agency, fdPackage, onClose }) {
  return (
    <Modal
      title="Payment details"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Link to={`/admin/bookings/${booking.id}`} className="mr-auto text-sm font-semibold text-accent hover:underline">
            Open Documents &amp; Visa Processing →
          </Link>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <SectionLabel>Payment</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FieldTile label="Status">
          <Badge tone={STATUS_TONE[booking.status] || 'grey'}>{booking.status.replace(/_/g, ' ')}</Badge>
        </FieldTile>
        <FieldTile label="Total price">{formatCurrency(booking.totalPrice)}</FieldTile>
        <FieldTile label="Deposit paid">{formatCurrency(booking.depositPaid)}</FieldTile>
        <FieldTile label="Balance due">{formatCurrency(booking.balanceDue)}</FieldTile>
        <FieldTile label="Balance due date">{booking.balanceDueDate ? new Date(booking.balanceDueDate).toLocaleDateString() : '—'}</FieldTile>
        <FieldTile label="Pax">{booking.pax}</FieldTile>
        <FieldTile label="Departure">
          {new Date(booking.departureDate).toLocaleDateString()} · {booking.departureLocation}
        </FieldTile>
        <FieldTile label="Created via">{CREATED_VIA_LABEL[booking.createdVia] || booking.createdVia}</FieldTile>
        <FieldTile label="Created by">{booking.createdByName}</FieldTile>
        <FieldTile label="Created">{new Date(booking.createdAt).toLocaleDateString()}</FieldTile>
      </div>

      <SectionLabel>Agent</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FieldTile label="Agency">{booking.agencyName}</FieldTile>
        <FieldTile label="Type">{agency?.type || '—'}</FieldTile>
        <FieldTile label="Country">{agency?.country || '—'}</FieldTile>
        <FieldTile label="License no.">{agency?.licenseNumber || '—'}</FieldTile>
        <FieldTile label="Approval status">
          {agency ? <Badge tone={AGENCY_STATUS_TONE[agency.status] || 'grey'}>{agency.status}</Badge> : '—'}
        </FieldTile>
        <FieldTile label="Relationship manager">{agency?.rmName || '—'}</FieldTile>
      </div>

      <SectionLabel>Package</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FieldTile label="Title">{booking.packageTitle}</FieldTile>
        <FieldTile label="Theme">{fdPackage?.theme || '—'}</FieldTile>
        <FieldTile label="Duration">{fdPackage?.duration || '—'}</FieldTile>
        <FieldTile label="Hotel">{fdPackage?.hotelName || '—'}</FieldTile>
        <FieldTile label="Package status">{fdPackage?.status || '—'}</FieldTile>
      </div>
    </Modal>
  );
}

// Agent tab's "View Details" — the agency's own profile plus every booking
// (payment + package) rolled up under it.
function AgentDetailsModal({ row, agency, onClose }) {
  return (
    <Modal title={row.name} onClose={onClose} size="xl" footer={<Button onClick={onClose}>Close</Button>}>
      <SectionLabel>Agent</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FieldTile label="Agency">{row.name}</FieldTile>
        <FieldTile label="Type">{agency?.type || '—'}</FieldTile>
        <FieldTile label="Country">{agency?.country || '—'}</FieldTile>
        <FieldTile label="License no.">{agency?.licenseNumber || '—'}</FieldTile>
        <FieldTile label="Approval status">
          {agency ? <Badge tone={AGENCY_STATUS_TONE[agency.status] || 'grey'}>{agency.status}</Badge> : '—'}
        </FieldTile>
        <FieldTile label="Credit limit">{agency?.creditLimit != null ? formatCurrency(agency.creditLimit) : '—'}</FieldTile>
        <FieldTile label="Relationship manager">{agency?.rmName || '—'}</FieldTile>
        <FieldTile label="Owner">{agency?.ownerName || '—'}</FieldTile>
      </div>

      <SectionLabel>Bookings &amp; payments ({row.bookings.length})</SectionLabel>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <FieldTile label="Total value">{formatCurrency(row.totalValue)}</FieldTile>
        <FieldTile label="Deposit paid">{formatCurrency(row.totalDeposit)}</FieldTile>
        <FieldTile label="Balance due">{formatCurrency(row.totalBalance)}</FieldTile>
        <FieldTile label="Total pax">{row.totalPax}</FieldTile>
      </div>
      <BookingRowsTable bookings={row.bookings} packageColumn />
    </Modal>
  );
}

// Package tab's "View Details" — the package's own profile plus every
// booking (agent + payment) rolled up under it.
function PackageDetailsModal({ row, fdPackage, onClose }) {
  return (
    <Modal title={row.name} onClose={onClose} size="xl" footer={<Button onClick={onClose}>Close</Button>}>
      <SectionLabel>Package</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FieldTile label="Title">{row.name}</FieldTile>
        <FieldTile label="Theme">{fdPackage?.theme || '—'}</FieldTile>
        <FieldTile label="Duration">{fdPackage?.duration || '—'}</FieldTile>
        <FieldTile label="Hotel">{fdPackage?.hotelName || '—'}</FieldTile>
        <FieldTile label="Package status">{fdPackage?.status || '—'}</FieldTile>
        <FieldTile label="Rate per pax">{fdPackage?.ratePerPax != null ? formatCurrency(fdPackage.ratePerPax) : '—'}</FieldTile>
      </div>

      <SectionLabel>Bookings, agents &amp; payments ({row.bookings.length})</SectionLabel>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <FieldTile label="Total value">{formatCurrency(row.totalValue)}</FieldTile>
        <FieldTile label="Deposit paid">{formatCurrency(row.totalDeposit)}</FieldTile>
        <FieldTile label="Balance due">{formatCurrency(row.totalBalance)}</FieldTile>
        <FieldTile label="Total pax">{row.totalPax}</FieldTile>
      </div>
      <BookingRowsTable bookings={row.bookings} agencyColumn />
    </Modal>
  );
}

// Tab 1 — one row per booking, oriented around its payment status. Same
// backend-paginated search/status filters the page always had; only the
// "View Details" action and its modal are new.
function PaymentsTab({ agenciesById, packagesById }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }
  function updateStatus(v) {
    setStatus(v);
    setPage(1);
  }
  function updateAgency(v) {
    setAgencyId(v);
    setPage(1);
  }
  function updateDateRange(v) {
    setDateRange(v);
    if (v !== 'custom') {
      setCustomFrom('');
      setCustomTo('');
    }
    setPage(1);
  }
  function updateCustomFrom(v) {
    setCustomFrom(v);
    setPage(1);
  }
  function updateCustomTo(v) {
    setCustomTo(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (agencyId) params.set('agencyId', agencyId);
    if (dateRange === 'custom') {
      if (customFrom) params.set('dateFrom', customFrom);
      if (customTo) params.set('dateTo', customTo);
    } else if (dateRange) {
      const from = dateRangeFrom(dateRange);
      if (from) params.set('dateFrom', from);
    }
    params.set('page', String(page));

    api
      .get(`/admin/bookings?${params.toString()}`)
      .then(({ bookings, pagination: p }) => {
        setItems(bookings);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load bookings'))
      .finally(() => setLoading(false));
  }, [search, status, agencyId, dateRange, customFrom, customTo, page]);

  function clearFilters() {
    setSearch('');
    setStatus('');
    setAgencyId('');
    setDateRange('');
    setCustomFrom('');
    setCustomTo('');
    setPage(1);
  }

  return (
    <>
      <FilterBar
        columns="xl:grid-cols-[1.4fr_1fr_1fr_1.1fr_0.8fr]"
        footer={
          dateRange === 'custom' && (
            <CustomDateRange fromLabel="Booked from" toLabel="Booked to" from={customFrom} to={customTo} onFromChange={updateCustomFrom} onToChange={updateCustomTo} />
          )
        }
      >
        <FilterField label="Search" icon={LuSearch}>
          <FilterSearch value={search} onChange={updateSearch} placeholder="Search agency or package name..." />
        </FilterField>
        <FilterField label="Payment Status" icon={LuCircleCheck}>
          <FilterSelect icon={LuCircleCheck} value={status} onChange={updateStatus} options={STATUS_OPTIONS} />
        </FilterField>
        <FilterField label="Agent / Agency" icon={LuBuilding2}>
          <FilterSelect
            icon={LuBuilding2}
            value={agencyId}
            onChange={updateAgency}
            options={[
              { value: '', label: 'All agents' },
              ...Array.from(agenciesById.values())
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((agency) => ({ value: agency.id, label: agency.name })),
            ]}
          />
        </FilterField>
        <FilterField label="Booking Date" icon={LuCalendar}>
          <FilterDateSelect value={dateRange} onChange={updateDateRange} options={DATE_RANGE_OPTIONS} />
        </FilterField>
        <ClearFiltersButton onClick={clearFilters} disabled={!(search || status || agencyId || dateRange)} />
      </FilterBar>

      {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No payments match those filters.</p>
      ) : (
        <>
          <Table
            columns={['Agency', 'Package', 'Departure', 'Location', 'Pax', 'Total', 'Deposit', 'Balance', 'Status', 'Created via', 'Created', '']}
            rows={items}
            renderRow={(b) => (
              <tr key={b.id} onClick={() => navigate(`/admin/bookings/${b.id}`)} className="cursor-pointer border-b border-line-light last:border-0 hover:bg-indigo-50/40">
                <td className="px-3 py-2 font-semibold">{b.agencyName}</td>
                <td className="px-3 py-2">{b.packageTitle}</td>
                <td className="px-3 py-2">{new Date(b.departureDate).toLocaleDateString()}</td>
                <td className="px-3 py-2">{b.departureLocation}</td>
                <td className="px-3 py-2">{b.pax}</td>
                <td className="px-3 py-2">{formatCurrency(b.totalPrice)}</td>
                <td className="px-3 py-2">{formatCurrency(b.depositPaid)}</td>
                <td className="px-3 py-2">{formatCurrency(b.balanceDue)}</td>
                <td className="px-3 py-2">
                  <Badge tone={STATUS_TONE[b.status] || 'grey'}>{b.status.replace(/_/g, ' ')}</Badge>
                </td>
                <td className="px-3 py-2">{CREATED_VIA_LABEL[b.createdVia] || b.createdVia}</td>
                <td className="px-3 py-2">{new Date(b.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button type="button" onClick={(event) => { event.stopPropagation(); setSelected(b); }} className="mr-3 text-accent hover:underline">
                    View Details
                  </button>
                  <Link to={`/admin/bookings/${b.id}`} onClick={(event) => event.stopPropagation()} className="text-accent hover:underline">
                    Documents
                  </Link>
                </td>
              </tr>
            )}
          />
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onChange={setPage}
            itemLabel="payments"
          />
        </>
      )}

      {selected && (
        <BookingDetailsModal
          booking={selected}
          agency={agenciesById.get(selected.agencyId)}
          fdPackage={packagesById.get(selected.fdPackageId)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// Tab 2 — bookings grouped by agency. Loads the *full* booking set once
// (fetchAllBookings) since aggregation happens client-side; search then
// filters the already-aggregated rows rather than re-fetching per keystroke.
function AgentsTab({ agenciesById }) {
  const navigate = useNavigate();
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [activity, setActivity] = useState('');
  const [relationshipManager, setRelationshipManager] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);

  function updateDateRange(v) {
    setDateRange(v);
    if (v !== 'custom') {
      setCustomFrom('');
      setCustomTo('');
    }
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const filters = {};
    if (status) filters.status = status;
    if (dateRange === 'custom') {
      if (customFrom) filters.dateFrom = customFrom;
      if (customTo) filters.dateTo = customTo;
    } else if (dateRange) {
      const from = dateRangeFrom(dateRange);
      if (from) filters.dateFrom = from;
    }
    fetchAllBookings(filters)
      .then(setAllBookings)
      .catch((err) => setError(err.message || 'Unable to load bookings'))
      .finally(() => setLoading(false));
  }, [status, dateRange, customFrom, customTo]);

  const rows = useMemo(() => aggregateBookings(allBookings, 'agencyId', 'agencyName'), [allBookings]);
  const rowsWithInactiveAgents = useMemo(() => {
    const byId = new Map(rows.map((row) => [row.key, row]));
    for (const agency of agenciesById.values()) {
      if (!byId.has(agency.id)) byId.set(agency.id, { key: agency.id, name: agency.name, bookings: [], totalValue: 0, totalDeposit: 0, totalBalance: 0, totalPax: 0, statusCounts: {}, lastBookingAt: null });
    }
    return Array.from(byId.values()).sort((a, b) => b.bookings.length - a.bookings.length || a.name.localeCompare(b.name));
  }, [rows, agenciesById]);
  const filteredRows = useMemo(() => {
    let result = rowsWithInactiveAgents;
    if (relationshipManager === 'unassigned') result = result.filter((row) => !agenciesById.get(row.key)?.rmUserId);
    if (relationshipManager && relationshipManager !== 'unassigned') result = result.filter((row) => agenciesById.get(row.key)?.rmUserId === relationshipManager);
    if (activity === 'active') result = result.filter((row) => row.bookings.length > 0);
    if (activity === 'none') result = result.filter((row) => row.bookings.length === 0);
    if (activity === 'high') result = result.filter((row) => row.bookings.length >= 10);
    if (activity === 'low') result = result.filter((row) => row.bookings.length > 0 && row.bookings.length < 10);
    if (!search) return result;
    const needle = search.trim().toLowerCase();
    return result.filter((r) => r.name?.toLowerCase().includes(needle));
  }, [rowsWithInactiveAgents, search, activity, relationshipManager, agenciesById]);
  const selectedRow = rowsWithInactiveAgents.find((r) => r.key === selectedKey) || null;

  function clearFilters() {
    setSearch(''); setStatus(''); setActivity(''); setRelationshipManager(''); setDateRange(''); setCustomFrom(''); setCustomTo('');
  }

  return (
    <>
      <FilterBar
        columns="xl:grid-cols-[1.3fr_1fr_1fr_1fr_1.1fr_0.8fr]"
        footer={
          dateRange === 'custom' && (
            <CustomDateRange fromLabel="Booked from" toLabel="Booked to" from={customFrom} to={customTo} onFromChange={setCustomFrom} onToChange={setCustomTo} />
          )
        }
      >
        <FilterField label="Search Agent" icon={LuSearch}>
          <FilterSearch value={search} onChange={setSearch} placeholder="Search agent name..." />
        </FilterField>
        <FilterField label="Agent Status" icon={LuCircleCheck}>
          <FilterSelect icon={LuCircleCheck} value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </FilterField>
        <FilterField label="Booking Activity" icon={LuActivity}>
          <FilterSelect icon={LuActivity} value={activity} onChange={setActivity} options={ACTIVITY_OPTIONS} />
        </FilterField>
        <FilterField label="Relationship Manager" icon={LuUserRound}>
          <FilterSelect
            icon={LuUserRound}
            value={relationshipManager}
            onChange={setRelationshipManager}
            options={[
              { value: '', label: 'All managers' },
              { value: 'unassigned', label: 'Unassigned' },
              ...Array.from(
                new Map(
                  Array.from(agenciesById.values())
                    .filter((agency) => agency.rmUserId)
                    .map((agency) => [agency.rmUserId, agency.rmName || 'Assigned manager'])
                ).entries()
              )
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([id, name]) => ({ value: id, label: name })),
            ]}
          />
        </FilterField>
        <FilterField label="Registration Date" icon={LuCalendar}>
          <FilterDateSelect value={dateRange} onChange={updateDateRange} options={DATE_RANGE_OPTIONS} />
        </FilterField>
        <ClearFiltersButton onClick={clearFilters} disabled={!(search || status || activity || relationshipManager || dateRange)} />
      </FilterBar>

      {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : filteredRows.length === 0 ? (
        <p className="text-sm text-muted">No agents have made bookings yet.</p>
      ) : (
        <Table
          columns={['Agency', 'Bookings', 'Total value', 'Deposit paid', 'Balance due', 'Statuses', 'Last booking', '']}
          rows={filteredRows}
          renderRow={(r) => (
            <tr key={r.key} onClick={() => r.bookings[0] && navigate(`/admin/bookings/${r.bookings[0].id}`)} className={`border-b border-line-light last:border-0 ${r.bookings[0] ? 'cursor-pointer hover:bg-indigo-50/40' : ''}`}>
              <td className="px-3 py-2 font-semibold">{r.name}</td>
              <td className="px-3 py-2">{r.bookings.length}</td>
              <td className="px-3 py-2">{formatCurrency(r.totalValue)}</td>
              <td className="px-3 py-2">{formatCurrency(r.totalDeposit)}</td>
              <td className="px-3 py-2">{formatCurrency(r.totalBalance)}</td>
              <td className="px-3 py-2">
                <StatusBreakdown statusCounts={r.statusCounts} />
              </td>
              <td className="px-3 py-2">{r.lastBookingAt ? new Date(r.lastBookingAt).toLocaleDateString() : '—'}</td>
              <td className="px-3 py-2 text-right">
                <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedKey(r.key); }} className="text-accent hover:underline">
                  View Details
                </button>
              </td>
            </tr>
          )}
        />
      )}

      {selectedRow && <AgentDetailsModal row={selectedRow} agency={agenciesById.get(selectedRow.key)} onClose={() => setSelectedKey(null)} />}
    </>
  );
}

// Tab 3 — bookings grouped by FD package. Same full-fetch + client-side
// aggregation approach as AgentsTab above.
function PackagesTab({ packagesById }) {
  const navigate = useNavigate();
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [destination, setDestination] = useState('');
  const [packageType, setPackageType] = useState('');
  const [status, setStatus] = useState('');
  const [departure, setDeparture] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filterOptions, setFilterOptions] = useState({ destinations: [], packageTypes: [] });
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    api
      .get('/admin/bookings/filter-options')
      .then((res) => setFilterOptions({ destinations: res.destinations || [], packageTypes: res.packageTypes || [] }))
      .catch(() => {
        /* Dropdowns just stay at "All" if the options can't load. */
      });
  }, []);

  // Every filter is server-side — debounce the search box so typing doesn't
  // refetch every page of bookings on each keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  function updateDeparture(v) {
    setDeparture(v);
    if (v !== 'custom') {
      setCustomFrom('');
      setCustomTo('');
    }
  }

  const hasFilters = Boolean(search || destination || packageType || status || departure);
  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setDestination('');
    setPackageType('');
    setStatus('');
    updateDeparture('');
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const filters = {};
    if (debouncedSearch) filters.packageSearch = debouncedSearch;
    if (destination) filters.destination = destination;
    if (packageType) filters.packageType = packageType;
    if (status) filters.status = status;
    if (departure === 'custom') {
      if (customFrom) filters.departureFrom = customFrom;
      if (customTo) filters.departureTo = customTo;
    } else if (departure) {
      Object.assign(filters, departureRange(departure));
    }
    let active = true;
    fetchAllBookings(filters)
      .then((bookings) => active && setAllBookings(bookings))
      .catch((err) => active && setError(err.message || 'Unable to load bookings'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debouncedSearch, destination, packageType, status, departure, customFrom, customTo]);

  const rows = useMemo(() => aggregateBookings(allBookings, 'fdPackageId', 'packageTitle'), [allBookings]);
  const selectedRow = rows.find((r) => r.key === selectedKey) || null;

  return (
    <>
      <FilterBar
        columns="xl:grid-cols-[1.3fr_1fr_1fr_1fr_1.1fr_0.8fr]"
        footer={
          departure === 'custom' && (
            <CustomDateRange fromLabel="Departing from" toLabel="Departing to" from={customFrom} to={customTo} onFromChange={setCustomFrom} onToChange={setCustomTo} />
          )
        }
      >
        <FilterField label="Search Package" icon={LuSearch}>
          <FilterSearch value={search} onChange={setSearch} placeholder="Search package name, destination..." />
        </FilterField>
        <FilterField label="Destination" icon={LuMapPin}>
          <FilterSelect icon={LuMapPin} value={destination} onChange={setDestination} options={[{ value: '', label: 'All destinations' }, ...toOptions(filterOptions.destinations)]} />
        </FilterField>
        <FilterField label="Package Type" icon={LuBox}>
          <FilterSelect icon={LuBox} value={packageType} onChange={setPackageType} options={[{ value: '', label: 'All types' }, ...toOptions(filterOptions.packageTypes)]} />
        </FilterField>
        <FilterField label="Status" icon={LuCircleCheck}>
          <FilterSelect icon={LuCircleCheck} value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </FilterField>
        <FilterField label="Departure Date" icon={LuCalendar}>
          <FilterDateSelect value={departure} onChange={updateDeparture} options={DEPARTURE_RANGE_OPTIONS} />
        </FilterField>
        <ClearFiltersButton onClick={clearFilters} disabled={!hasFilters} />
      </FilterBar>

      {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">{hasFilters ? 'No packages match these filters.' : 'No packages have been booked yet.'}</p>
      ) : (
        <Table
          columns={['Package', 'Bookings', 'Total pax', 'Total value', 'Deposit paid', 'Balance due', 'Statuses', 'Last booking', '']}
          rows={rows}
          renderRow={(r) => (
            <tr key={r.key} onClick={() => r.bookings[0] && navigate(`/admin/bookings/${r.bookings[0].id}`)} className={`border-b border-line-light last:border-0 ${r.bookings[0] ? 'cursor-pointer hover:bg-indigo-50/40' : ''}`}>
              <td className="px-3 py-2 font-semibold">{r.name}</td>
              <td className="px-3 py-2">{r.bookings.length}</td>
              <td className="px-3 py-2">{r.totalPax}</td>
              <td className="px-3 py-2">{formatCurrency(r.totalValue)}</td>
              <td className="px-3 py-2">{formatCurrency(r.totalDeposit)}</td>
              <td className="px-3 py-2">{formatCurrency(r.totalBalance)}</td>
              <td className="px-3 py-2">
                <StatusBreakdown statusCounts={r.statusCounts} />
              </td>
              <td className="px-3 py-2">{new Date(r.lastBookingAt).toLocaleDateString()}</td>
              <td className="px-3 py-2 text-right">
                <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedKey(r.key); }} className="text-accent hover:underline">
                  View Details
                </button>
              </td>
            </tr>
          )}
        />
      )}

      {selectedRow && <PackageDetailsModal row={selectedRow} fdPackage={packagesById.get(selectedRow.key)} onClose={() => setSelectedKey(null)} />}
    </>
  );
}

export default function BookingsDocuments() {
  const [tab, setTab] = useState('payments');
  // "View Analytics" opens the charts as their own view; kept in the URL
  // (?view=analytics) so it's linkable and the browser Back button returns.
  const [searchParams, setSearchParams] = useSearchParams();
  const showAnalytics = searchParams.get('view') === 'analytics';
  const [analyticsBookings, setAnalyticsBookings] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Loaded once, shared by all three tabs — the Payments tab's "View
  // Details" and the Agent/Package tabs' own row data all cross-reference
  // the same agency/package lookups instead of each re-fetching them.
  const [agenciesById, setAgenciesById] = useState(new Map());
  const [packagesById, setPackagesById] = useState(new Map());

  useEffect(() => {
    fetchAllBookings()
      .then((bookings) => setAnalyticsBookings(bookings))
      .catch(() => setAnalyticsBookings([]))
      .finally(() => setAnalyticsLoading(false));
    api
      .get('/admin/agencies')
      .then(({ agencies }) => setAgenciesById(new Map((agencies || []).map((a) => [a.id, a]))))
      .catch(() => {});
    api
      .get('/admin/fd-packages')
      .then(({ fdPackages }) => setPackagesById(new Map((fdPackages || []).map((p) => [p.id, p]))))
      .catch(() => {});
  }, []);

  if (showAnalytics) {
    return (
      <div className="min-h-screen bg-[#F4F7FF]">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-10">
          <BookingAnalyticsView bookings={analyticsBookings} loading={analyticsLoading} onBack={() => setSearchParams({})} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="mb-1 text-3xl font-bold">Booking & Visa Processing</h2>
            <p className="text-sm text-muted">
              Every Fixed Departure booking, self-service or manually created on an agency's behalf — by payment, by agent, or by package.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSearchParams({ view: 'analytics' })}
            className="inline-flex flex-none items-center gap-1.5 rounded-md border border-[#C7D2FE] bg-[#EEF2FF] px-3.5 py-2 text-xs font-semibold text-[#4338CA] transition hover:border-accent hover:bg-[#E0E7FF]"
          >
            <LuChartColumn size={15} /> View Analytics
          </button>
        </div>

        <BookingSummaryCards bookings={analyticsBookings} loading={analyticsLoading} />

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

        {tab === 'payments' && <PaymentsTab agenciesById={agenciesById} packagesById={packagesById} />}
        {tab === 'agents' && <AgentsTab agenciesById={agenciesById} />}
        {tab === 'packages' && <PackagesTab packagesById={packagesById} />}
      </div>
    </div>
  );
}
