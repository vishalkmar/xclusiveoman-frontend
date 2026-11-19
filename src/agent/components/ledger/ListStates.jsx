import { LuRotateCcw } from 'react-icons/lu';

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bk-amber/60 text-bk-accent-strong">
        <Icon strokeWidth={1.6} aria-hidden className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[15px] font-semibold text-bk-ink">{title}</p>
      <div className="mt-1 max-w-sm text-[13px] text-bk-muted">{children}</div>
    </div>
  );
}

// The line above a list: "All bookings · 28 bookings", or "8 of 28 bookings
// match · Settled" with a Clear filters button while a filter is active.
export function ListCaption({ filtered, shown, total, noun, scopeLabel, filterLabel, onClear }) {
  const nouns = `${noun}${total === 1 ? '' : 's'}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bk-line-soft px-5 py-3.5">
      <p className="text-[12.5px] text-bk-muted">
        {filtered ? (
          <>
            <span className="font-semibold tabular-nums text-bk-ink">{shown}</span> of <span className="tabular-nums">{total}</span> {nouns} match
          </>
        ) : (
          <>
            <span className="font-semibold text-bk-ink">{scopeLabel}</span> · <span className="tabular-nums">{total}</span> {nouns}
          </>
        )}
        {filterLabel && (
          <>
            {' '}
            · <span className="text-bk-ink">{filterLabel}</span>
          </>
        )}
      </p>
      {filtered && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-semibold text-bk-accent-strong hover:bg-bk-amber/50"
        >
          <LuRotateCcw strokeWidth={1.75} aria-hidden className="h-3.5 w-3.5" />
          Clear filters
        </button>
      )}
    </div>
  );
}

// Placeholder rows while the list is in flight.
export function ListSkeleton({ rows = 5 }) {
  return (
    <ul aria-hidden className="divide-y divide-bk-line-soft">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex animate-pulse items-center gap-6 px-5 py-5">
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-36 rounded bg-bk-line-soft" />
            <div className="h-3 w-24 rounded bg-bk-line-soft" />
          </div>
          <div className="hidden h-3.5 w-24 rounded bg-bk-line-soft md:block" />
          <div className="hidden h-3.5 w-24 rounded bg-bk-line-soft md:block" />
          <div className="h-6 w-24 rounded-md bg-bk-line-soft" />
        </li>
      ))}
    </ul>
  );
}
