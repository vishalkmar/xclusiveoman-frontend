// Non-component pieces of the shared visa flow look (VisaFlowUi.jsx) — kept
// in their own module so the component file only exports components (Vite
// fast refresh).

export const SERIF = "font-['Georgia','Cambria','Times_New_Roman',serif]";
export const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBF47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF9EF]';

// "10-day visa · Single-Entry" for the subtitle of steps 2–5.
export function visaSummaryLine(application) {
  if (!application) return '';
  return [application.visaType?.name, application.visaCategory?.name].filter(Boolean).join(' · ');
}

// Photo / passport statuses → StatusBadge tone + label.
export const PHOTO_BADGE = {
  pending: { tone: 'neutral', label: 'Photo needed' },
  approved: { tone: 'success', label: 'Approved' },
  needs_review: { tone: 'pending', label: 'Needs review' },
};
export const PASSPORT_BADGE = {
  pending: { tone: 'neutral', label: 'Required' },
  scanned: { tone: 'pending', label: 'Scanned · check details' },
  needs_review: { tone: 'danger', label: 'Needs review' },
  confirmed: { tone: 'success', label: 'Confirmed' },
};
