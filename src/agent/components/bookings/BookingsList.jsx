import { Link } from 'react-router-dom';
import { LuArrowUpRight, LuCheck, LuCreditCard, LuFileText } from 'react-icons/lu';
import { Amount } from '../ledger/Amount.jsx';
import { formatLedgerDate, shortId } from '../ledger/ledgerUtils.js';
import { BookingStatusBadge } from './BookingStatusBadge.jsx';
import { PAYABLE_STATUSES, bookingStatus, bookingType } from './bookingMeta.js';

const ICON = { strokeWidth: 1.75, 'aria-hidden': true };

// Payment (only while money is owed) as the one filled action, documents as a
// quiet outline beside it. Documents (Task 14) only exist for FD bookings
// today — see documents.model.js's own FD-only scoping.
// In the table (`compact`), Documents drops to an icon button beside a
// payment action so only one labelled button competes for attention.
function BookingActions({ booking, stretch = false, compact = false }) {
  const payable = PAYABLE_STATUSES.has(booking.status);
  const hasDocs = booking.sourceType === 'fd_package';
  if (!payable && !hasDocs) return <span className="block text-right text-[12px] text-bk-muted">—</span>;
  const iconOnlyDocs = compact && payable;
  const size = `h-8 gap-1.5 rounded-lg text-[12.5px] font-semibold ${stretch ? 'flex-1' : ''}`;
  return (
    <div className={`flex items-center gap-2 ${stretch ? '' : 'justify-end'}`}>
      {payable && (
        <Link
          to={`/agent/payments/${booking.id}`}
          className={`inline-flex items-center justify-center whitespace-nowrap bg-bk-accent-strong px-3 text-white shadow-sm transition-colors hover:bg-bk-accent-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-bk-accent/40 ${size}`}
        >
          <LuCreditCard {...ICON} className="h-3.5 w-3.5" />
          Complete payment
        </Link>
      )}
      {hasDocs && (
        <Link
          to={`/agent/bookings/${booking.id}`}
          title="Documents"
          aria-label={iconOnlyDocs ? 'Documents' : undefined}
          className={`inline-flex items-center justify-center whitespace-nowrap border border-bk-line bg-white text-bk-ink transition-colors hover:border-bk-ink/30 hover:bg-bk-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-bk-accent/40 ${size} ${
            iconOnlyDocs ? 'w-8 flex-none' : 'px-3'
          }`}
        >
          <LuFileText {...ICON} className="h-3.5 w-3.5 text-bk-muted" />
          {!iconOnlyDocs && 'Documents'}
        </Link>
      )}
      {/* Keeps payment buttons aligned on rows without documents. */}
      {compact && payable && !hasDocs && <span aria-hidden className="w-8 flex-none" />}
    </div>
  );
}

// Payable statuses stay a shortcut to the payment page, as before.
function StatusCell({ booking }) {
  if (!PAYABLE_STATUSES.has(booking.status)) return <BookingStatusBadge status={booking.status} />;
  return (
    <Link
      to={`/agent/payments/${booking.id}`}
      title="Click to complete the remaining payment"
      className="group inline-flex items-center gap-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-bk-accent/40"
    >
      <BookingStatusBadge status={booking.status} />
      <LuArrowUpRight {...ICON} className="h-3.5 w-3.5 text-bk-pending opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function BalanceAmount({ booking, align }) {
  const cancelled = bookingStatus(booking.status).group === 'cancelled';
  const settled = !cancelled && booking.balanceDue != null && Number(booking.balanceDue) <= 0;
  return (
    <Amount
      value={booking.balanceDue}
      align={align}
      muted={cancelled || settled}
      note={
        settled ? (
          <span className={`inline-flex items-center gap-1 font-semibold text-bk-success-ink ${align === 'right' ? 'justify-end' : ''}`}>
            <LuCheck {...ICON} strokeWidth={2.25} className="h-3 w-3" /> Settled
          </span>
        ) : null
      }
    />
  );
}

function TypeLabel({ booking }) {
  const { label, icon: Icon } = bookingType(booking.sourceType);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13.5px] font-semibold text-bk-ink">
      <Icon {...ICON} className="h-4 w-4 text-bk-accent" />
      {label}
    </span>
  );
}

