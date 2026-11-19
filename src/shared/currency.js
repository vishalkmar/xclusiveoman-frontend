// Every amount in the portal is stored and charged in Omani Rial (OMR).
// OMR is subdivided into 1,000 baisa, so money has up to 3 decimal places.
export const CURRENCY = 'OMR';
export const CURRENCY_DECIMALS = 3;
// The display rate is held in memory only — never persisted — and kept fresh by
// useFxRate.js, so a stale figure can't outlive its session.
let omrToInrRate = null;
const rateListeners = new Set();
export function setOmrToInrRate(rate) {
  const next = Number(rate) > 0 ? Number(rate) : null;
  if (next === omrToInrRate) return;
  omrToInrRate = next;
  rateListeners.forEach((listener) => listener());
}
export function getOmrToInrRate() {
  return omrToInrRate;
}
// For useSyncExternalStore (components/Money.jsx): lets an amount re-render the
// moment the rate arrives or refreshes, wherever it sits in the tree.
export function subscribeOmrToInrRate(listener) {
  rateListeners.add(listener);
  return () => rateListeners.delete(listener);
}

// formatCurrency() appends "/INR x" inline by default (the agent portal). The
// admin portal instead shows INR in small text under the OMR figure
// (components/Money.jsx), so it turns the inline form off.
let inlineInr = true;
export function setInlineInr(value) {
  inlineInr = Boolean(value);
}

// Amounts are always shown to two decimal places - never rounded to a whole
// number - so "OMR 6.67" stays "OMR 6.67" and "OMR 1,177" reads "OMR 1,177.00".
const DISPLAY_DECIMALS = 2;
const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: DISPLAY_DECIMALS,
  maximumFractionDigits: DISPLAY_DECIMALS,
});
const inrFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: DISPLAY_DECIMALS,
  maximumFractionDigits: DISPLAY_DECIMALS,
});
const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

// 45999 -> "OMR 45,999.00", 12.5 -> "OMR 12.50", 6.667 -> "OMR 6.67".
// OMR only, never with an inline INR part.
export function formatOmr(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return `${CURRENCY} ${amountFormatter.format(Number(amount))}`;
}

export function formatCurrency(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const n = Number(amount);
  const omr = formatOmr(n);
  return omrToInrRate && inlineInr ? `${omr}/INR ${inrFormatter.format(n * omrToInrRate)}` : omr;
}

// 25.5 -> "INR 2,432.18" (null while the rate hasn't loaded) — the small line
// shown under an OMR amount in the admin portal.
export function formatInr(amount) {
  if (!omrToInrRate || amount == null || Number.isNaN(Number(amount))) return null;
  return `INR ${inrFormatter.format(Number(amount) * omrToInrRate)}`;
}

// 1250000 -> "OMR 1.3M" — for stat tiles and chart labels.
export function formatCompactCurrency(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return `${CURRENCY} ${compactFormatter.format(Number(amount))}`;
}

// 1250000 -> "1.3M" — chart axis ticks, where the axis title carries the unit.
export function formatCompactNumber(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return compactFormatter.format(Number(n));
}
