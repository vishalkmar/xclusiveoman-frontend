import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuBriefcase,
  LuBusFront,
  LuCircleCheck,
  LuCompass,
  LuEye,
  LuFilePen,
  LuHotel,
  LuImage,
  LuListChecks,
  LuLock,
  LuPackage,
  LuPencil,
  LuPersonStanding,
  LuPlus,
  LuSearch,
  LuSend,
  LuShieldCheck,
  LuTrash2,
  LuTruck,
  LuUtensils,
} from "react-icons/lu";
import { api } from "../api/client.js";
import {
  Button,
  Card,
  Checkbox,
  ErrorText,
  FieldLabel,
  Pagination,
  Select,
  Table,
  Textarea,
  TextInput,
} from "../components/ui.jsx";
import {
  formatCurrency,
  formatDateRange,
  formatTime,
  getFdBadges,
} from "../../shared/fdPackage/index.js";
import { formatDateTime } from "../../shared/components/formatDateTime.js";
import {
  RichTextDisplay,
  isEmptyHtml,
} from "../../shared/components/RichTextEditor.jsx";
import {
  TourVehiclePriceTable,
  tourPriceSummary,
} from "../../shared/components/TourVehiclePriceTable.jsx";
import { vehiclePricesFromRow } from "../../shared/tourPricing.js";
import { Money } from "../../shared/components/Money.jsx";

const TABS = [
  { key: "fdPackages", label: "Packages", icon: LuBriefcase },
  { key: "hotels", label: "Hotels", icon: LuHotel },
  { key: "tours", label: "Tours", icon: LuCompass },
  { key: "vehicles", label: "Vehicles", icon: LuTruck },
  { key: "activities", label: "Activities", icon: LuPersonStanding },
  { key: "transfers", label: "Transfers", icon: LuBusFront },
  { key: "meals", label: "Meals", icon: LuUtensils },
  { key: "visa", label: "Visa", icon: LuShieldCheck },
  { key: "flights", label: "Flights", icon: LuSend },
  {
    key: "inclusionsExclusions",
    label: "Inclusions & Exclusions",
    icon: LuListChecks,
  },
];

// Solid-fill premium badges for the card's image overlay — same reasoning
// as agent/pages/Departures.jsx's own CardBadge: the shared `Badge`
// component (../components/ui.jsx) is a soft pale-pill treatment meant for
// sitting on a white card body, and needs real contrast to read on a dark
// photo/placeholder instead. Deliberately kept in the admin console's own
// indigo/purple identity (no gold/teal borrowed from the agent portal's
// separate brand) — "Featured" reads as the console's own accent gradient
// rather than agent's gold, consistent with every other admin premium
// treatment (ContentManagement.jsx's gradient headings, etc.).
const CARD_BADGE_TONE = {
  amber: "bg-gradient-to-r from-accent to-accent-dark text-white",
  green: "bg-emerald-500 text-white",
  red: "bg-rose-600 text-white",
};
const STATUS_BADGE_SOLID = {
  draft: "bg-slate-600 text-white",
  published: "bg-emerald-500 text-white",
  closed: "bg-rose-600 text-white",
};

// draft/published badge for Hotels/Tours/Activities/Transfers table rows
// (0070_hotels_status.sql / 0072_tours_activities_transfers_status.sql) —
// reuses the same STATUS_BADGE_SOLID palette FdPackagesTab's own status pill
// already established. `status` can come back undefined from a stale cached
// response shape; defaults to "published" rather than showing a blank pill,
// since that's what every one of these rows already was before the column
// existed.
function StatusBadge({ status }) {
  const value = status || "published";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
        STATUS_BADGE_SOLID[value] || "bg-slate-700 text-white"
      }`}
    >
      {value}
    </span>
  );
}

// Created / Updated cells shared by all five catalog tables below. FD
// packages come back camelCase (createdAt/updatedAt — the latter added to
// toPublicPackage in fdPackagesAdmin.controller.js); hotels/tours/activities/
// transfers are raw `SELECT *` rows, so snake_case — accept either.
function TimestampCells({ row }) {
  return (
    <>
      <td className='px-3 py-3 align-middle whitespace-nowrap text-[11px] text-muted'>
        {formatDateTime(row.updatedAt ?? row.updated_at)}
      </td>
    </>
  );
}

function CardBadge({ tone, children }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${
        CARD_BADGE_TONE[tone] || "bg-slate-700 text-white"
      }`}
    >
      {children}
    </span>
  );
}

