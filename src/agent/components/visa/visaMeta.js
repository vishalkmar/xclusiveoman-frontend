// Shared lookups for the agent's visa applications (list + detail pages).
//
// An application is saved as `draft` until it's paid for. While it's a
// draft its real progress is shown instead — the first unfinished step:
//   names_pending → photos_pending → passports_pending → ready (to pay)
// Paying submits it (`submitted`); an NEFT slip waiting for verification is
// `payment_review`. Both lock the travellers.
// Statuses an application gets after submission (set by the visa team) are
// listed too, so the pages show them as soon as that workflow sets them.
import { humanize } from '../ledger/ledgerUtils.js';

const STAGE_META = {
  names_pending: { label: 'Names pending', tone: 'pending', group: 'in_progress', step: 'travellers' },
  photos_pending: { label: 'Photos pending', tone: 'pending', group: 'in_progress', step: 'photos' },
  passports_pending: { label: 'Passports pending', tone: 'pending', group: 'in_progress', step: 'passports' },
  ready: { label: 'Ready to pay', tone: 'info', group: 'ready', step: 'pay' },
  // NEFT slip uploaded, waiting on finance to verify it.
  payment_review: { label: 'Payment in review', tone: 'pending', group: 'processing', step: 'pay' },
  submitted: { label: 'Submitted · paid', tone: 'success', group: 'processing' },
  // Admin processing (0128): work started -> every traveller decided.
  processing: { label: 'In process', tone: 'info', group: 'processing' },
  approved: { label: 'Visas issued', tone: 'success', group: 'approved' },
  rejected: { label: 'Refused', tone: 'danger', group: 'closed' },
  cancelled: { label: 'Cancelled', tone: 'neutral', group: 'closed' },
};

// Filter / overview buckets, in display order.
export const STATUS_GROUPS = [
  { key: 'in_progress', label: 'In progress', bar: 'bg-bk-pending' },
  { key: 'ready', label: 'Ready to pay', bar: 'bg-[#4A6A99]' },
  { key: 'processing', label: 'Submitted', bar: 'bg-[#8A94A6]' },
  { key: 'approved', label: 'Visas issued', bar: 'bg-bk-success' },
  { key: 'closed', label: 'Refused / cancelled', bar: 'bg-bk-danger' },
];

// Per-step counts, from either the list row (counts) or a full application
// (applicants array).
export function applicationProgress(a) {
  if (Array.isArray(a.applicants)) {
    const list = a.applicants;
    return {
      total: list.length,
      names: list.filter((p) => p.fullName).length,
      photos: list.filter((p) => p.photoStatus && p.photoStatus !== 'pending').length,
      passports: list.filter((p) => p.passportStatus === 'confirmed').length,
    };
  }
  return { total: a.applicantCount || 0, names: a.namesDone || 0, photos: a.photosDone || 0, passports: a.passportsDone || 0 };
}

export function applicationStage(a) {
  if (a.status && a.status !== 'draft') return a.status;
  const p = applicationProgress(a);
  if (p.names < p.total) return 'names_pending';
  if (p.photos < p.total) return 'photos_pending';
  if (p.passports < p.total) return 'passports_pending';
  return 'ready';
}

export function stageMeta(stage) {
  return STAGE_META[stage] || { label: humanize(stage), tone: 'neutral', group: 'processing' };
}

// Travellers, photos and passports can only change while it's a draft.
export function isEditable(a) {
  return !a?.status || a.status === 'draft';
}

// Where "Continue" takes a draft: its first unfinished step (or payment).
export function continuePath(a) {
  const meta = stageMeta(applicationStage(a));
  return meta.step ? `/agent/visa/${a.id}/${meta.step}` : null;
}

// 0–1 share of the three steps done across all travellers.
export function progressShare(a) {
  const p = applicationProgress(a);
  return p.total ? (p.names + p.photos + p.passports) / (p.total * 3) : 0;
}

// A traveller's issued visa (uploaded by the admin). Image visas on
// Cloudinary download via fl_attachment; PDFs (stored raw) open as-is.
export const VISA_STATUS = {
  pending: { tone: 'pending', label: 'Visa in process' },
  issued: { tone: 'success', label: 'Visa issued' },
  rejected: { tone: 'danger', label: 'Visa refused' },
};

export function visaDownloadUrl(url) {
  return url ? url.replace('/image/upload/', '/image/upload/fl_attachment/') : url;
}
