import { formatCompactCurrency, formatCompactNumber } from '../../../shared/currency.js';
// Shared by the admin Quote Inbox (Custom FIT) and MICE Requests pages —
// submission-date presets, the query string both list + stats endpoints take,
// and formatters for the insights panel.

export const SUBMISSION_DATE_OPTIONS = [
  { value: '', label: 'All submission dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_6_months', label: 'Last 6 months' },
  { value: 'last_year', label: 'Last year' },
  { value: 'custom', label: 'Custom date range' },
];

// Local calendar dates (YYYY-MM-DD) — toISOString() would shift a late-evening
// "today" into tomorrow for anyone east of UTC.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function getSubmissionDateRange(preset) {
  if (!preset || preset === 'custom') return null;
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);
  const monday = (today.getDay() + 6) % 7;
  if (preset === 'yesterday') {
    start.setDate(today.getDate() - 1);
    end.setDate(today.getDate() - 1);
  }
  if (preset === 'this_week') start.setDate(today.getDate() - monday);
  if (preset === 'last_week') {
    start.setDate(today.getDate() - monday - 7);
    end.setDate(today.getDate() - monday - 1);
  }
  if (preset === 'this_month') start.setDate(1);
  if (preset === 'previous_month') {
    start.setMonth(today.getMonth() - 1, 1);
    end.setMonth(today.getMonth(), 0);
  }
  if (preset === 'last_3_months') start.setMonth(today.getMonth() - 3);
  if (preset === 'last_6_months') start.setMonth(today.getMonth() - 6);
  if (preset === 'last_year') {
    start.setFullYear(today.getFullYear() - 1, 0, 1);
    end.setFullYear(today.getFullYear() - 1, 11, 31);
  }
  return { from: ymd(start), to: ymd(end) };
}

export const DEFAULT_REQUEST_FILTERS = {
  search: '',
  status: '',
  agencyId: '',
  assignedTo: '',
  submissionRange: '',
  submittedFrom: '',
  submittedTo: '',
  eventFrom: '',
  eventTo: '',
};

// Query params shared by the list and /stats endpoints. `status` is left to
// the caller: the list sends it, stats deliberately doesn't (its counts feed
// the status cards and tabs).
export function buildRequestParams(filters) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.agencyId) params.set('agencyId', filters.agencyId);
  if (filters.assignedTo) params.set('assignedTo', filters.assignedTo);
  const range = filters.submissionRange === 'custom' ? { from: filters.submittedFrom, to: filters.submittedTo } : getSubmissionDateRange(filters.submissionRange);
  if (range?.from) params.set('submittedFrom', range.from);
  if (range?.to) params.set('submittedTo', range.to);
  if (filters.eventFrom) params.set('eventFrom', filters.eventFrom);
  if (filters.eventTo) params.set('eventTo', filters.eventTo);
  return params;
}

export const countActiveRequestFilters = (filters) =>
  ['search', 'status', 'agencyId', 'assignedTo', 'submissionRange', 'eventFrom', 'eventTo'].filter((k) => filters[k]).length;

export const formatStatus = (status) => String(status || '').replace(/_/g, ' ');

export function formatHours(hours) {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

export const compactCurrency = (amount) => (amount == null ? '—' : formatCompactCurrency(Number(amount) || 0));
export const compactNumber = (n) => (n == null ? '—' : formatCompactNumber(Number(n) || 0));