const pax = (b) => (b.pax != null ? `${b.pax} pax` : '— pax');
const Dot = () => <span aria-hidden className="h-0.5 w-0.5 flex-none rounded-full bg-bk-muted" />;

export function BookingsList({ bookings }) {
  return (
    <>
      {/* xl and up (the content area beside the 288px sidebar is wide
          enough): fixed columns so amounts and actions line up row to row.
          overflow-x-auto is only a safety net for unusually narrow windows. */}
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[900px] table-fixed text-left">
          <colgroup>
            <col />
            <col className="w-[148px]" />
            <col className="w-[148px]" />
            <col className="w-[176px]" />
            <col className="w-[228px]" />
          </colgroup>
          <thead>
            <tr className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-bk-muted">
              <th scope="col" className="px-5 pb-3 pt-4 font-semibold">Booking · Created</th>
              <th scope="col" className="px-3 pb-3 pt-4 text-right font-semibold">Total</th>
              <th scope="col" className="px-3 pb-3 pt-4 text-right font-semibold">Balance due</th>
              <th scope="col" className="pb-3 pl-8 pr-3 pt-4 font-semibold">Status</th>
              <th scope="col" className="px-5 pb-3 pt-4 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const cancelled = bookingStatus(b.status).group === 'cancelled';
              const payable = PAYABLE_STATUSES.has(b.status);
              return (
                <tr key={b.id} className="group border-t border-bk-line-soft transition-colors hover:bg-bk-hover">
                  <td className="relative px-5 py-4 align-middle">
                    {payable && <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r bg-bk-pending" />}
                    <TypeLabel booking={b} />
                    <span className="mt-1 flex items-center gap-2 whitespace-nowrap text-[12px] text-bk-muted">
                      <span className="font-mono tracking-tight" title={b.id}>#{shortId(b.id)}</span>
                      <Dot />
                      <span>{pax(b)}</span>
                      <Dot />
                      <span className="tabular-nums" title="Created">{formatLedgerDate(b.createdAt)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <Amount value={b.totalPrice} align="right" muted={cancelled} />
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <BalanceAmount booking={b} align="right" />
                  </td>
                  <td className="py-4 pl-8 pr-3 align-middle">
                    <StatusCell booking={b} />
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <BookingActions booking={b} compact />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Below xl: one structured card per booking (two across on tablets)
          instead of squeezing the table. */}
      <ul className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 xl:hidden">
        {bookings.map((b) => {
          const cancelled = bookingStatus(b.status).group === 'cancelled';
          const payable = PAYABLE_STATUSES.has(b.status);
          return (
            <li
              key={b.id}
              className={`flex flex-col rounded-xl border bg-white p-4 ${payable ? 'border-bk-pending/40' : 'border-bk-line'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <TypeLabel booking={b} />
                  <p className="mt-1 text-[12px] text-bk-muted">
                    <span className="font-mono">#{shortId(b.id)}</span> · {formatLedgerDate(b.createdAt)} · {pax(b)}
                  </p>
                </div>
                <StatusCell booking={b} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-bk-hover px-3.5 py-3">
                <div className="min-w-0">
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-bk-muted">Total</dt>
                  <dd className="mt-1">
                    <Amount value={b.totalPrice} muted={cancelled} />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-bk-muted">Balance due</dt>
                  <dd className="mt-1">
                    <BalanceAmount booking={b} />
                  </dd>
                </div>
              </dl>
              {(payable || b.sourceType === 'fd_package') && (
                <div className="mt-auto pt-3">
                  <BookingActions booking={b} stretch />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
