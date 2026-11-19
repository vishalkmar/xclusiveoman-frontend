import {
  LuBadgeCheck,
  LuCircleX,
  LuClock3,
  LuFileStack,
  LuLandmark,
  LuLoader,
} from 'react-icons/lu';

// Admin visa processing — request statuses (visa_applications.status, see
// 0128_visa_processing.sql) and per-traveller visa statuses, shared by Visa
// Status, Visa Requests and the request detail page.

export const REQUEST_STATUS = {
  payment_review: {
    label: 'Payment in review',
    short: 'Payment review',
    tone: 'grey',
    className: '!border-[#E2E8F0] !bg-[#F8FAFC] !text-[#475569]',
    detail: 'NEFT slip being verified',
  },
  submitted: {
    label: 'New request',
    short: 'New',
    tone: 'amber',
    className: '!border-[#C7D2FE] !bg-[#EEF0FF] !text-[#4338CA]',
    detail: 'Paid — not started yet',
  },
  processing: {
    label: 'In process',
    short: 'In process',
    tone: 'amber',
    detail: 'Visas being prepared',
  },
  approved: {
    label: 'Visas issued',
    short: 'Issued',
    tone: 'green',
    detail: 'Every traveller decided',
  },
  rejected: {
    label: 'Refused',
    short: 'Refused',
    tone: 'red',
    detail: 'Request refused',
  },
  cancelled: { label: 'Cancelled', short: 'Cancelled', tone: 'grey', detail: '' },
};

export const requestStatus = (status) =>
  REQUEST_STATUS[status] || { label: String(status || '').replace(/_/g, ' '), short: status, tone: 'grey' };

// Status cards on Visa Status (value '' = everything).
export const STATUS_CARDS = [
  { value: '', label: 'All requests', detail: 'Every applied visa request', icon: LuFileStack, tone: 'blue' },
  { value: 'submitted', label: 'New requests', detail: 'Paid — not started yet', icon: LuClock3, tone: 'violet' },
  { value: 'processing', label: 'In process', detail: 'Visas being prepared', icon: LuLoader, tone: 'amber' },
  { value: 'approved', label: 'Visas issued', detail: 'Ready for the agent', icon: LuBadgeCheck, tone: 'green' },
  { value: 'payment_review', label: 'Payment review', detail: 'NEFT slip being verified', icon: LuLandmark, tone: 'grey' },
  { value: 'rejected', label: 'Refused', detail: 'Requests refused', icon: LuCircleX, tone: 'red' },
];

export const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'New' },
  { value: 'processing', label: 'In process' },
  { value: 'approved', label: 'Issued' },
  { value: 'payment_review', label: 'Payment review' },
  { value: 'rejected', label: 'Refused' },
];

export const DAY_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: '1', label: 'Today / last 24 h' },
  { value: '7', label: 'Last 7 days' },
  { value: '15', label: 'Last 15 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export const TRAVELLER_VISA = {
  pending: { label: 'Awaiting visa', tone: 'amber' },
  issued: { label: 'Visa issued', tone: 'green' },
  rejected: { label: 'Refused', tone: 'red' },
};

// Tracking timeline wording per visa_application_events.event.
export const EVENT_META = {
  submitted: { label: 'Request submitted & paid', tone: 'indigo' },
  processing_started: { label: 'Processing started', tone: 'amber' },
  visa_issued: { label: 'Visa uploaded', tone: 'green' },
  visa_replaced: { label: 'Visa replaced', tone: 'green' },
  visa_removed: { label: 'Visa removed', tone: 'grey' },
  rejection_undone: { label: 'Refusal undone', tone: 'grey' },
  traveller_rejected: { label: 'Traveller refused', tone: 'red' },
  pending_rejected: { label: 'Remaining travellers refused', tone: 'red' },
  application_approved: { label: 'Request completed', tone: 'green' },
  application_rejected: { label: 'Request refused', tone: 'red' },
  application_reopened: { label: 'Request re-opened', tone: 'amber' },
};

export const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

// "3 days ago" / "Today" — how long a request has been waiting.
export function ageLabel(value) {
  if (!value) return '';
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
