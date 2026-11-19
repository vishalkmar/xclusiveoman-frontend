// Lookups for the agent Payment & Transaction History — how each payment
// method and status is labelled/coloured, and which tab / overview group it
// counts towards. Rows from GET /agencies/me/transactions are booking
// payments (kind 'booking') or visa fee payments (kind 'visa').
import { LuCreditCard, LuLandmark, LuReceipt, LuWallet } from 'react-icons/lu';
import { humanize } from '../ledger/ledgerUtils.js';

// Tabs. Card payments go through Cashfree, so both method values land on
// the same "Card / online" tab (same as the Payment page's card option).
export const METHOD_TABS = [
  { key: 'online', label: 'Card / online' },
  { key: 'neft', label: 'NEFT' },
  { key: 'credit_terms', label: 'Credit terms' },
];

const METHOD_META = {
  cashfree: { label: 'Card / online', tab: 'online', icon: LuCreditCard },
  card: { label: 'Card', tab: 'online', icon: LuCreditCard },
  neft: { label: 'NEFT transfer', tab: 'neft', icon: LuLandmark },
  credit_terms: { label: 'Credit terms', tab: 'credit_terms', icon: LuReceipt },
};

export function paymentMethod(method) {
  return METHOD_META[method] || { label: humanize(method), tab: 'other', icon: LuWallet };
}

// 'confirmed' kept for historical transactions written before
// paymentConfirmation.service.js started writing balance_due/fully_paid
// instead (whether that payment left a balance or settled the booking) —
// all three are money received.
const STATUS_META = {
  confirmed: { label: 'Confirmed', tone: 'success', group: 'received' },
  fully_paid: { label: 'Fully paid', tone: 'success', group: 'received' },
  balance_due: { label: 'Paid · balance due', tone: 'info', group: 'received' },
  pending: { label: 'Pending', tone: 'pending', group: 'pending' },
  failed: { label: 'Failed', tone: 'danger', group: 'failed' },
  // Visa fee payments: an NEFT slip waiting for finance, or a rejected slip.
  pending_verification: { label: 'NEFT in verification', tone: 'pending', group: 'pending' },
  rejected: { label: 'Rejected', tone: 'danger', group: 'failed' },
};

export function transactionStatus(status) {
  return STATUS_META[status] || { label: humanize(status), tone: 'neutral', group: 'pending' };
}

export const TRANSACTION_GROUPS = [
  { key: 'received', label: 'Received', bar: 'bg-bk-success' },
  { key: 'pending', label: 'Pending', bar: 'bg-bk-pending' },
  { key: 'failed', label: 'Failed', bar: 'bg-bk-danger' },
];

// What a payment was for — a booking or a visa application's fee.
export const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'booking', label: 'Bookings' },
  { key: 'visa', label: 'Visa fees' },
];

export const isVisa = (t) => t.kind === 'visa';
