// Shared lookups for the agent Bookings ledger — booking types, how each
// booking status is labelled/coloured, and which overview group it counts
// towards. Everything here is derived from fields GET /bookings already
// returns (sourceType, status, totalPrice, balanceDue, pax, createdAt).
import { LuBriefcase, LuPlaneTakeoff, LuUsers } from 'react-icons/lu';
import { humanize } from '../ledger/ledgerUtils.js';

export const BOOKING_TYPES = [
  { key: 'fd_package', label: 'Fixed Departure', plural: 'Fixed Departures', icon: LuPlaneTakeoff },
  { key: 'package_request', label: 'Custom FIT', plural: 'Custom FIT', icon: LuBriefcase },
  { key: 'mice_rfq', label: 'MICE', plural: 'MICE', icon: LuUsers },
];
const TYPE_BY_KEY = Object.fromEntries(BOOKING_TYPES.map((t) => [t.key, t]));

export function bookingType(sourceType) {
  return TYPE_BY_KEY[sourceType] || { key: sourceType, label: humanize(sourceType), icon: LuBriefcase };
}

// Statuses where money is still owed and the agent can re-open the payment
// page to pay it off (deposit not yet made, or a part-payment left over).
export const PAYABLE_STATUSES = new Set(['pending_payment', 'balance_due']);

// tone → badge colours (ledger/StatusBadge); group → overview bucket.
const STATUS_META = {
  pending_payment: { label: 'Pending payment', tone: 'pending', group: 'awaiting' },
  balance_due: { label: 'Balance due', tone: 'pending', group: 'awaiting' },
  deposit_paid: { label: 'Deposit paid', tone: 'info', group: 'progress' },
  confirmed: { label: 'Confirmed', tone: 'success', group: 'settled' },
  fully_paid: { label: 'Fully paid', tone: 'success', group: 'settled' },
  completed: { label: 'Completed', tone: 'neutral', group: 'settled' },
  amendment_requested: { label: 'Amendment requested', tone: 'pending', group: 'progress' },
  cancellation_requested: { label: 'Cancel requested', tone: 'danger', group: 'progress' },
  cancelled: { label: 'Cancelled', tone: 'danger', group: 'cancelled' },
  waitlisted: { label: 'Waitlisted', tone: 'info', group: 'progress' },
};

export function bookingStatus(status) {
  return STATUS_META[status] || { label: humanize(status), tone: 'neutral', group: 'progress' };
}

// Overview / filter buckets, in display order. `amount` says which figure the
// overview sums for the bucket: what's still owed, or the booking value.
export const STATUS_GROUPS = [
  { key: 'awaiting', label: 'Awaiting payment', amount: 'balanceDue', bar: 'bg-bk-pending' },
  { key: 'settled', label: 'Settled', amount: 'totalPrice', bar: 'bg-bk-success' },
  { key: 'progress', label: 'In progress', amount: 'totalPrice', bar: 'bg-[#8A94A6]' },
  { key: 'cancelled', label: 'Cancelled', amount: 'totalPrice', bar: 'bg-bk-danger' },
];
