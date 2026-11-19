// Support Center — labels, colours and formatters shared by the
// Conversations view and the Chat Logs & Analytics dashboard. Values mirror
// the backend's support_tickets ENUMs (migration 0104).

// Slice colours were run through the dataviz palette validator in this
// adjacency order (violet, sky, magenta, amber, green — CVD-separable) with
// a neutral gray for Closed; pills use the same hue family so a status reads
// the same in the table and in the donut.
export const STATUS_META = {
  new: { label: 'New', color: '#7C3AED', pill: 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]' },
  open: { label: 'Open', color: '#0284C7', pill: 'bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]' },
  waiting_admin: { label: 'Awaiting Admin', color: '#DB2777', pill: 'bg-[#FDF2F8] text-[#BE185D] border-[#FBCFE8]' },
  waiting_user: { label: 'Awaiting User', color: '#D97706', pill: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' },
  resolved: { label: 'Resolved', color: '#059669', pill: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' },
  closed: { label: 'Closed', color: '#94A3B8', pill: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]' },
};

export const STATUS_COLOR_MAP = Object.fromEntries(Object.entries(STATUS_META).map(([key, m]) => [key, m.color]));

export const PRIORITY_META = {
  low: { label: 'Low', dot: '#94A3B8' },
  medium: { label: 'Medium', dot: '#3B82F6' },
  high: { label: 'High', dot: '#F59E0B' },
  urgent: { label: 'Urgent', dot: '#EF4444' },
};

export const CATEGORY_META = {
  booking: { label: 'Booking', color: '#4F46E5' },
  payment: { label: 'Payment', color: '#2563EB' },
  cancellation: { label: 'Cancellation', color: '#DB2777' },
  account: { label: 'Account', color: '#7C3AED' },
  technical: { label: 'Technical', color: '#0891B2' },
  general: { label: 'General', color: '#059669' },
  other: { label: 'Other', color: '#64748B' },
};

export const CLOSED_STATUSES = new Set(['resolved', 'closed']);

const options = (meta) => Object.entries(meta).map(([value, m]) => ({ value, label: m.label }));
export const STATUS_OPTIONS = options(STATUS_META);
export const PRIORITY_OPTIONS = options(PRIORITY_META);
export const CATEGORY_OPTIONS = options(CATEGORY_META);

export const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
];

export const RESPONSE_TIME_OPTIONS = [
  { value: 'lt5', label: '< 5 min' },
  { value: '5to15', label: '5–15 min' },
  { value: '15to30', label: '15–30 min' },
  { value: '30to60', label: '30–60 min' },
  { value: 'gt60', label: '> 1 hour' },
];

export const DEFAULT_FILTERS = {
  range: '30d',
  from: '',
  to: '',
  status: '',
  search: '',
  agent: '',
  priority: '',
  category: '',
  responseStatus: '',
  repeat: '',
  responseTime: '',
};

export const statusLabel = (status) => STATUS_META[status]?.label || status;

// Query string for every analytics endpoint — the browser's own timezone
// goes along so "today"/"this week" match the admin's calendar.
export function buildAnalyticsQuery(filters, extra = {}) {
  const params = new URLSearchParams({ tz: String(new Date().getTimezoneOffset()) });
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value === '' || value == null) continue;
    if ((key === 'from' || key === 'to') && filters.range !== 'custom') continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export function countActiveFilters(filters) {
  return Object.entries(filters).filter(([key, value]) => value && key !== 'from' && key !== 'to' && !(key === 'range' && value === DEFAULT_FILTERS.range)).length;
}

export function formatMinutes(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.round((minutes % 1440) / 60);
  return h ? `${d}d ${h}h` : `${d}d`;
}

export function shortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}

export function dateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(value) {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return dayLabel(value);
}

export function dayLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return shortDate(value);
}

export const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

// Short, human-quotable reference for a UUID conversation id (matches the
// backend's `ref` field).
export const conversationRef = (id) => `#${String(id || '').replace(/-/g, '').slice(0, 6).toUpperCase()}`;

export function messagePreview(message, attachmentType) {
  if (message) return message;
  if (attachmentType === 'audio') return 'Voice message';
  if (attachmentType) return 'Photo';
  return '';
}
