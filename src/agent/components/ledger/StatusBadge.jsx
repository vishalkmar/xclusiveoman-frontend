const TONES = {
  success: 'bg-bk-success-soft text-bk-success-ink',
  pending: 'bg-bk-pending-soft text-bk-pending-ink',
  danger: 'bg-bk-danger-soft text-bk-danger-ink',
  info: 'bg-[#E9EEF6] text-[#2F4A70]',
  neutral: 'bg-bk-line-soft text-bk-muted',
};
const DOTS = {
  success: 'bg-bk-success',
  pending: 'bg-bk-pending',
  danger: 'bg-bk-danger',
  info: 'bg-[#4A6A99]',
  neutral: 'bg-bk-muted',
};

// Compact status label: success / pending / danger / info / neutral.
export function StatusBadge({ tone = 'neutral', label, className = '' }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[11.5px] font-semibold ${TONES[tone] || TONES.neutral} ${className}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 flex-none rounded-full ${DOTS[tone] || DOTS.neutral}`} />
      {label}
    </span>
  );
}