// No shared Modal component exists yet (see this file's own local `Modal`
// below, and the same local-Modal convention in Marketing.jsx/
// AgentApprovals.jsx/Employees.jsx) — this is a bespoke small one (overlay
// + centered Card-styled panel, same tokens as everywhere else) rather than
// the browser's native window.confirm, so the warning and any failure (e.g.
// a 409 because real bookings still exist — see deleteFdPackage's comment)
// render in-app instead of a native dialog/alert.
// Two ways to delete a package that has bookings (backend
// fdPackagesAdmin.controller.js#remove):
//   - "package_only" (default, safe): the package is archived — gone from the
//     catalogue and from agents, but every booking stays exactly as it is;
//   - "all": the package and every booking made for it are permanently erased.
// A package with no bookings is simply deleted. The dialog first loads the
// real numbers (GET …/delete-impact) so each option says exactly what it does.
function DeleteFdPackageModal({ pkg, onCancel, onConfirmed }) {
  const [impact, setImpact] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [mode, setMode] = useState("package_only");
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get(`/admin/fd-packages/${pkg.id}/delete-impact`)
      .then(({ impact: result }) => active && setImpact(result))
      .catch((err) => active && setLoadError(err.message || "Unable to check this package's bookings"));
    return () => {
      active = false;
    };
  }, [pkg.id]);

  const hasBookings = impact?.bookingCount > 0;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const canConfirm = impact && !deleting && (!hasBookings || mode === "package_only" || understood);

  async function handleConfirm() {
    setError("");
    setDeleting(true);
    try {
      await api.del(`/admin/fd-packages/${pkg.id}${hasBookings ? `?mode=${mode}` : ""}`);
      onConfirmed(pkg.id);
    } catch (err) {
      setError(err.message || "Unable to delete FD package");
      setDeleting(false);
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div
        className='fixed inset-0 bg-black/30'
        onClick={deleting ? undefined : onCancel}
      />
      <div className='relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6'>
        <div className='mb-4 flex items-start justify-between gap-3'>
          <h3 className='text-lg font-bold text-ink'>Delete “{pkg.title}”?</h3>
          <button
            type='button'
            onClick={onCancel}
            disabled={deleting}
            aria-label='Close'
            className='text-lg leading-none text-muted hover:text-ink'
          >
            ×
          </button>
        </div>

        {!impact && !loadError && <p className='text-sm text-muted'>Checking this package's bookings…</p>}
        {loadError && <ErrorText>{loadError}</ErrorText>}

        {impact && !hasBookings && (
          <p className='text-sm text-ink'>
            This package has no bookings. It will be permanently deleted together with its itinerary, departure dates
            and add-ons. This can't be undone.
          </p>
        )}

        {impact && hasBookings && (
          <>
            <div className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900'>
              This package has <span className='font-semibold'>{plural(impact.bookingCount, "booking")}</span> (
              {plural(impact.travellerCount, "traveller")}
              {impact.paidBookingCount > 0 &&
                `; ${plural(impact.paidBookingCount, "paid booking")}, ${formatCurrency(impact.totalPaid)} collected`}
              ). Choose what happens to them.
            </div>

            <div className='mt-4 space-y-2'>
              <label
                className={`block cursor-pointer rounded-md border p-3 ${mode === "package_only" ? "border-accent bg-accent/5" : "border-line-light"}`}
              >
                <div className='flex items-start gap-3'>
                  <input
                    type='radio'
                    name='fd-package-delete-mode'
                    checked={mode === "package_only"}
                    onChange={() => setMode("package_only")}
                    disabled={deleting}
                    className='mt-1'
                  />
                  <span>
                    <span className='block text-sm font-semibold text-ink'>
                      Delete package only — keep the bookings{" "}
                      <span className='font-normal text-muted'>(recommended)</span>
                    </span>
                    <ul className='mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted'>
                      <li>The package disappears from the catalogue and agents can no longer see or book it.</li>
                      <li>
                        All {plural(impact.bookingCount, "booking")} stay exactly as they are — package name, travel
                        dates, travellers, documents and payments — and keep showing in Bookings and revenue reports.
                      </li>
                      <li>Outstanding balances can still be paid and trips still run as booked.</li>
                    </ul>
                  </span>
                </div>
              </label>

              <label
                className={`block cursor-pointer rounded-md border p-3 ${mode === "all" ? "border-rose-500 bg-rose-50" : "border-line-light"}`}
              >
                <div className='flex items-start gap-3'>
                  <input
                    type='radio'
                    name='fd-package-delete-mode'
                    checked={mode === "all"}
                    onChange={() => setMode("all")}
                    disabled={deleting}
                    className='mt-1'
                  />
                  <span>
                    <span className='block text-sm font-semibold text-ink'>Delete package and all its bookings</span>
                    <ul className='mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted'>
                      <li>
                        Permanently erases the package and all {plural(impact.bookingCount, "booking")}: their
                        travellers and documents, payments and transaction records
                        {impact.totalPaid > 0 ? ` (${formatCurrency(impact.totalPaid)} collected)` : ""}, reviews and
                        operations records.
                      </li>
                      <li>Agents lose these bookings, and they drop out of revenue and sales reports.</li>
                      <li>Money already collected is not refunded automatically — handle refunds first.</li>
                    </ul>
                  </span>
                </div>
              </label>
            </div>

            {mode === "all" && (
              <label className='mt-3 flex cursor-pointer items-start gap-2 text-sm text-rose-700'>
                <input
                  type='checkbox'
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  disabled={deleting}
                  className='mt-1'
                />
                I understand this permanently deletes {plural(impact.bookingCount, "booking")} and can't be undone.
              </label>
            )}
          </>
        )}

        {error && (
          <div className='mt-3'>
            <ErrorText>{error}</ErrorText>
          </div>
        )}
        <div className='mt-5 flex flex-wrap justify-end gap-2 border-t border-line-light pt-4'>
          <Button onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button variant='danger' onClick={handleConfirm} disabled={!canConfirm}>
            {deleting
              ? "Deleting…"
              : !hasBookings
                ? "Delete package"
                : mode === "all"
                  ? "Delete package and bookings"
                  : "Delete package, keep bookings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;
// OMR brackets. The API filters inclusively (>= min, <= max) and prices can
// carry baisa, so each bracket starts 0.001 above the previous one's max —
// no price falls between two options.
const PRICE_RANGES = [
  { value: "0:25", label: "Up to OMR 25" },
  { value: "25.001:50", label: "OMR 25–50" },
  { value: "50.001:100", label: "OMR 50–100" },
  { value: "100.001:250", label: "OMR 100–250" },
  { value: "250.001:500", label: "OMR 250–500" },
  { value: "500.001:", label: "More than OMR 500" },
];

const DATE_FILTERS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "lastMonth", label: "Last month" },
];

function toDateInputValue(date) {
  // Use the local calendar date. `toISOString()` converts to UTC first and
  // can move the filter one day backward/forward for users outside UTC.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDateFilterParams(params, value) {
  if (!value) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  const end = new Date(today);
  if (value === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (value === "last7") {
    start.setDate(start.getDate() - 6);
  } else if (value === "last30") {
    start.setDate(start.getDate() - 29);
  } else if (value === "lastMonth") {
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
    end.setDate(0);
  }
  params.set("dateFrom", toDateInputValue(start));
  params.set("dateTo", toDateInputValue(end));
}

function DateFilter({ value, onChange, label = "Filter by date" }) {
  return <Select className='w-full px-2.5 py-2 text-xs sm:w-[145px] xl:flex-none' aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}><option value=''>All dates</option>{DATE_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>;
}

function useCatalogOptions(path, entityKey) {
  const [options, setOptions] = useState({
    cities: [],
    categories: [],
    vehicleClasses: [],
  });

  useEffect(() => {
    let active = true;
    api
      .get(path)
      .then((data) => {
        if (!active) return;
        const rows = data[entityKey] || [];
        setOptions({
          cities: [
            ...new Set(rows.map((row) => row.city).filter(Boolean)),
          ].sort(),
          categories: [
            ...new Set(rows.map((row) => row.category).filter(Boolean)),
          ].sort(),
          vehicleClasses: [
            ...new Set(rows.map((row) => row.vehicle_class).filter(Boolean)),
          ].sort(),
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [path, entityKey]);

  return options;
}

function addPriceRangeParams(params, priceRange) {
  if (!priceRange) return;
  const [min, max] = priceRange.split(":");
  if (min) params.set("priceMin", min);
  if (max) params.set("priceMax", max);
}

function PriceRangeOptions() {
  return PRICE_RANGES.map((range) => (
    <option key={range.value} value={range.value}>
      {range.label}
    </option>
  ));
}

// Small local overlay-modal shell, same convention as AgentApprovals.jsx/
// Employees.jsx's own local Modal (and Marketing.jsx's before those) — no
// shared Modal component exists yet, so each page that needs one defines
// its own rather than reaching for the browser's native window.confirm.
function Modal({ title, onClose, children, footer }) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div className='fixed inset-0 bg-black/30' onClick={onClose} />
      <div className='relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6'>
        <div className='mb-4 flex items-start justify-between gap-3'>
          <h3 className='text-lg font-bold text-ink'>{title}</h3>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='text-lg leading-none text-muted hover:text-ink'
          >
            ×
          </button>
        </div>
        <div className='overflow-y-auto'>{children}</div>
        {footer && (
          <div className='mt-5 flex flex-wrap justify-end gap-2 border-t border-line-light pt-4'>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldTile({ label, children }) {
  return (
    <div className='rounded-md bg-panel px-3 py-2'>
      <div className='text-[10px] font-semibold uppercase text-muted'>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

// "View" — a quick read-only glance (same View/Edit split as the Agent
// Approvals and Employees tables): "Edit" below still opens the full
// FdPackageEditor route, which already does far more than a modal should
// try to replicate (itinerary builder, departure dates, addons, images).
// The price admins see for a package: the rate with the platform fee applied
// (stored on the package, fd_packages.rate_with_fee), with a note saying
// whether a fee was added. Falls back to the net rate for a row that hasn't
// been priced yet.
function packagePrice(pkg) {
  return pkg.ratePerPaxWithFee ?? pkg.ratePerPax;
}

function PlatformFeeNote({ pkg }) {
  const pct = Number(pkg.platformFeeApplied);
  if (pkg.platformFeeApplied == null) return null;
  return (
    <div className='text-[10px] text-muted'>
      {pct > 0 ? `incl. ${pct}% platform fee` : "no platform fee"}
    </div>
  );
}

function FdPackagePreviewModal({ pkg, onClose }) {
  const dateRange = formatDateRange(
    pkg.firstDepartureDate,
    pkg.lastDepartureDate
  );
  const badges = getFdBadges(pkg);
  const seatsTotal = pkg.seatsTotal ?? 0;
  const seatsBooked = pkg.seatsBooked ?? 0;

  return (
    <Modal
      title={pkg.title}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className='mb-4 flex flex-wrap items-center gap-1.5'>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            STATUS_BADGE_SOLID[pkg.status] || "bg-slate-700 text-white"
          }`}
        >
          {pkg.status}
        </span>
        {badges.map((b) => (
          <CardBadge key={b.label} tone={b.tone}>
            {b.label}
          </CardBadge>
        ))}
      </div>

      {pkg.heroImageUrl && (
        <img
          src={pkg.heroImageUrl}
          alt=''
          className='mb-4 h-40 w-full rounded-lg object-cover'
        />
      )}

      <div className='grid gap-3 text-sm sm:grid-cols-2'>
        <FieldTile label='Hotel'>{pkg.hotelName || "—"}</FieldTile>
        <FieldTile label='Theme'>{pkg.theme || "—"}</FieldTile>
        <FieldTile label='Duration'>{pkg.duration || "—"}</FieldTile>
        <FieldTile label='Departure dates'>
          {dateRange || "No dates yet"}
        </FieldTile>
        <FieldTile label='Rate per pax'>
          <Money amount={packagePrice(pkg)} />
          <PlatformFeeNote pkg={pkg} />
        </FieldTile>
        <FieldTile label='Seats'>
          {seatsTotal > 0
            ? `${Math.max(seatsTotal - seatsBooked, 0)} left of ${seatsTotal}`
            : "—"}
        </FieldTile>
      </div>
    </Modal>
  );
}

// Soft, icon-led badges for the FD Packages table — icon + label, so status
// never relies on colour alone.
const PACKAGE_STATUS_META = {
  published: { label: "Published", Icon: LuCircleCheck, tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  draft: { label: "Draft", Icon: LuFilePen, tone: "bg-slate-100 text-slate-600 ring-slate-200" },
  closed: { label: "Closed", Icon: LuLock, tone: "bg-rose-50 text-rose-700 ring-rose-200" },
};

function PackageStatusBadge({ status }) {
  const meta = PACKAGE_STATUS_META[status] || {
    label: status || "Unknown",
    Icon: LuFilePen,
    tone: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  const { Icon } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${meta.tone}`}
    >
      <Icon size={13} className='flex-none' />
      {meta.label}
    </span>
  );
}

function PackageTypeBadge({ type }) {
  const readymade = type === "readymade";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
        readymade
          ? "bg-violet-50 text-violet-700 ring-violet-200"
          : "bg-sky-50 text-sky-700 ring-sky-200"
      }`}
    >
      {readymade ? "Readymade" : "FD Package"}
    </span>
  );
}

// Table (not the FdPackageCard grid the other simple catalog tabs use) —
// FD packages carry enough operational data per row (theme, departure
// window, net rate, status) that a scannable table reads better here than a
// photo grid at this list size, and the reference this was built against
// (a dense, paginated ops list) called for one explicitly. Search and
// pagination (10/page) are both fully server-side — see
// fdPackagesAdmin.controller.js#list.
function FdPackagesTab({ onChanged }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [status, setStatus] = useState("");
  const [packageType, setPackageType] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    addDateFilterParams(params, dateFilter);
    addPriceRangeParams(params, priceRange);
    if (status) params.set("status", status);
    if (packageType) params.set("type", packageType);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    api
      .get(`/admin/fd-packages?${params.toString()}`)
      .then(({ fdPackages, pagination: p }) => {
        setItems(fdPackages);
        setPagination(p);
      })
      .catch((err) => setError(err.message || "Unable to load FD packages"))
      .finally(() => setLoading(false));
  }, [search, dateFilter, priceRange, status, packageType, page]);

  const hasFilters = !!(search || dateFilter || priceRange || status || packageType);
  const filterSelect =
    "h-10 w-full py-0 pl-3 pr-8 text-sm sm:w-auto sm:min-w-[150px] sm:flex-1 xl:max-w-[200px]";

  return (
    <div className='overflow-hidden rounded-xl border border-[#E4E9FB] bg-white shadow-[0_4px_16px_rgba(15,23,42,0.05)]'>
      {/* Toolbar — search grows to fill the row, filters share what's left,
          and everything wraps cleanly on narrower screens. */}
      <div className='flex flex-wrap items-center gap-2.5 border-b border-[#E4E9FB] p-4'>
        <div className='relative min-w-[220px] flex-[2_1_260px]'>
          <LuSearch
            size={16}
            className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]'
          />
          <TextInput
            className='h-10 py-0 pl-9 text-sm'
            placeholder='Search FD packages…'
            aria-label='Search FD packages'
            value={search}
            onChange={(e) => updateSearch(e.target.value)}
          />
        </div>
        <Select className={filterSelect} aria-label='Filter FD packages by date' value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}><option value=''>All dates</option>{DATE_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
        <Select className={filterSelect} aria-label='Filter FD packages by price' value={priceRange} onChange={(e) => { setPriceRange(e.target.value); setPage(1); }}><option value=''>All prices</option><PriceRangeOptions /></Select>
        <Select className={filterSelect} aria-label='Filter FD packages by status' value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value=''>All statuses</option><option value='published'>Published</option><option value='draft'>Draft</option><option value='closed'>Closed</option></Select>
        <Select className={filterSelect} aria-label='Filter packages by type' value={packageType} onChange={(e) => { setPackageType(e.target.value); setPage(1); }}><option value=''>All types</option><option value='fd_package'>FD Package</option><option value='readymade'>Readymade</option></Select>
        <Button asChild variant='accent' className='h-10 flex-none gap-1.5 px-4 text-sm'>
          <Link to='/admin/catalog/fd-packages/new'>
            <LuPlus size={16} />
            Add New Package
          </Link>
        </Button>
      </div>

      {error && (
        <div className='px-4 pt-3'>
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {loading ? (
        <div className='space-y-3 p-5'>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className='h-14 animate-pulse rounded-lg bg-slate-50' />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className='flex flex-col items-center justify-center gap-2 px-6 py-16 text-center'>
          <span className='flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4F46E5]'>
            <LuPackage size={22} />
          </span>
          <p className='text-sm font-semibold text-ink'>
            {hasFilters ? "No FD packages match these filters." : "No FD packages yet."}
          </p>
          {!hasFilters && (
            <p className='text-xs text-muted'>
              Create your first package with “Add New Package”.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[1100px] text-left text-sm'>
              <thead>
                <tr className='bg-[#F8FAFF] text-[11px] font-semibold uppercase tracking-wider text-[#64748B]'>
                  <th className='w-[28%] px-5 py-3'>Package</th>
                  <th className='px-4 py-3'>Type</th>
                  <th className='px-4 py-3'>Theme</th>
                  <th className='px-4 py-3'>Departure Dates</th>
                  <th className='px-4 py-3'>Rate (per pax)</th>
                  <th className='px-4 py-3'>Status</th>
                  <th className='px-4 py-3'>Updated</th>
                  <th className='px-5 py-3 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-[#EEF1FA]'>
                {items.map((pkg) => {
                  const dateRange = formatDateRange(
                    pkg.firstDepartureDate,
                    pkg.lastDepartureDate
                  );
                  const created = formatDateTime(pkg.createdAt ?? pkg.created_at);
                  return (
                    <tr
                      key={pkg.id}
                      className='align-middle transition-colors hover:bg-[#F8FAFF]'
                    >
                      <td className='px-5 py-3.5'>
                        <div className='flex items-center gap-3'>
                          <div className='h-12 w-12 flex-none overflow-hidden rounded-lg bg-[#EEF2FF] ring-1 ring-[#E4E9FB]'>
                            {pkg.heroImageUrl ? (
                              <img
                                src={pkg.heroImageUrl}
                                alt=''
                                className='h-full w-full object-cover'
                              />
                            ) : (
                              <div className='flex h-full w-full items-center justify-center text-[#A5B4D9]'>
                                <LuImage size={18} />
                              </div>
                            )}
                          </div>
                          <div className='min-w-0'>
                            <div
                              className={`truncate font-semibold ${
                                pkg.title ? "text-ink" : "italic text-muted"
                              }`}
                            >
                              {pkg.title || "Untitled package"}
                            </div>
                            <div className='mt-0.5 truncate text-xs text-muted'>
                              {[pkg.hotelName, created && `Created ${created}`]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className='whitespace-nowrap px-4 py-3.5'>
                        <PackageTypeBadge type={pkg.type} />
                      </td>
                      <td className='px-4 py-3.5 text-[#334155]'>
                        {pkg.theme || <span className='text-[#CBD5E1]'>—</span>}
                      </td>
                      <td className='whitespace-nowrap px-4 py-3.5 text-[#334155]'>
                        {dateRange || (
                          <span className='text-xs text-muted'>No dates yet</span>
                        )}
                      </td>
                      <td className='whitespace-nowrap px-4 py-3.5'>
                        <Money
                          amount={packagePrice(pkg)}
                          className='font-semibold text-ink'
                          inrClassName='!text-[11px] !font-normal'
                        />
                        <PlatformFeeNote pkg={pkg} />
                      </td>
                      <td className='whitespace-nowrap px-4 py-3.5'>
                        <PackageStatusBadge status={pkg.status} />
                      </td>
                      <td className='whitespace-nowrap px-4 py-3.5 text-xs text-muted'>
                        {formatDateTime(pkg.updatedAt ?? pkg.updated_at)}
                      </td>
                      <td className='px-5 py-3.5'>
                        <div className='flex flex-nowrap items-center justify-end gap-2'>
                          <Button
                            size='sm'
                            className='h-8 gap-1.5'
                            onClick={() => setPreviewing(pkg)}
                          >
                            <LuEye size={14} className='flex-none' />
                            View
                          </Button>
                          <Button asChild size='sm' variant='accent' className='h-8 gap-1.5'>
                            <Link to={`/admin/catalog/fd-packages/${pkg.id}`}>
                              <LuPencil size={14} className='flex-none' />
                              Edit
                            </Link>
                          </Button>
                          <button
                            type='button'
                            onClick={() => setPendingDelete(pkg)}
                            aria-label={`Delete ${pkg.title || "package"}`}
                            title='Delete'
                            className='flex h-8 w-8 flex-none items-center justify-center rounded-md border border-[#FECACA] text-[#DC2626] transition-colors hover:border-[#F87171] hover:bg-[#FEF2F2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]/30'
                          >
                            <LuTrash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className='border-t border-[#E4E9FB] px-5 pb-4'>
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onChange={setPage}
              itemLabel='FD packages'
            />
          </div>
        </>
      )}

      {previewing && (
        <FdPackagePreviewModal
          pkg={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}
      {pendingDelete && (
        <DeleteFdPackageModal
          pkg={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirmed={(id) => {
            setItems((list) => list.filter((i) => i.id !== id));
            setPendingDelete(null);
            setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

// Small generic confirm-before-delete modal, reusing the local Modal/
// FieldTile shell above — HotelsTab's own delete used to fire straight off
// a single click with no confirmation step at all; a standalone icon button
// (this table's Delete action) is easier to mis-click than the old card's
// inline text link was, so a confirm step is worth adding here even though
// it wasn't asked for outright.
function ConfirmDeleteModal({ title, message, onCancel, onConfirm }) {
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setError("");
    setDeleting(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message || "Unable to delete");
      setDeleting(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={deleting ? () => {} : onCancel}
      footer={
        <>
          <Button onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button variant='danger' onClick={handleConfirm} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
    >
      <p className='text-sm text-ink'>{message}</p>
      {error && (
        <div className='mt-3'>
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Modal>
  );
}

function HotelPreviewModal({ hotel, onClose }) {
  return (
    <Modal
      title={hotel.name}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {hotel.images?.[0] && (
        <img
          src={hotel.images[0]}
          alt=''
          className='mb-4 h-40 w-full rounded-lg object-cover'
        />
      )}
      <div className='grid gap-3 text-sm sm:grid-cols-2'>
        <FieldTile label='Location'>
          {[hotel.city, hotel.state].filter(Boolean).join(", ") || "—"}
        </FieldTile>
        <FieldTile label='Category'>
          {hotel.category ? `${hotel.category}★` : "—"}
        </FieldTile>
        <FieldTile label='Address'>{hotel.address || "—"}</FieldTile>
        <FieldTile label='Email'>{hotel.email || "—"}</FieldTile>
        <FieldTile label='Price / night'>
          {formatCurrency(hotel.price_per_night)}
        </FieldTile>
        <FieldTile label='MICE enabled'>
          {hotel.is_mice_enabled ? "Yes" : "No"}
        </FieldTile>
      </div>
      {!isEmptyHtml(hotel.description) && (
        <div className='mt-4'>
          <FieldLabel>Description</FieldLabel>
          <RichTextDisplay html={hotel.description} className='text-ink' />
        </div>
      )}
    </Modal>
  );
}

// Table — same reasoning, and same server-side search/pagination (10/page),
// as FdPackagesTab above. Tours/Activities/Transfers below were converted to
// this same shape too (they used to be a card grid).
function HotelsTab() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [status, setStatus] = useState("");
  const [cities, setCities] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  function updateFilter(setFilter, value) {
    setFilter(value);
    setPage(1);
  }

  useEffect(() => {
    api
      .get("/hotels")
      .then(({ hotels }) => {
        setCities(
          [...new Set(hotels.map((hotel) => hotel.city).filter(Boolean))].sort()
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    addDateFilterParams(params, dateFilter);
    if (city) params.set("city", city);
    if (category) params.set("category", category);
    if (priceRange) {
      const [min, max] = priceRange.split(":");
      if (min) params.set("priceMin", min);
      if (max) params.set("priceMax", max);
    }
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    api
      .get(`/hotels?${params.toString()}`)
      .then(({ hotels, pagination: p }) => {
        setItems(hotels);
        setPagination(p);
      })
      .catch((err) => setError(err.message || "Unable to load hotels"))
      .finally(() => setLoading(false));
  }, [search, dateFilter, city, category, priceRange, status, page]);

  const hasFilters = !!(search || city || category || priceRange || status);

  async function handleDelete(id) {
    await api.del(`/admin/hotels/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
    setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
    setPendingDelete(null);
  }

  return (
    <div>
      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <TextInput
          className='min-w-0 flex-1 px-3 py-2 text-xs xl:w-[150px] xl:flex-none'
          placeholder='Search hotels…'
          value={search}
          onChange={(e) => updateSearch(e.target.value)}
        />
        <DateFilter value={dateFilter} onChange={(value) => updateFilter(setDateFilter, value)} />
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[140px]'
          aria-label='Filter hotels by location'
          value={city}
          onChange={(e) => updateFilter(setCity, e.target.value)}
        >
          <option value=''>All locations</option>
          {cities.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[130px]'
          aria-label='Filter hotels by category'
          value={category}
          onChange={(e) => updateFilter(setCategory, e.target.value)}
        >
          <option value=''>All categories</option>
          {[3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value} stars
            </option>
          ))}
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[150px]'
          aria-label='Filter hotels by price per night'
          value={priceRange}
          onChange={(e) => updateFilter(setPriceRange, e.target.value)}
        >
          <option value=''>All prices</option>
          <PriceRangeOptions />
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[130px]'
          aria-label='Filter hotels by status'
          value={status}
          onChange={(e) => updateFilter(setStatus, e.target.value)}
        >
          <option value=''>All statuses</option>
          <option value='published'>Published</option>
          <option value='draft'>Draft</option>
        </Select>
        <Link className='flex-none' to='/admin/catalog/hotels/new'>
          <Button variant='accent'>+ Add New Hotel</Button>
        </Link>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className='text-xs text-muted'>Loading…</p>
      ) : items.length === 0 ? (
        <p className='text-xs text-muted'>
          {hasFilters ? "No hotels match these filters." : "No hotels yet."}
        </p>
      ) : (
        <>
          <Table
            columns={[
              "Hotel Name",
              "Location",
              "Category",
              "Price / Night",
              "MICE",
              "Status",
              "Updated",
              { label: "Actions", align: "right" },
            ]}
            rows={items}
            renderRow={(hotel) => (
              <tr
                key={hotel.id}
                className='border-b border-line-light transition-colors last:border-0 hover:bg-panel/50'
              >
                <td className='px-3 py-3 align-middle font-semibold text-ink'>
                  <div>{hotel.name}</div>
                  <div className='text-[10px] font-normal text-muted'>{formatDateTime(hotel.createdAt ?? hotel.created_at)}</div>
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {[hotel.city, hotel.state].filter(Boolean).join(", ") || "—"}
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {hotel.category ? `${hotel.category}★` : "—"}
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {formatCurrency(hotel.price_per_night)}
                </td>
                <td className='px-3 py-3 align-middle'>
                  {hotel.is_mice_enabled ? (
                    <span className='rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white'>
                      Yes
                    </span>
                  ) : (
                    <span className='text-xs text-muted'>—</span>
                  )}
                </td>
                <td className='px-3 py-3 align-middle'>
                  <StatusBadge status={hotel.status} />
                </td>
                <TimestampCells row={hotel} />
                <td className='px-3 py-3 align-middle'>
                  <div className='flex flex-nowrap items-center justify-end gap-2'>
                    <Button
                      size='sm'
                      className='whitespace-nowrap'
                      onClick={() => setPreviewing(hotel)}
                    >
                      <LuEye className='mr-1.5 flex-shrink-0' size={14} />
                      View
                    </Button>
                    <Link to={`/admin/catalog/hotels/${hotel.id}`}>
                      <Button
                        size='sm'
                        variant='accent'
                        className='whitespace-nowrap'
                      >
                        <LuPencil className='mr-1.5 flex-shrink-0' size={14} />
                        Edit
                      </Button>
                    </Link>
                    <button
                      type='button'
                      onClick={() => setPendingDelete(hotel)}
                      aria-label={`Delete ${hotel.name}`}
                      className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]'
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </div>
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
            itemLabel='hotels'
          />
        </>
      )}

      {previewing && (
        <HotelPreviewModal
          hotel={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDeleteModal
          title='Delete hotel?'
          message={
            <>
              Delete{" "}
              <span className='font-semibold'>"{pendingDelete.name}"</span>?
              This can't be undone.
            </>
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.id)}
        />
      )}
    </div>
  );
}

function TourPreviewModal({ tour, onClose }) {
  return (
    <Modal
      title={tour.name}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className='mb-4'>
        <StatusBadge status={tour.status} />
      </div>
      {tour.images?.[0] && (
        <img
          src={tour.images[0]}
          alt=''
          className='mb-4 h-40 w-full rounded-lg object-cover'
        />
      )}
      <div className='grid gap-3 text-sm sm:grid-cols-2'>
        <FieldTile label='City'>{tour.city || "—"}</FieldTile>
        <FieldTile label='Duration'>{tour.duration || "—"}</FieldTile>
        <FieldTile label='Category'>{tour.category || "—"}</FieldTile>
        {!vehiclePricesFromRow(tour) && (
          <FieldTile label='Price (per person)'>
            {formatCurrency(tour.price)}
          </FieldTile>
        )}
        <FieldTile label='Pickup time'>
          {formatTime(tour.pickupTime ?? tour.pickup_time) || "—"}
        </FieldTile>
        <FieldTile label='Suitable age (min)'>
          {tour.suitable_age_min ?? "—"}
        </FieldTile>
        <FieldTile label='Bestseller'>
          {tour.is_bestseller ? "Yes" : "No"}
        </FieldTile>
      </div>
      {vehiclePricesFromRow(tour) && (
        <div className='mt-4'>
          <FieldLabel>Pricing by vehicle</FieldLabel>
          <TourVehiclePriceTable vehiclePrices={vehiclePricesFromRow(tour)} />
        </div>
      )}
      {!isEmptyHtml(tour.description) && (
        <div className='mt-4'>
          <FieldLabel>Description</FieldLabel>
          <RichTextDisplay html={tour.description} className='text-ink' />
        </div>
      )}
    </Modal>
  );
}

// Table (not the CatalogCard grid this used to be) — same reasoning, and
// same server-side search/pagination (10/page), as HotelsTab above.
// Product Catalog "Vehicles" tab - the master list a tour's "pricing by
// vehicle" picks from (TourEditor). Each vehicle has a name and a passenger
// range; the price entered for it on a tour is the total for a full vehicle,
// so max passengers is also the divisor for the per-person price.
function VehiclesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | vehicle row
  const [form, setForm] = useState({ name: "", minPax: "", maxPax: "", price: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [minPeople, setMinPeople] = useState("");
  const [maxPeople, setMaxPeople] = useState("");
  const [page, setPage] = useState(1);
  const VEHICLES_PAGE_SIZE = 10;

  function load() {
    setLoading(true);
    setError("");
    api
      .get("/vehicles")
      .then(({ vehicles }) =>
        setItems(
          [...(vehicles || [])].sort(
            (a, b) => a.min_pax - b.min_pax || a.name.localeCompare(b.name)
          )
        )
      )
      .catch((err) => setError(err.message || "Unable to load vehicles"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openNew() {
    setForm({ name: "", minPax: "", maxPax: "", price: "" });
    setFormError("");
    setEditing("new");
  }

  function openEdit(vehicle) {
    setForm({
      name: vehicle.name,
      minPax: String(vehicle.min_pax),
      maxPax: String(vehicle.max_pax),
      price: vehicle.price == null ? "" : String(Number(vehicle.price)),
    });
    setFormError("");
    setEditing(vehicle);
  }

  async function save() {
    const name = form.name.trim();
    const minPax = Number(form.minPax);
    const maxPax = Number(form.maxPax);
    if (!name) return setFormError("Enter a vehicle name.");
    if (!Number.isInteger(minPax) || minPax < 1)
      return setFormError("Minimum passengers must be a whole number, at least 1.");
    if (!Number.isInteger(maxPax) || maxPax < 1)
      return setFormError("Maximum passengers must be a whole number, at least 1.");
    if (maxPax < minPax)
      return setFormError("Maximum passengers can't be less than the minimum.");
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0)
      return setFormError("Enter a price greater than 0.");
    setSaving(true);
    setFormError("");
    try {
      if (editing === "new") {
        await api.post("/admin/vehicles", { name, minPax, maxPax, price });
      } else {
        await api.patch(`/admin/vehicles/${editing.id}`, { name, minPax, maxPax, price });
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(
        err.status === 409 ? "A vehicle with this name already exists." : err.message || "Unable to save"
      );
    } finally {
      setSaving(false);
    }
  }

  // The Vehicles list is small, so search/filter/paging happen here rather
  // than per request; the tour pricing dropdown still gets the full list.
  const perPerson = (v) => (v.price == null || !v.max_pax ? null : Number(v.price) / v.max_pax);
  const needle = search.trim().toLowerCase();
  const dateParams = new URLSearchParams();
  addDateFilterParams(dateParams, dateFilter);
  const dateFrom = dateParams.get("dateFrom");
  const dateTo = dateParams.get("dateTo");
  const [priceMin, priceMax] = priceRange ? priceRange.split(":") : ["", ""];
  const filtered = items.filter((v) => {
    if (needle && !v.name.toLowerCase().includes(needle)) return false;
    if (dateFrom && dateTo) {
      const created = new Date(v.created_at);
      const day = Number.isNaN(created.getTime())
        ? ""
        : new Date(created.getTime() - created.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      if (!day || day < dateFrom || day > dateTo) return false;
    }
    if (priceRange) {
      const pp = perPerson(v);
      if (pp == null) return false;
      if (priceMin && pp < Number(priceMin)) return false;
      if (priceMax && pp > Number(priceMax)) return false;
    }
    // Typed in by hand: vehicles that start at (or above) the minimum and
    // hold no more than the maximum.
    if (minPeople !== "" && v.min_pax < Number(minPeople)) return false;
    if (maxPeople !== "" && v.max_pax > Number(maxPeople)) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / VEHICLES_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * VEHICLES_PAGE_SIZE,
    currentPage * VEHICLES_PAGE_SIZE
  );
  const hasFilters = needle || dateFilter || priceRange || minPeople !== "" || maxPeople !== "";
  const resetFilters = () => {
    setSearch("");
    setDateFilter("");
    setPriceRange("");
    setMinPeople("");
    setMaxPeople("");
    setPage(1);
  };
  function updateFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  return (
    <div>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
        <p className='max-w-xl text-xs text-muted'>
          Vehicles a tour can be priced with. On a tour you pick a vehicle and
          enter the total price for a full vehicle; the per-person price is that
          total divided by the vehicle's maximum passengers.
        </p>
        <Button variant='accent' onClick={openNew}>
          + Add New Vehicle
        </Button>
      </div>

      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <TextInput
          className='min-w-0 flex-1 px-3 py-2 text-xs xl:w-[150px] xl:flex-none'
          placeholder='Search vehicles…'
          value={search}
          onChange={(e) => updateFilter(setSearch, e.target.value)}
        />
        <DateFilter value={dateFilter} onChange={(value) => updateFilter(setDateFilter, value)} />
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[145px] xl:flex-none'
          aria-label='Filter vehicles by price per person'
          value={priceRange}
          onChange={(e) => updateFilter(setPriceRange, e.target.value)}
        >
          <option value=''>All prices</option>
          <PriceRangeOptions />
        </Select>
        <TextInput
          type='number'
          min='1'
          className='w-full px-2.5 py-2 text-xs sm:w-[120px]'
          aria-label='Filter vehicles by minimum people'
          placeholder='Min people'
          value={minPeople}
          onChange={(e) => updateFilter(setMinPeople, e.target.value)}
        />
        <TextInput
          type='number'
          min='1'
          className='w-full px-2.5 py-2 text-xs sm:w-[120px]'
          aria-label='Filter vehicles by maximum people'
          placeholder='Max people'
          value={maxPeople}
          onChange={(e) => updateFilter(setMaxPeople, e.target.value)}
        />
        {hasFilters && (
          <button
            type='button'
            onClick={resetFilters}
            className='text-xs font-semibold text-accent hover:underline'
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      {loading ? (
        <p className='text-xs text-muted'>Loading…</p>
      ) : items.length === 0 ? (
        <p className='text-xs text-muted'>
          No vehicles yet. Add one to start pricing tours by vehicle.
        </p>
      ) : filtered.length === 0 ? (
        <p className='text-xs text-muted'>No vehicles match those filters.</p>
      ) : (
        <>
        <Table
          columns={[
            "Vehicle",
            "Min passengers",
            "Max passengers",
            "Price (total)",
            "Per person",
            { label: "Actions", align: "right" },
          ]}
          rows={pageRows}
          renderRow={(vehicle) => (
            <tr
              key={vehicle.id}
              className='border-b border-line-light transition-colors last:border-0 hover:bg-panel/50'
            >
              <td className='px-3 py-3 align-middle font-semibold text-ink'>
                {vehicle.name}
              </td>
              <td className='px-3 py-3 align-middle'>{vehicle.min_pax}</td>
              <td className='px-3 py-3 align-middle'>{vehicle.max_pax}</td>
              <td className='px-3 py-3 align-middle whitespace-nowrap'>
                {vehicle.price == null ? "—" : <Money amount={Number(vehicle.price)} />}
              </td>
              <td className='px-3 py-3 align-middle whitespace-nowrap'>
                {vehicle.price == null || !vehicle.max_pax
                  ? "—"
                  : <Money amount={Number(vehicle.price) / vehicle.max_pax} />}
              </td>
              <td className='px-3 py-3 align-middle'>
                <div className='flex flex-nowrap items-center justify-end gap-2'>
                  <Button
                    size='sm'
                    variant='accent'
                    className='whitespace-nowrap'
                    onClick={() => openEdit(vehicle)}
                  >
                    <LuPencil className='mr-1.5 flex-shrink-0' size={14} />
                    Edit
                  </Button>
                  <button
                    type='button'
                    onClick={() => setPendingDelete(vehicle)}
                    aria-label={`Delete ${vehicle.name}`}
                    className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]'
                  >
                    <LuTrash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={filtered.length}
          pageSize={VEHICLES_PAGE_SIZE}
          onChange={setPage}
          itemLabel='vehicles'
        />
        </>
      )}

      {editing && (
        <Modal
          title={editing === "new" ? "Add vehicle" : "Edit vehicle"}
          onClose={saving ? () => {} : () => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button variant='accent' onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <div className='space-y-3'>
            <div>
              <FieldLabel>Vehicle name *</FieldLabel>
              <TextInput
                autoFocus
                placeholder='e.g. Sedan, 20 Seater Bus'
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <FieldLabel>Min passengers *</FieldLabel>
                <TextInput
                  type='number'
                  min='1'
                  value={form.minPax}
                  onChange={(e) => setForm({ ...form, minPax: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel>Max passengers *</FieldLabel>
                <TextInput
                  type='number'
                  min='1'
                  value={form.maxPax}
                  onChange={(e) => setForm({ ...form, maxPax: e.target.value })}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Price (OMR) *</FieldLabel>
              <TextInput
                type='number'
                min='0.01'
                step='0.01'
                placeholder='Total for a full vehicle'
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              <p className='mt-1 text-[11px] text-muted'>
                Total for the vehicle filled to capacity.
                {Number(form.price) > 0 && Number(form.maxPax) > 0
                  ? ` That is ${formatCurrency(Number(form.price) / Number(form.maxPax))} per person.`
                  : ""}
              </p>
            </div>
            {editing !== "new" && (
              <p className='text-[11px] text-muted'>
                Changing a vehicle's name or passenger range also updates it on
                every tour that is priced with it. Prices already set on tours
                stay as they are.
              </p>
            )}
            {formError && <ErrorText>{formError}</ErrorText>}
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          title='Delete vehicle?'
          message={`Delete "${pendingDelete.name}"? A vehicle that is priced on a tour can't be deleted until it is removed from that tour.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await api.del(`/admin/vehicles/${pendingDelete.id}`);
            setPendingDelete(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ToursTab() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const { cities, categories } = useCatalogOptions("/tours", "tours");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [durationRange, setDurationRange] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  function updateFilter(setFilter, value) {
    setFilter(value);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    addDateFilterParams(params, dateFilter);
    if (city) params.set("city", city);
    if (category) params.set("category", category);
    if (durationRange) params.set("durationRange", durationRange);
    addPriceRangeParams(params, priceRange);
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    api
      .get(`/tours?${params.toString()}`)
      .then(({ tours, pagination: p }) => {
        setItems(tours);
        setPagination(p);
      })
      .catch((err) => setError(err.message || "Unable to load tours"))
      .finally(() => setLoading(false));
  }, [search, dateFilter, city, category, durationRange, priceRange, status, page]);

  const hasFilters = !!(
    search ||
    city ||
    category ||
    durationRange ||
    priceRange ||
    status
  );

  async function handleDelete(id) {
    await api.del(`/admin/tours/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
    setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
    setPendingDelete(null);
  }

  return (
    <div>
      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <TextInput
          className='min-w-0 flex-1 px-3 py-2 text-xs xl:w-[150px] xl:flex-none'
          placeholder='Search tours…'
          value={search}
          onChange={(e) => updateSearch(e.target.value)}
        />
        <DateFilter value={dateFilter} onChange={(value) => updateFilter(setDateFilter, value)} />
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[140px]'
          aria-label='Filter tours by location'
          value={city}
          onChange={(e) => updateFilter(setCity, e.target.value)}
        >
          <option value=''>All locations</option>
          {cities.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[140px]'
          aria-label='Filter tours by category'
          value={category}
          onChange={(e) => updateFilter(setCategory, e.target.value)}
        >
          <option value=''>All categories</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[140px]'
          aria-label='Filter tours by duration'
          value={durationRange}
          onChange={(e) => updateFilter(setDurationRange, e.target.value)}
        >
          <option value=''>All durations</option>
          <option value='lt2'>Less than 2</option>
          <option value='2-4'>2–4</option>
          <option value='5-7'>5–7</option>
          <option value='8-10'>8–10</option>
          <option value='gt10'>More than 10</option>
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[150px]'
          aria-label='Filter tours by price'
          value={priceRange}
          onChange={(e) => updateFilter(setPriceRange, e.target.value)}
        >
          <option value=''>All prices</option>
          <PriceRangeOptions />
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[130px]'
          aria-label='Filter tours by status'
          value={status}
          onChange={(e) => updateFilter(setStatus, e.target.value)}
        >
          <option value=''>All statuses</option>
          <option value='published'>Published</option>
          <option value='draft'>Draft</option>
        </Select>
        <Link className='flex-none' to='/admin/catalog/tours/new'>
          <Button variant='accent'>+ Add New Tour</Button>
        </Link>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className='text-xs text-muted'>Loading…</p>
      ) : items.length === 0 ? (
        <p className='text-xs text-muted'>
          {hasFilters ? "No tours match these filters." : "No tours yet."}
        </p>
      ) : (
        <>
          <Table
            columns={[
              "Tour Name",
              "City",
              "Duration",
              "Category",
              "Price",
              "Status",
              "Updated",
              { label: "Actions", align: "right" },
            ]}
            rows={items}
            renderRow={(tour) => (
              <tr
                key={tour.id}
                className='border-b border-line-light transition-colors last:border-0 hover:bg-panel/50'
              >
                <td className='px-3 py-3 align-middle font-semibold text-ink'>
                  <div>{tour.name}</div>
                  <div className='text-[10px] font-normal text-muted'>{formatDateTime(tour.createdAt ?? tour.created_at)}</div>
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {tour.city || "—"}
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {tour.duration || "—"}
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {tour.category || "—"}
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {tourPriceSummary(vehiclePricesFromRow(tour), tour.price)}
                </td>
                <td className='px-3 py-3 align-middle'>
                  <StatusBadge status={tour.status} />
                </td>
                <TimestampCells row={tour} />
                <td className='px-3 py-3 align-middle'>
                  <div className='flex flex-nowrap items-center justify-end gap-2'>
                    <Button
                      size='sm'
                      className='whitespace-nowrap'
                      onClick={() => setPreviewing(tour)}
                    >
                      <LuEye className='mr-1.5 flex-shrink-0' size={14} />
                      View
                    </Button>
                    <Link to={`/admin/catalog/tours/${tour.id}`}>
                      <Button
                        size='sm'
                        variant='accent'
                        className='whitespace-nowrap'
                      >
                        <LuPencil className='mr-1.5 flex-shrink-0' size={14} />
                        Edit
                      </Button>
                    </Link>
                    <button
                      type='button'
                      onClick={() => setPendingDelete(tour)}
                      aria-label={`Delete ${tour.name}`}
                      className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]'
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </div>
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
            itemLabel='tours'
          />
        </>
      )}

      {previewing && (
        <TourPreviewModal
          tour={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDeleteModal
          title='Delete tour?'
          message={
            <>
              Delete{" "}
              <span className='font-semibold'>"{pendingDelete.name}"</span>?
              This can't be undone.
            </>
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.id)}
        />
      )}
    </div>
  );
}

function ActivityPreviewModal({ activity, onClose }) {
  const pricePerPax = activity.pricePerPax ?? activity.price_per_pax;
  const isBestseller = activity.isBestseller ?? activity.is_bestseller;
  return (
    <Modal
      title={activity.name}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className='mb-4'>
        <StatusBadge status={activity.status} />
      </div>
      {activity.images?.[0] && (
        <img
          src={activity.images[0]}
          alt=''
          className='mb-4 h-40 w-full rounded-lg object-cover'
        />
      )}
      <div className='grid gap-3 text-sm sm:grid-cols-2'>
        <FieldTile label='City'>{activity.city || "—"}</FieldTile>
        <FieldTile label='Duration'>{activity.duration || "—"}</FieldTile>
        <FieldTile label='Price per pax'>
          {formatCurrency(pricePerPax)}
        </FieldTile>
        <FieldTile label='Pickup time'>
          {formatTime(activity.pickupTime ?? activity.pickup_time) || "—"}
        </FieldTile>
        <FieldTile label='Bestseller'>{isBestseller ? "Yes" : "No"}</FieldTile>
      </div>
      {!isEmptyHtml(activity.description) && (
        <div className='mt-4'>
          <FieldLabel>Description</FieldLabel>
          <RichTextDisplay html={activity.description} className='text-ink' />
        </div>
      )}
    </Modal>
  );
}

// Table (not the CatalogCard grid this used to be) — same reasoning, and
// same server-side search/pagination (10/page), as HotelsTab above.
function ActivitiesTab() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const { cities } = useCatalogOptions("/activities", "activities");
  const [city, setCity] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [bestseller, setBestseller] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  function updateFilter(setFilter, value) {
    setFilter(value);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    addDateFilterParams(params, dateFilter);
    if (city) params.set("city", city);
    addPriceRangeParams(params, priceRange);
    if (bestseller) params.set("bestseller", bestseller);
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    api
      .get(`/activities?${params.toString()}`)
      .then(({ activities, pagination: p }) => {
        setItems(activities);
        setPagination(p);
      })
      .catch((err) => setError(err.message || "Unable to load activities"))
      .finally(() => setLoading(false));
  }, [search, dateFilter, city, priceRange, bestseller, status, page]);

  const hasFilters = !!(search || city || priceRange || bestseller || status);

  async function handleDelete(id) {
    await api.del(`/admin/activities/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
    setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
    setPendingDelete(null);
  }

  return (
    <div>
      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <TextInput
          className='min-w-0 flex-1 px-3 py-2 text-xs xl:w-[150px] xl:flex-none'
          placeholder='Search activities…'
          value={search}
          onChange={(e) => updateSearch(e.target.value)}
        />
        <DateFilter value={dateFilter} onChange={(value) => updateFilter(setDateFilter, value)} />
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[140px]'
          aria-label='Filter activities by location'
          value={city}
          onChange={(e) => updateFilter(setCity, e.target.value)}
        >
          <option value=''>All locations</option>
          {cities.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[150px]'
          aria-label='Filter activities by price per person'
          value={priceRange}
          onChange={(e) => updateFilter(setPriceRange, e.target.value)}
        >
          <option value=''>All prices</option>
          <PriceRangeOptions />
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[140px]'
          aria-label='Filter activities by bestseller status'
          value={bestseller}
          onChange={(e) => updateFilter(setBestseller, e.target.value)}
        >
          <option value=''>All activities</option>
          <option value='true'>Bestsellers</option>
          <option value='false'>Not bestsellers</option>
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[130px]'
          aria-label='Filter activities by status'
          value={status}
          onChange={(e) => updateFilter(setStatus, e.target.value)}
        >
          <option value=''>All statuses</option>
          <option value='published'>Published</option>
          <option value='draft'>Draft</option>
        </Select>
        <Link className='flex-none' to='/admin/catalog/activities/new'>
          <Button variant='accent'>+ Add New Activity</Button>
        </Link>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className='text-xs text-muted'>Loading…</p>
      ) : items.length === 0 ? (
        <p className='text-xs text-muted'>
          {hasFilters
            ? "No activities match these filters."
            : "No activities yet."}
        </p>
      ) : (
        <>
          <Table
            columns={[
              "Activity Name",
              "City",
              "Duration",
              "Price per pax",
              "Status",
              "Updated",
              { label: "Actions", align: "right" },
            ]}
            rows={items}
            renderRow={(activity) => (
              <tr
                key={activity.id}
                className='border-b border-line-light transition-colors last:border-0 hover:bg-panel/50'
              >
                <td className='px-3 py-3 align-middle font-semibold text-ink'>
                  <div>{activity.name}</div>
                  <div className='text-[10px] font-normal text-muted'>{formatDateTime(activity.createdAt ?? activity.created_at)}</div>
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {activity.city || "—"}
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {activity.duration || "—"}
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {formatCurrency(
                    activity.pricePerPax ?? activity.price_per_pax
                  )}
                </td>
                <td className='px-3 py-3 align-middle'>
                  <StatusBadge status={activity.status} />
                </td>
                <TimestampCells row={activity} />
                <td className='px-3 py-3 align-middle'>
                  <div className='flex flex-nowrap items-center justify-end gap-2'>
                    <Button
                      size='sm'
                      className='whitespace-nowrap'
                      onClick={() => setPreviewing(activity)}
                    >
                      <LuEye className='mr-1.5 flex-shrink-0' size={14} />
                      View
                    </Button>
                    <Link to={`/admin/catalog/activities/${activity.id}`}>
                      <Button
                        size='sm'
                        variant='accent'
                        className='whitespace-nowrap'
                      >
                        <LuPencil className='mr-1.5 flex-shrink-0' size={14} />
                        Edit
                      </Button>
                    </Link>
                    <button
                      type='button'
                      onClick={() => setPendingDelete(activity)}
                      aria-label={`Delete ${activity.name}`}
                      className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]'
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </div>
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
            itemLabel='activities'
          />
        </>
      )}

      {previewing && (
        <ActivityPreviewModal
          activity={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDeleteModal
          title='Delete activity?'
          message={
            <>
              Delete{" "}
              <span className='font-semibold'>"{pendingDelete.name}"</span>?
              This can't be undone.
            </>
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.id)}
        />
      )}
    </div>
  );
}

function TransferPreviewModal({ transfer, onClose }) {
  const vehicleClass = transfer.vehicleClass || transfer.vehicle_class;
  return (
    <Modal
      title={transfer.name}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className='mb-4'>
        <StatusBadge status={transfer.status} />
      </div>
      {transfer.images?.[0] && (
        <img
          src={transfer.images[0]}
          alt=''
          className='mb-4 h-40 w-full rounded-lg object-cover'
        />
      )}
      <div className='grid gap-3 text-sm sm:grid-cols-2'>
        <FieldTile label='Type'>{transfer.type || "—"}</FieldTile>
        <FieldTile label='Vehicle class'>{vehicleClass || "—"}</FieldTile>
        <FieldTile label='City'>{transfer.city || "—"}</FieldTile>
        <FieldTile label='Price'>{formatCurrency(transfer.price)}</FieldTile>
        <FieldTile label='Pickup time'>
          {formatTime(transfer.pickupTime ?? transfer.pickup_time) || "—"}
        </FieldTile>
      </div>
      {!isEmptyHtml(transfer.description) && (
        <div className='mt-4'>
          <FieldLabel>Description</FieldLabel>
          <RichTextDisplay html={transfer.description} className='text-ink' />
        </div>
      )}
    </Modal>
  );
}

// Table (not the CatalogCard grid this used to be) — same reasoning, and
// same server-side search/pagination (10/page), as HotelsTab above.
function TransfersTab() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const { cities, vehicleClasses } = useCatalogOptions(
    "/transfers",
    "transfers"
  );
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [vehicleClass, setVehicleClass] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  function updateFilter(setFilter, value) {
    setFilter(value);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    addDateFilterParams(params, dateFilter);
    if (city) params.set("city", city);
    if (type) params.set("type", type);
    if (vehicleClass) params.set("vehicleClass", vehicleClass);
    addPriceRangeParams(params, priceRange);
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    api
      .get(`/transfers?${params.toString()}`)
      .then(({ transfers, pagination: p }) => {
        setItems(transfers);
        setPagination(p);
      })
      .catch((err) => setError(err.message || "Unable to load transfers"))
      .finally(() => setLoading(false));
  }, [search, dateFilter, city, type, vehicleClass, priceRange, status, page]);

  const hasFilters = !!(
    search ||
    city ||
    type ||
    vehicleClass ||
    priceRange ||
    status
  );

  async function handleDelete(id) {
    await api.del(`/admin/transfers/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
    setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
    setPendingDelete(null);
  }

  return (
    <div>
      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <TextInput
          className='min-w-0 flex-1 px-3 py-2 text-xs sm:max-w-[180px] xl:w-[150px] xl:flex-none'
          placeholder='Search transfers…'
          value={search}
          onChange={(e) => updateSearch(e.target.value)}
        />
        <DateFilter value={dateFilter} onChange={(value) => updateFilter(setDateFilter, value)} />
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[140px]'
          aria-label='Filter transfers by location'
          value={city}
          onChange={(e) => updateFilter(setCity, e.target.value)}
        >
          <option value=''>All locations</option>
          {cities.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[150px]'
          aria-label='Filter transfers by type'
          value={type}
          onChange={(e) => updateFilter(setType, e.target.value)}
        >
          <option value=''>All types</option>
          <option value='airport'>Airport</option>
          <option value='intercity'>Intercity</option>
          <option value='point_to_point'>Point to point</option>
          <option value='group_coach'>Group coach</option>
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[140px]'
          aria-label='Filter transfers by vehicle class'
          value={vehicleClass}
          onChange={(e) => updateFilter(setVehicleClass, e.target.value)}
        >
          <option value=''>All vehicle classes</option>
          {vehicleClasses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[150px]'
          aria-label='Filter transfers by price'
          value={priceRange}
          onChange={(e) => updateFilter(setPriceRange, e.target.value)}
        >
          <option value=''>All prices</option>
          <PriceRangeOptions />
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[130px]'
          aria-label='Filter transfers by status'
          value={status}
          onChange={(e) => updateFilter(setStatus, e.target.value)}
        >
          <option value=''>All statuses</option>
          <option value='published'>Published</option>
          <option value='draft'>Draft</option>
        </Select>
        <Link className='flex-none' to='/admin/catalog/transfers/new'>
          <Button variant='accent'>+ Add New Transfer</Button>
        </Link>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className='text-xs text-muted'>Loading…</p>
      ) : items.length === 0 ? (
        <p className='text-xs text-muted'>
          {hasFilters
            ? "No transfers match these filters."
            : "No transfers yet."}
        </p>
      ) : (
        <>
          <Table
            columns={[
              "Name",
              "Type",
              "Vehicle Class",
              "City",
              "Price",
              "Status",
              "Updated",
              { label: "Actions", align: "right" },
            ]}
            rows={items}
            renderRow={(transfer) => (
              <tr
                key={transfer.id}
                className='border-b border-line-light transition-colors last:border-0 hover:bg-panel/50'
              >
                <td className='px-3 py-3 align-middle font-semibold text-ink'>
                  <div>{transfer.name}</div>
                  <div className='text-[10px] font-normal text-muted'>{formatDateTime(transfer.createdAt ?? transfer.created_at)}</div>
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {transfer.type || "—"}
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {transfer.vehicleClass || transfer.vehicle_class || "—"}
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {transfer.city || "—"}
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {formatCurrency(transfer.price)}
                </td>
                <td className='px-3 py-3 align-middle'>
                  <StatusBadge status={transfer.status} />
                </td>
                <TimestampCells row={transfer} />
                <td className='px-3 py-3 align-middle'>
                  <div className='flex flex-nowrap items-center justify-end gap-2'>
                    <Button
                      size='sm'
                      className='whitespace-nowrap'
                      onClick={() => setPreviewing(transfer)}
                    >
                      <LuEye className='mr-1.5 flex-shrink-0' size={14} />
                      View
                    </Button>
                    <Link to={`/admin/catalog/transfers/${transfer.id}`}>
                      <Button
                        size='sm'
                        variant='accent'
                        className='whitespace-nowrap'
                      >
                        <LuPencil className='mr-1.5 flex-shrink-0' size={14} />
                        Edit
                      </Button>
                    </Link>
                    <button
                      type='button'
                      onClick={() => setPendingDelete(transfer)}
                      aria-label={`Delete ${transfer.name}`}
                      className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]'
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </div>
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
            itemLabel='transfers'
          />
        </>
      )}

      {previewing && (
        <TransferPreviewModal
          transfer={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDeleteModal
          title='Delete transfer?'
          message={
            <>
              Delete{" "}
              <span className='font-semibold'>"{pendingDelete.name}"</span>?
              This can't be undone.
            </>
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.id)}
        />
      )}
    </div>
  );
}

// Meals are a simple ancillary rate (no photos, no dedicated edit page) —
// unlike Activities/Transfers above, this stays as one self-contained tab
// with an inline add form, closer to the old pre-photo catalog pattern.
// Lunch and Dinner are independent entries — their own sub-tab, their own
// list, their own save — rather than one row holding both prices, since the
// two are managed independently (mirrors 0038_meals_split_type.sql on the
// backend). Only "price for 1 day" is captured/shown here — FdPackageEditor's
// Meals section treats it as the per-person-per-day rate, multiplying it by
// both headcount and day count (see computeMealsCost). The catalog's
// `price_per_person` column still exists but is no longer set from this UI.
const EMPTY_MEAL_FORM = {
  name: "",
  mealType: "lunch",
  category: "veg",
  pricePerDay: "",
  description: "",
  isLiquor: false,
  liquorBrand: "",
  liquorPriceQuarter: "",
  liquorPriceHalf: "",
  liquorPriceFull: "",
  liquorPricePerMl: "",
  liquorSizes: [],
  liquorCategory: "",
};

function mealFormValues(meal) {
  if (!meal) return EMPTY_MEAL_FORM;
  return {
    name: meal.name || "",
    mealType: meal.meal_type || "lunch",
    category: meal.category || "veg",
    pricePerDay: meal.price_per_day ?? "",
    description: meal.description || "",
    isLiquor: !!meal.is_liquor,
    liquorBrand: meal.liquor_brand || "",
    liquorPriceQuarter: meal.liquor_price_quarter ?? "",
    liquorPriceHalf: meal.liquor_price_half ?? "",
    liquorPriceFull: meal.liquor_price_full ?? "",
    liquorPricePerMl: meal.liquor_price_per_ml ?? meal.liquor_price_ml ?? "",
    liquorSizes: [
      meal.liquor_price_quarter != null ? "quarter" : null,
      meal.liquor_price_half != null ? "half" : null,
      meal.liquor_price_full != null ? "full" : null,
      meal.liquor_price_per_ml != null || meal.liquor_price_ml != null ? "per_ml" : null,
    ].filter(Boolean),
    liquorCategory: meal.liquor_category || "",
  };
}

const LIQUOR_SIZE_OPTIONS = [
  { value: "quarter", label: "Quarter" },
  { value: "half", label: "Half" },
  { value: "full", label: "Full" },
  { value: "per_ml", label: "Per ml" },
];

// Saved category values ("non_veg", "south-indian") -> display labels
// ("Non_Veg" style title-casing the form has always used), shared by the
// category picker, the Meals filter and the Meals table.
const formatCategoryLabel = (category) =>
  String(category || "").replace(/(^|[_-])\w/g, (match) => match.toUpperCase());

function CategorySelect({ value, options, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!containerRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={containerRef} className='relative'>
      <button type='button' onClick={() => setOpen((current) => !current)} className='flex min-h-[42px] w-full items-center justify-between rounded-md border border-line-light bg-white px-3 text-left text-sm text-ink shadow-sm hover:border-accent'>
        <span className={value ? "text-ink" : "text-muted"}>{value && value !== "__add_category__" ? formatCategoryLabel(value) : "Select category"}</span>
        <span className='text-xs text-muted'>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className='absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-line-light bg-white shadow-lg'>
        <button type='button' onClick={() => { setOpen(false); onChange({ target: { value: "__add_category__" } }); }} className='block w-full border-b border-line-light px-3 py-2 text-left text-sm font-semibold text-accent hover:bg-panel'>+ Add new category</button>
        {options.map((category) => <div key={category} className='flex items-center border-b border-line-light last:border-b-0 hover:bg-panel'>
          <button type='button' onClick={() => { setOpen(false); onChange({ target: { value: category } }); }} className='min-w-0 flex-1 px-3 py-2 text-left text-sm text-ink'>{formatCategoryLabel(category)}</button>
          <button type='button' aria-label={`Delete ${category}`} onClick={() => onDelete(category)} className='mr-2 flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-rose-50 hover:text-rose-600'><LuTrash2 size={14} /></button>
        </div>)}
      </div>}
    </div>
  );
}

function LiquorPricingFields({ form, update }) {
  const [open, setOpen] = useState(true);
  const priceFields = {
    quarter: "liquorPriceQuarter",
    half: "liquorPriceHalf",
    full: "liquorPriceFull",
    per_ml: "liquorPricePerMl",
  };

  return (
    <div className='sm:col-span-2 border-t border-line-light pt-4'>
      <div className='mb-3'>
        <h4 className='text-sm font-semibold text-ink'>Liquor pricing</h4>
        <p className='mt-1 text-xs text-muted'>Select the available price units and enter each price.</p>
      </div>
      <div className='grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-3.5 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted'>
        <span>Price units</span>
        <span>Price (OMR)</span>
      </div>
      <button type='button' onClick={() => setOpen((current) => !current)} className='flex w-full items-center justify-between rounded-md border border-line-light bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-ink shadow-sm transition hover:border-accent'>
        <span>{form.liquorSizes.length} selected</span>
        <span className='text-sm text-muted'>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className='mt-2 overflow-hidden rounded-md border border-line-light bg-white'>
      {LIQUOR_SIZE_OPTIONS.map((option) => {
        const checked = form.liquorSizes.includes(option.value);
        const field = priceFields[option.value];
        return (
          <div key={option.value} className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-line-light px-3.5 py-2.5 last:border-b-0 ${checked ? "bg-panel/50" : ""}`}>
            <label className='flex min-w-0 items-center gap-3 text-sm font-medium text-ink'>
              <input
                type='checkbox'
                checked={checked}
                onChange={() => update("liquorSizes", checked ? form.liquorSizes.filter((item) => item !== option.value) : [...form.liquorSizes, option.value])}
                className='h-4 w-4 accent-accent'
              />
              {option.label}
            </label>
            <div className='relative'>
              <span className='pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center border-r border-line-light text-xs text-muted'>OMR</span>
              <TextInput
                type='number'
                min='0.01'
                step='0.001'
                required={checked}
                disabled={!checked}
                placeholder='Enter price'
                value={form[field]}
                onChange={(event) => update(field, event.target.value)}
                className='pl-12 disabled:bg-panel disabled:text-muted'
              />
            </div>
          </div>
        );
      })}
      </div>}
    </div>
  );
}

function MealForm({ existing, onClose, onSaved, liquorCategories = [], mealCategories = [], onCategoryAdded, onMealCategoryAdded, onCategoryDeleted }) {
  const [form, setForm] = useState(() => mealFormValues(existing));
  const [availableLiquorCategories, setAvailableLiquorCategories] = useState(() => [...new Set([...liquorCategories, mealFormValues(existing).liquorCategory].filter(Boolean))]);
  const [availableMealCategories, setAvailableMealCategories] = useState(() => [...new Set([...mealCategories, mealFormValues(existing).category].filter(Boolean))]);
  const [addingLiquorCategory, setAddingLiquorCategory] = useState(false);
  const [newLiquorCategory, setNewLiquorCategory] = useState("");
  const [newMealCategory, setNewMealCategory] = useState("");
  const [pendingCategoryDelete, setPendingCategoryDelete] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function confirmCategoryDelete() {
    if (!pendingCategoryDelete) return;
    const { name, category } = pendingCategoryDelete;
    const deleted = await onCategoryDeleted(name, category);
    if (deleted) {
      if (name === "meal") {
        setAvailableMealCategories((current) => current.filter((item) => item !== category));
        if (form.category === category) update("category", "");
      } else {
        setAvailableLiquorCategories((current) => current.filter((item) => item !== category));
        if (form.liquorCategory === category) update("liquorCategory", "");
      }
      setPendingCategoryDelete(null);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        mealType: form.mealType,
        category: form.category,
        pricePerDay: Number(form.pricePerDay),
        description: form.description,
        isLiquor: form.isLiquor,
        liquorBrand: form.isLiquor ? form.liquorBrand.trim() : null,
        liquorPriceQuarter: form.isLiquor && form.liquorSizes.includes("quarter")
          ? Number(form.liquorPriceQuarter)
          : null,
        liquorPriceHalf: form.isLiquor && form.liquorSizes.includes("half")
          ? Number(form.liquorPriceHalf)
          : null,
        liquorPriceFull: form.isLiquor && form.liquorSizes.includes("full")
          ? Number(form.liquorPriceFull)
          : null,
        liquorPricePerMl: form.isLiquor && form.liquorSizes.includes("per_ml")
          ? Number(form.liquorPricePerMl)
          : null,
        liquorSizes: form.isLiquor ? form.liquorSizes : [],
      };
      const { meal } = existing
        ? await api.patch(`/admin/meals/${existing.id}`, payload)
        : await api.post("/admin/meals", payload);
      onSaved(meal);
    } catch (err) {
      setError(err.message || "Unable to save meal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <div>
          <FieldLabel>Type *</FieldLabel>
          <Select
            required
            value={form.mealType}
            onChange={(event) => update("mealType", event.target.value)}
          >
            <option value='lunch'>Lunch</option>
            <option value='dinner'>Dinner</option>
          </Select>
        </div>
        <div>
          <FieldLabel>Name *</FieldLabel>
          <TextInput
            required
            minLength={2}
            maxLength={200}
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Category *</FieldLabel>
          <CategorySelect
            value={form.category}
            options={availableMealCategories}
            onChange={(event) => {
              if (event.target.value === "__add_category__") {
                update("category", "__add_category__");
                setNewMealCategory("");
                return;
              }
              update("category", event.target.value);
            }}
            onDelete={(category) => setPendingCategoryDelete({ name: "meal", category })}
          />
          {form.category === "__add_category__" && <div className='mt-2 flex items-center gap-2'>
            <TextInput autoFocus required placeholder='Enter new category' value={newMealCategory} onChange={(event) => setNewMealCategory(event.target.value)} />
            <Button type='button' variant='accent' onClick={() => {
              const nextCategory = newMealCategory.trim();
              if (!nextCategory) return;
              onMealCategoryAdded(nextCategory).then((savedCategory) => {
                if (!savedCategory) return;
                setAvailableMealCategories((current) => current.includes(savedCategory) ? current : [...current, savedCategory]);
                update("category", savedCategory);
              });
              setNewMealCategory("");
            }}>Add</Button>
          </div>}
        </div>
        <div>
          <FieldLabel>Price per person (OMR) *</FieldLabel>
          <TextInput
            type='number'
            min='0'
            step='0.001'
            required
            value={form.pricePerDay}
            onChange={(event) => update("pricePerDay", event.target.value)}
          />
        </div>
        <div className='sm:col-span-2'>
          <FieldLabel>Description</FieldLabel>
          <Textarea
            rows={3}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </div>
        <div className='sm:col-span-2'>
          <Checkbox
            checked={form.isLiquor}
            onChange={(value) => update("isLiquor", value)}
            label='Liquor'
          />
        </div>
        {form.isLiquor && (
          <>
            <div>
              <FieldLabel>Brand *</FieldLabel>
              <TextInput
                required
                maxLength={255}
                value={form.liquorBrand}
                onChange={(event) => update("liquorBrand", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Liquor category *</FieldLabel>
              <CategorySelect
                value={form.liquorCategory}
                options={availableLiquorCategories}
                onChange={(event) => {
                  if (event.target.value === "__add_category__") {
                    setAddingLiquorCategory(true);
                    setNewLiquorCategory("");
                    return;
                  }
                  update("liquorCategory", event.target.value);
                }}
                onDelete={(category) => setPendingCategoryDelete({ name: "liquor", category })}
              />
              {addingLiquorCategory && (
                <div className='mt-2 flex items-center gap-2'>
                  <TextInput
                    autoFocus
                    required
                    placeholder='Enter new category'
                    value={newLiquorCategory}
                    onChange={(event) => setNewLiquorCategory(event.target.value)}
                  />
                  <Button
                    type='button'
                    variant='accent'
                    onClick={async () => {
                      const nextCategory = newLiquorCategory.trim();
                      if (!nextCategory) return;
                      const savedCategory = await onCategoryAdded(nextCategory);
                      if (!savedCategory) return;
                      setAvailableLiquorCategories((current) => current.includes(savedCategory) ? current : [...current, savedCategory]);
                      update("liquorCategory", savedCategory);
                      setAddingLiquorCategory(false);
                      setNewLiquorCategory("");
                    }}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
            <LiquorPricingFields form={form} update={update} />
          </>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
      <div className='flex justify-end gap-2 border-t border-line-light pt-4'>
        <Button type='button' onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type='submit' variant='accent' disabled={submitting}>
          {submitting ? "Saving…" : existing ? "Save meal" : "Add meal"}
        </Button>
      </div>
      {pendingCategoryDelete && <Modal title='Delete category?' onClose={() => setPendingCategoryDelete(null)} footer={<><Button type='button' onClick={() => setPendingCategoryDelete(null)}>Cancel</Button><Button type='button' variant='danger' onClick={confirmCategoryDelete}>Delete</Button></>}>
        <p className='text-sm text-muted'>Delete <span className='font-semibold text-ink'>{pendingCategoryDelete.category}</span> from the {pendingCategoryDelete.name} categories?</p>
      </Modal>}
    </form>
  );
}

function MealsTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [mealType, setMealType] = useState("");
  const [category, setCategory] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [liquor, setLiquor] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [liquorCategories, setLiquorCategories] = useState([]);
  const [mealCategories, setMealCategories] = useState([]);

  function updateFilter(setFilter, value) {
    setFilter(value);
  }

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    addDateFilterParams(params, dateFilter);
    if (mealType) params.set("mealType", mealType);
    if (category) params.set("category", category);
    addPriceRangeParams(params, priceRange);
    if (liquor) params.set("isLiquor", liquor);

    setLoading(true);
    api
      .get(`/meals?${params.toString()}`)
      .then(({ meals }) => setItems(meals))
      .catch((err) => setError(err.message || "Unable to load meals"))
      .finally(() => setLoading(false));
  }, [search, dateFilter, mealType, category, priceRange, liquor]);

  const hasFilters = !!(search || mealType || category || priceRange || liquor);
  useEffect(() => {
    api.get("/admin/categories?name=liquor")
      .then(({ categories }) => setLiquorCategories((categories || []).map((category) => category.category)))
      .catch(() => {});
    api.get("/admin/categories?name=meal")
      .then(({ categories }) => setMealCategories((categories || []).map((category) => category.category)))
      .catch(() => {});
  }, []);

  async function addLiquorCategory(name) {
    try {
      const { category: saved } = await api.post("/admin/categories", { name: "liquor", category: name });
      setLiquorCategories((current) => current.includes(saved.category) ? current : [...current, saved.category]);
      return saved.category;
    } catch (err) {
      setError(err.message || "Unable to save liquor category");
      return null;
    }
  }

  async function addMealCategory(name) {
    try {
      const { category: saved } = await api.post("/admin/categories", { name: "meal", category: name });
      setMealCategories((current) => current.includes(saved.category) ? current : [...current, saved.category]);
      return saved.category;
    } catch (err) {
      setError(err.message || "Unable to save meal category");
      return null;
    }
  }

  async function deleteCategory(name, category) {
    try {
      await api.del(`/admin/categories?name=${encodeURIComponent(name)}&category=${encodeURIComponent(category)}`);
      setMealCategories((current) => current.filter((item) => item !== category));
      setLiquorCategories((current) => current.filter((item) => item !== category));
      return true;
    } catch (err) {
      setError(err.message || "Unable to delete category");
      return false;
    }
  }

  function handleSaved(saved) {
    setItems((current) =>
      editingMeal
        ? current.map((meal) => (meal.id === saved.id ? saved : meal))
        : [saved, ...current]
    );
    setFormOpen(false);
    setEditingMeal(null);
  }

  async function handleDelete() {
    await api.del(`/admin/meals/${pendingDelete.id}`);
    setItems((current) =>
      current.filter((meal) => meal.id !== pendingDelete.id)
    );
    setPendingDelete(null);
  }

  return (
    <div>
      <div className='mb-3'>
        <h3 className='text-sm font-semibold text-ink'>Meals</h3>
      </div>
      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <TextInput
          className='min-w-0 flex-1 px-3 py-2 text-xs xl:w-[150px] xl:flex-none'
          placeholder='Search meals…'
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <DateFilter value={dateFilter} onChange={(value) => updateFilter(setDateFilter, value)} />
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[130px]'
          aria-label='Filter meals by type'
          value={mealType}
          onChange={(event) => updateFilter(setMealType, event.target.value)}
        >
          <option value=''>All types</option>
          <option value='lunch'>Lunch</option>
          <option value='dinner'>Dinner</option>
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[140px]'
          aria-label='Filter meals by category'
          value={category}
          onChange={(event) => updateFilter(setCategory, event.target.value)}
        >
          <option value=''>All categories</option>
          {/* Saved meal categories (categories table, name = 'meal') — the
              same list the meal form's Category picker manages, so adding or
              deleting a category there updates this filter too. */}
          {mealCategories.map((value) => (
            <option key={value} value={value}>
              {formatCategoryLabel(value)}
            </option>
          ))}
          {/* Keep a just-deleted category selectable while it's the active filter. */}
          {category && !mealCategories.includes(category) && (
            <option value={category}>{formatCategoryLabel(category)}</option>
          )}
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[150px]'
          aria-label='Filter meals by price per day'
          value={priceRange}
          onChange={(event) => updateFilter(setPriceRange, event.target.value)}
        >
          <option value=''>All prices</option>
          <PriceRangeOptions />
        </Select>
        <Select
          className='w-full px-2.5 py-2 text-xs sm:w-[130px]'
          aria-label='Filter meals by liquor'
          value={liquor}
          onChange={(event) => updateFilter(setLiquor, event.target.value)}
        >
          <option value=''>All meals</option>
          <option value='true'>Liquor</option>
          <option value='false'>Non-liquor</option>
        </Select>
      </div>
      <ErrorText>{error}</ErrorText>
      {loading ? (
        <p className='text-xs text-muted'>Loading…</p>
      ) : items.length === 0 ? (
        <p className='text-xs text-muted'>
          {hasFilters ? "No meals match these filters." : "No meals yet."}
        </p>
      ) : (
        <Table
          columns={[
            "Name",
            "Type",
            "Category",
            "Price / Day",
            "Description",
            "Liquor",
            { label: "Actions", align: "right" },
          ]}
          rows={items}
          renderRow={(meal) => (
            <tr
              key={meal.id}
              className='border-b border-line-light last:border-0'
            >
              <td className='px-3 py-3 font-semibold text-ink'>{meal.name}</td>
              <td className='px-3 py-3 capitalize'>{meal.meal_type}</td>
              <td className='px-3 py-3'>
                {meal.category ? formatCategoryLabel(meal.category) : "—"}
              </td>
              <td className='px-3 py-3 whitespace-nowrap'>
                {formatCurrency(meal.price_per_day)}
              </td>
              <td className='max-w-xs px-3 py-3 text-muted'>
                <span className='line-clamp-2'>{meal.description || "—"}</span>
              </td>
              <td className='px-3 py-3'>
                {meal.is_liquor ? meal.liquor_brand || "Liquor" : "—"}
              </td>
              <td className='px-3 py-3'>
                <div className='flex justify-end gap-2'>
                  <Button
                    size='sm'
                    onClick={() => {
                      setEditingMeal(meal);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <button
                    type='button'
                    onClick={() => setPendingDelete(meal)}
                    aria-label={`Delete ${meal.name}`}
                    className='flex h-8 w-8 items-center justify-center rounded-md border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]'
                  >
                    <LuTrash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      )}
      <div className='mt-4 flex justify-end'>
        <Button
          variant='accent'
          onClick={() => {
            setEditingMeal(null);
            setFormOpen(true);
          }}
        >
          + Add New Meal
        </Button>
      </div>
      {formOpen && (
        <Modal
          title={editingMeal ? "Edit Meal" : "Add New Meal"}
          onClose={() => {
            setFormOpen(false);
            setEditingMeal(null);
          }}
        >
          <MealForm
            key={editingMeal?.id || "new-meal"}
            existing={editingMeal}
            liquorCategories={liquorCategories}
            mealCategories={mealCategories}
            onMealCategoryAdded={addMealCategory}
            onCategoryDeleted={deleteCategory}
            onCategoryAdded={addLiquorCategory}
            onClose={() => {
              setFormOpen(false);
              setEditingMeal(null);
            }}
            onSaved={handleSaved}
          />
        </Modal>
      )}
      {pendingDelete && (
        <ConfirmDeleteModal
          title='Delete meal?'
          message={
            <>
              Delete{" "}
              <span className='font-semibold'>"{pendingDelete.name}"</span>?
              This can't be undone.
            </>
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// Product Catalog "Visa" tab — a single flat rate (per person), not a list
// like Meals' lunch/dinner types: there's only ever the one row, edited in
// place the same "create it if nothing exists yet, otherwise patch it"
// pattern as MealForm above, just without a type to switch between. Used by
// the agent Custom FIT Builder's Visa add-on (agent/pages/PackageBuilder.jsx)
// — the agent only ever sees a checkbox + headcount, never this price
// (blind pricing, same as every other catalog rate in that builder).
function visaPriceString(visa) {
  return visa ? String(visa.pricePerPerson ?? visa.price_per_person ?? "") : "";
}

function VisaForm({ existing, onSaved }) {
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPrice(visaPriceString(existing));
    setError("");
  }, [existing]);

  const savedPrice = visaPriceString(existing);
  const isDirty = price !== savedPrice;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = price !== "" ? { pricePerPerson: Number(price) } : {};
      const { visa: saved } = existing
        ? await api.patch(`/admin/visas/${existing.id}`, payload)
        : await api.post("/admin/visas", payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message || "Unable to save visa price");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      label={existing ? "Edit visa price" : "Add visa price"}
      className='border-white'
    >
      <form
        onSubmit={handleSubmit}
        className='grid grid-cols-1 gap-3 sm:grid-cols-2'
      >
        <div>
          <FieldLabel>Visa price per person (OMR)</FieldLabel>
          <TextInput
            type='number'
            min='0'
            step='0.001'
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className='mt-2 flex items-center gap-3 sm:col-span-2'>
          <Button
            variant='accent'
            type='submit'
            disabled={submitting || !isDirty}
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
          {!submitting && !isDirty && savedPrice !== "" && (
            <span className='text-xs font-semibold text-[#227647]'>
              ✓ Saved
            </span>
          )}
        </div>
        <div className='sm:col-span-2'>
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </Card>
  );
}

function VisaTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get("/visas")
      .then(({ visas }) => setItems(visas || []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Only one entry is ever kept — VisaForm above edits it in place once it
  // exists, rather than adding another.
  const existing = items[0] || null;

  async function handleDelete() {
    await api.del(`/admin/visas/${existing.id}`);
    setItems([]);
  }

  return (
    <div>
      <p className='mb-4 text-xs text-muted'>
        One flat rate, per person — this is what's used when an agent adds a
        Visa to a Custom FIT package.
      </p>
      {loading ? (
        <p className='text-xs text-muted'>Loading…</p>
      ) : (
        <>
          <VisaForm
            existing={existing}
            onSaved={(saved) => setItems([saved])}
          />
          {existing && (
            <button
              onClick={handleDelete}
              className='mt-2 text-xs text-[#a5162d] hover:underline'
            >
              Delete visa price
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Product Catalog "Flights" tab — unlike Meals/Visa above (one row edited in
// place), any number of flights can be added; Onward/Return is a sub-tab
// exactly like Meals' Lunch/Dinner, but selects which of two lists to show
// and which `isFlightOnward` a new entry is saved with, rather than which
// one row to edit. Backed by a plain growable table (0063_flights_catalog.sql),
// same "add form + list with delete" shape as NameOnlyCatalogList, just with
// more than one field to fill in per entry.
const FLIGHT_DIRECTIONS = [
  { key: "onward", label: "Onward", isFlightOnward: true },
  { key: "return", label: "Return", isFlightOnward: false },
];

const EMPTY_FLIGHT_FORM = {
  name: "",
  source: "",
  destination: "",
  departureDate: "",
  departureTime: "",
  price: "",
};

// Today, as a "YYYY-MM-DD" string in the browser's local timezone — matches
// what <input type="date"> reads/writes, so it can be used directly as a
// `min` bound and in string comparisons without any Date-object timezone
// pitfalls. Same helper/convention as PackageBuilder.jsx's and
// MiceBuilder.jsx's todayDateString — that's the "shared calendar" rule this
// mirrors: a departure date can't be picked (via `min`) or submitted (the
// check in handleSubmit below) before today.
function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

// flights list row (snake_case, straight off the API) -> this form's
// camelCase field shape. departure_date/departure_time both come back as
// plain strings (see PackageBuilder.jsx's/MiceBuilder.jsx's own
// `.slice(0, 10)` prefill convention) — sliced down to what their
// `<input type="date">`/`<input type="time">` counterparts expect
// ("YYYY-MM-DD" and "HH:MM"; departure_time carries a trailing ":SS" from
// Postgres' TIME column that the time input doesn't want).
function flightToForm(flight) {
  return {
    name: flight.name || "",
    source: flight.source || "",
    destination: flight.destination || "",
    departureDate: flight.departure_date
      ? flight.departure_date.slice(0, 10)
      : "",
    departureTime: flight.departure_time
      ? flight.departure_time.slice(0, 5)
      : "",
    price: flight.price != null ? String(flight.price) : "",
  };
}

// Re-mounted (key={direction} in FlightsTab below) on every sub-tab switch —
// so a half-typed Onward flight never ends up submitted as a Return one (or
// vice versa) just because the admin switched tabs mid-entry — and again on
// every edit/cancel-edit so the field values below always reset to match
// whichever flight (or none) is currently being edited.
function FlightForm({
  isFlightOnward,
  directionLabel,
  editingFlight,
  onAdded,
  onSaved,
  onCancelEdit,
}) {
  const [form, setForm] = useState(() =>
    editingFlight ? flightToForm(editingFlight) : EMPTY_FLIGHT_FORM
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (
      !form.name.trim() ||
      !form.source.trim() ||
      !form.destination.trim() ||
      !form.departureDate ||
      !form.departureTime
    ) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.departureDate < todayDateString()) {
      setError("Departure date cannot be in the past.");
      return;
    }
    setSubmitting(true);
    try {
      // Optional, same as Tours/Transfers' own price fields — omitted
      // entirely (rather than sent as an empty string) when left blank, so
      // it can still be added/saved without a price and priced in later.
      const payload = { ...form, isFlightOnward };
      if (form.price !== "") {
        payload.price = Number(form.price);
      } else {
        delete payload.price;
      }
      if (editingFlight) {
        const { flight } = await api.patch(
          `/admin/flights/${editingFlight.id}`,
          payload
        );
        onSaved(flight);
      } else {
        const { flight } = await api.post("/admin/flights", payload);
        onAdded(flight);
        setForm(EMPTY_FLIGHT_FORM);
      }
    } catch (err) {
      setError(
        err.message || `Unable to ${editingFlight ? "save" : "add"} flight`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      label={
        editingFlight
          ? `Edit ${directionLabel.toLowerCase()} flight`
          : `Add ${directionLabel.toLowerCase()} flight`
      }
      className='mb-4 border-white'
    >
      <form
        onSubmit={handleSubmit}
        className='grid grid-cols-1 gap-3 sm:grid-cols-6'
      >
        <div>
          <FieldLabel>Flight name</FieldLabel>
          <TextInput
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Source</FieldLabel>
          <TextInput
            value={form.source}
            onChange={(e) => update("source", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Destination</FieldLabel>
          <TextInput
            value={form.destination}
            onChange={(e) => update("destination", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Departure date</FieldLabel>
          <TextInput
            type='date'
            min={todayDateString()}
            value={form.departureDate}
            onChange={(e) => update("departureDate", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Departure time</FieldLabel>
          <TextInput
            type='time'
            value={form.departureTime}
            onChange={(e) => update("departureTime", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Price (OMR)</FieldLabel>
          <TextInput
            type='number'
            min='0'
            step='0.001'
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
          />
        </div>
        <div className='flex items-center gap-3 sm:col-span-6'>
          <Button variant='accent' type='submit' disabled={submitting}>
            {submitting
              ? "Saving…"
              : editingFlight
              ? "Save changes"
              : `+ Add ${directionLabel.toLowerCase()} flight`}
          </Button>
          {editingFlight && (
            <button
              type='button'
              onClick={onCancelEdit}
              className='text-xs font-semibold text-[#666] hover:underline'
            >
              Cancel
            </button>
          )}
        </div>
        <div className='sm:col-span-6'>
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </Card>
  );
}

function FlightsTab() {
  const [direction, setDirection] = useState("onward");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // The flight row currently being edited (or null for the plain "add"
  // form above) — cleared on every direction switch below, same as the
  // half-typed-entry guard that already reset the add form on tab switch.
  const [editingFlight, setEditingFlight] = useState(null);
  const active = FLIGHT_DIRECTIONS.find((d) => d.key === direction);

  function load() {
    setLoading(true);
    api
      .get(`/flights?isFlightOnward=${active.isFlightOnward}`)
      .then(({ flights }) => setItems(flights))
      .finally(() => setLoading(false));
  }

  useEffect(load, [direction]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDirectionChange(key) {
    setDirection(key);
    setEditingFlight(null);
  }

  async function handleDelete(id) {
    await api.del(`/admin/flights/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
    if (editingFlight?.id === id) setEditingFlight(null);
  }

  function handleSaved(saved) {
    setItems((list) => list.map((i) => (i.id === saved.id ? saved : i)));
    setEditingFlight(null);
  }

  return (
    <div>
      <div className='mb-4 flex flex-wrap gap-2'>
        {FLIGHT_DIRECTIONS.map((d) => (
          <button
            key={d.key}
            onClick={() => handleDirectionChange(d.key)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold ${
              direction === d.key
                ? "border-ink bg-ink text-white"
                : "border-line-light bg-white text-[#666]"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <FlightForm
        key={`${direction}:${editingFlight?.id || "new"}`}
        isFlightOnward={active.isFlightOnward}
        directionLabel={active.label}
        editingFlight={editingFlight}
        onAdded={(flight) => setItems((list) => [flight, ...list])}
        onSaved={handleSaved}
        onCancelEdit={() => setEditingFlight(null)}
      />

      {loading ? (
        <p className='text-xs text-muted'>Loading…</p>
      ) : items.length === 0 ? (
        <p className='text-xs text-muted'>
          No {active.label.toLowerCase()} flights added yet.
        </p>
      ) : (
        <Table
          columns={[
            "Flight",
            "Source",
            "Destination",
            "Departure date",
            "Departure time",
            "Price",
            "",
          ]}
          rows={items}
          renderRow={(flight) => (
            <tr
              key={flight.id}
              className='border-b border-line-light last:border-0'
            >
              <td className='px-3 py-2 font-semibold'>{flight.name}</td>
              <td className='px-3 py-2'>{flight.source}</td>
              <td className='px-3 py-2'>{flight.destination}</td>
              <td className='px-3 py-2'>
                {new Date(flight.departure_date).toLocaleDateString()}
              </td>
              <td className='px-3 py-2'>
                {formatTime(flight.departure_time) || "—"}
              </td>
              <td className='px-3 py-2'>
                {flight.price != null ? formatCurrency(flight.price) : "—"}
              </td>
              <td className='px-3 py-2 text-right'>
                <button
                  onClick={() => setEditingFlight(flight)}
                  className='mr-3 text-xs text-[#4F46E5] hover:underline'
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(flight.id)}
                  className='text-xs text-[#a5162d] hover:underline'
                >
                  Delete
                </button>
              </td>
            </tr>
          )}
        />
      )}
    </div>
  );
}

// Product Catalog "Inclusions & Exclusions" tab, next to Meals — reusable,
// name-only phrases the admin curates once (e.g. "Daily breakfast",
// "International flights") for reference when typing a quotation's
// client-facing Inclusions/Exclusions text in the Quote Inbox's Costing
// panel (agent/pages/QuoteDetail.jsx shows the final text there, read-only).
// Unlike Meals, there's no "one entry per type" limit — this is a plain
// growable list: add a name, remove it, nothing else to edit — so one
// component is reused for both Inclusions and Exclusions rather than two
// near-identical tabs.
const INCLUSION_EXCLUSION_TYPES = [
  { entityPath: "inclusions", label: "Inclusion" },
  { entityPath: "exclusions", label: "Exclusion" },
];

function NameOnlyCatalogList({ entityPath, label }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/${entityPath}`)
      .then((data) => setItems(data[entityPath] || []))
      .finally(() => setLoading(false));
  }, [entityPath]);

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError("");
    setSubmitting(true);
    try {
      // Singular response key, same convention as every other catalog
      // entity (e.g. POST /admin/meals -> { meal }) — catalogHandlersFor
      // derives it as entityPath.slice(0, -1).
      const data = await api.post(`/admin/${entityPath}`, { name: trimmed });
      setItems((list) => [data[entityPath.slice(0, -1)], ...list]);
      setName("");
    } catch (err) {
      setError(err.message || `Unable to add this ${label.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id) {
    await api.del(`/admin/${entityPath}/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <form
        onSubmit={handleAdd}
        className='mb-4 flex flex-wrap items-end gap-3'
      >
        <div className='max-w-xs flex-1'>
          <FieldLabel>{label} name</FieldLabel>
          <TextInput
            placeholder={
              label === "Inclusion"
                ? "e.g. Daily breakfast"
                : "e.g. International flights"
            }
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button
          variant='accent'
          type='submit'
          disabled={submitting || !name.trim()}
        >
          {submitting ? "Adding…" : `+ Add ${label.toLowerCase()}`}
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
      {loading ? (
        <p className='text-xs text-muted'>Loading…</p>
      ) : items.length === 0 ? (
        <p className='text-xs text-muted'>
          No {label.toLowerCase()}s added yet.
        </p>
      ) : (
        <ul className='divide-y divide-line-light rounded-lg border border-line-light bg-white'>
          {items.map((item) => (
            <li
              key={item.id}
              className='flex items-center justify-between px-4 py-2.5 text-sm'
            >
              <span>{item.name}</span>
              <button
                onClick={() => handleRemove(item.id)}
                className='text-xs text-[#a5162d] hover:underline'
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InclusionsExclusionsTab() {
  const [entityPath, setEntityPath] = useState("inclusions");
  const active = INCLUSION_EXCLUSION_TYPES.find(
    (t) => t.entityPath === entityPath
  );

  return (
    <div>
      <div className='mb-4 flex flex-wrap gap-2'>
        {INCLUSION_EXCLUSION_TYPES.map((t) => (
          <button
            key={t.entityPath}
            onClick={() => setEntityPath(t.entityPath)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold ${
              entityPath === t.entityPath
                ? "border-ink bg-ink text-white"
                : "border-line-light bg-white text-[#666]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* key= forces a clean remount on switch — each list's own loading/
          error/draft-name state should never carry over from the other. */}
      <NameOnlyCatalogList
        key={entityPath}
        entityPath={entityPath}
        label={active.label}
      />
    </div>
  );
}

// Package counts for the header's summary cards — real totals from the same
// paginated list endpoint FdPackagesTab uses (its pagination.total with a
// status filter applied), one tiny request per card. `refreshKey` bumps
// whenever the FD tab deletes a package so the counts follow along.
const SUMMARY_CARDS = [
  { key: "", label: "Total Packages", Icon: LuPackage, tone: "bg-[#EEF2FF] text-[#4F46E5]" },
  { key: "published", label: "Published", Icon: LuCircleCheck, tone: "bg-emerald-50 text-emerald-600" },
  { key: "draft", label: "Drafts", Icon: LuFilePen, tone: "bg-slate-100 text-slate-600" },
  { key: "closed", label: "Closed", Icon: LuLock, tone: "bg-rose-50 text-rose-600" },
];

function usePackageCounts(refreshKey) {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all(
      SUMMARY_CARDS.map(({ key }) => {
        const params = new URLSearchParams({ page: "1", pageSize: "1" });
        if (key) params.set("status", key);
        return api
          .get(`/admin/fd-packages?${params.toString()}`)
          .then(({ pagination }) => pagination?.total ?? null)
          .catch(() => null);
      })
    ).then((totals) => {
      if (!active) return;
      setCounts(
        Object.fromEntries(SUMMARY_CARDS.map(({ key }, i) => [key, totals[i]]))
      );
    });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return counts;
}

function SummaryCards({ counts }) {
  return (
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-auto xl:min-w-[640px]'>
      {SUMMARY_CARDS.map(({ key, label, Icon, tone }) => (
        <div
          key={label}
          className='flex items-center gap-3 rounded-xl border border-[#E4E9FB] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
        >
          <span
            className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${tone}`}
          >
            <Icon size={18} />
          </span>
          <div className='min-w-0'>
            <div className='truncate text-[11px] font-medium text-muted'>
              {label}
            </div>
            <div className='text-xl font-bold leading-tight text-ink'>
              {counts == null ? (
                <span className='inline-block h-5 w-8 animate-pulse rounded bg-slate-100' />
              ) : (
                counts[key] ?? "—"
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProductCatalog() {
  const [tab, setTab] = useState("fdPackages");
  const [countsKey, setCountsKey] = useState(0);
  const counts = usePackageCounts(countsKey);

  return (
    <div className='min-h-screen bg-[#F4F7FF]'>
      {/* Full width of the workspace next to the sidebar — no max-w/mx-auto
          cap, just consistent gutters. AdminLayout's content column is
          already `min-w-0 flex-1`, so this tracks the sidebar's collapsed/
          expanded width on its own without any hardcoded offset. */}
      <div className='w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8 2xl:px-10'>
        <div className='mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between'>
          <div>
            <h2 className='text-3xl font-bold tracking-tight text-ink'>
              Product Catalogue
            </h2>
            <p className='mt-1.5 text-sm text-muted'>
              Manage packages, stays, sightseeing, transport and add-ons offered
              to agents.
            </p>
          </div>
          <SummaryCards counts={counts} />
        </div>

        {/* One compact segmented bar for every category — scrolls sideways
            on narrow screens instead of wrapping into ragged rows. */}
        <div
          role='tablist'
          aria-label='Catalogue categories'
          className='mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[#E4E9FB] bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] [scrollbar-width:thin]'
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type='button'
                role='tab'
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`flex flex-none items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/40 ${
                  active
                    ? "bg-[#4F46E5] text-white shadow-sm shadow-[#4F46E5]/25"
                    : "text-[#475569] hover:bg-[#F3F4FF] hover:text-[#4F46E5]"
                }`}
              >
                <Icon size={16} className='flex-none' />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "fdPackages" ? (
          <FdPackagesTab onChanged={() => setCountsKey((k) => k + 1)} />
        ) : tab === "hotels" ? (
          <HotelsTab />
        ) : tab === "tours" ? (
          <ToursTab />
        ) : tab === "vehicles" ? (
          <VehiclesTab />
        ) : tab === "activities" ? (
          <ActivitiesTab />
        ) : tab === "transfers" ? (
          <TransfersTab />
        ) : tab === "meals" ? (
          <MealsTab />
        ) : tab === "visa" ? (
          <VisaTab />
        ) : tab === "flights" ? (
          <FlightsTab />
        ) : (
          <InclusionsExclusionsTab />
        )}
      </div>
    </div>
  );
}
