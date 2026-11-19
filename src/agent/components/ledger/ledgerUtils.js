// Helpers shared by the agent portal's list pages built on the ledger
// components (Bookings, Payment & Transaction History).

// Rows-per-page options for Pagination; the first is the default.
export const PAGE_SIZES = [10, 20, 50];

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

// "14 Oct 2026" — one unambiguous format for every row.
export function formatLedgerDate(value) {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : '—';
}

// "15:42"
export function formatLedgerTime(value) {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : '';
}

export function shortId(id) {
  return String(id || '').slice(0, 8);
}

export function applicationReference(id) {
  return id ? `VISA-${shortId(id).toUpperCase()}` : 'VISA—';
}

export function storedApplicationReference(application) {
  return application?.reference || applicationReference(application?.id);
}

export function humanize(value) {
  const text = String(value || '').replace(/_/g, ' ');
  return text ? text[0].toUpperCase() + text.slice(1) : '—';
}

export function sumBy(list, field) {
  return list.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
}

export function plural(count, one, many = `${one}s`) {
  return count === 1 ? one : many;
}

// Every whitespace-separated term must appear somewhere in `parts`; a
// leading "#" is ignored so "#2fc1" finds a short ID as shown in the list.
export function matchesQuery(parts, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = parts.filter(Boolean).join(' ').toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term.replace(/^#/, '')));
}
