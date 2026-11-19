// "2 / 3 issued" with a split bar — issued (green), refused (red), still to
// do (grey). Used on Visa Status rows and the Visa Requests cards.
export function VisaProgress({ issued = 0, rejected = 0, total = 0, size = 'sm' }) {
  const pct = (n) => (total > 0 ? `${(n / total) * 100}%` : '0%');
  const left = Math.max(total - issued - rejected, 0);
  return (
    <div>
      <div className={`flex items-baseline justify-between gap-2 ${size === 'lg' ? 'text-sm' : 'text-[11px]'}`}>
        <span className="font-semibold text-ink">
          {issued} / {total} issued
        </span>
        {left > 0 ? (
          <span className="text-muted">{left} left</span>
        ) : rejected > 0 ? (
          <span className="text-[#B91C1C]">{rejected} refused</span>
        ) : total > 0 ? (
          <span className="text-[#047857]">Done</span>
        ) : null}
      </div>
      <div
        className={`mt-1.5 flex overflow-hidden rounded-full bg-[#E2E8F0] ${size === 'lg' ? 'h-2' : 'h-1.5'}`}
        role="img"
        aria-label={`${issued} issued, ${rejected} refused, ${left} left of ${total}`}
      >
        <span className="bg-[#10B981] transition-all" style={{ width: pct(issued) }} />
        <span className="bg-[#F87171] transition-all" style={{ width: pct(rejected) }} />
      </div>
    </div>
  );
}
