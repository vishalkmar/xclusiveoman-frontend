// Pipeline phases for the insights donut (RequestInsights.jsx). Hue order
// (violet, sky, amber, green) was checked with the dataviz palette
// validator; "Lost" is a deliberate neutral slate, and every slice is
// labelled with its count and % in the legend.

const PHASE_COLORS = { new: '#7C3AED', progress: '#0284C7', quoted: '#D97706', won: '#059669', lost: '#64748B' };

export const FIT_PHASES = [
  { key: 'new', label: 'New', color: PHASE_COLORS.new, statuses: ['submitted'] },
  { key: 'progress', label: 'In progress', color: PHASE_COLORS.progress, statuses: ['assigned', 'costed'] },
  { key: 'quoted', label: 'With agent', color: PHASE_COLORS.quoted, statuses: ['published', 'revision_requested'] },
  { key: 'won', label: 'Won', color: PHASE_COLORS.won, statuses: ['accepted', 'converted'] },
  { key: 'lost', label: 'Lost', color: PHASE_COLORS.lost, statuses: ['declined', 'expired'] },
];

export const MICE_PHASES = [
  { key: 'new', label: 'New', color: PHASE_COLORS.new, statuses: ['draft', 'submitted'] },
  { key: 'progress', label: 'Sourcing', color: PHASE_COLORS.progress, statuses: ['rfp_dispatched', 'supplier_responses_pending', 'supplier_responses_received', 'costed'] },
  { key: 'quoted', label: 'With agent', color: PHASE_COLORS.quoted, statuses: ['published', 'revision_requested', 'negotiating'] },
  { key: 'won', label: 'Won', color: PHASE_COLORS.won, statuses: ['accepted', 'converted'] },
  { key: 'lost', label: 'Lost', color: PHASE_COLORS.lost, statuses: ['declined', 'expired'] },
];
