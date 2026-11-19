// Right half of an overview panel: a proportional bar plus a legend whose
// items double as a status filter (click again to clear).
//   items: [{ key, label, count, detail, bar }] — `bar` is a bg-* class.
export function StatusMix({ title = 'Status mix', total, noun, items, active, onChange, compact = false }) {
  if (compact) {
    return (
      <div className="p-4 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-bk-muted">{title}</p>
          <p className="text-[12px] text-bk-muted"><span className="font-bold tabular-nums text-bk-ink">{total}</span> {noun}{total === 1 ? '' : 's'}</p>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-bk-line-soft" aria-hidden>
          {total > 0 && items.map((item) => item.count > 0 ? <span key={item.key} className={`${item.bar} h-full border-r-2 border-white last:border-r-0`} style={{ width: `${(item.count / total) * 100}%` }} /> : null)}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {items.map((item) => (
            <button key={item.key} type="button" onClick={() => onChange(active === item.key ? 'all' : item.key)} className={`flex items-center gap-1.5 text-[11px] ${active === item.key ? 'font-bold text-bk-ink' : 'text-bk-muted'}`}>
              <span className={`h-2 w-2 rounded-sm ${item.bar}`} /> {item.label} <span className="font-bold tabular-nums text-bk-ink">{item.count}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="p-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bk-muted">{title}</p>
        <p className="text-[12.5px] text-bk-muted">
          <span className="font-bold tabular-nums text-bk-ink">{total}</span> {noun}
          {total === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-bk-line-soft" aria-hidden>
        {total > 0 &&
          items.map((item) =>
            item.count > 0 ? (
              <span
                key={item.key}
                className={`${item.bar} h-full border-r-2 border-white last:border-r-0`}
                style={{ width: `${(item.count / total) * 100}%` }}
              />
            ) : null
          )}
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-1.5 sm:gap-2">
        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <li key={item.key}>
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => onChange(isActive ? 'all' : item.key)}
                className={`flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bk-accent/40 sm:gap-3 sm:px-3.5 sm:py-3 ${
                  isActive ? 'border-bk-accent/60 bg-bk-amber/40' : 'border-transparent hover:border-bk-line hover:bg-bk-hover'
                }`}
              >
                <span aria-hidden className={`mt-1.5 h-2 w-2 flex-none rounded-sm ${item.bar}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-bk-ink">{item.label}</span>
                    <span className="text-[17px] font-bold tabular-nums text-bk-ink">{item.count}</span>
                  </span>
                  <span className="mt-0.5 block whitespace-nowrap text-[12px] tabular-nums text-bk-muted">{item.detail}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Shell for an overview: headline figures on the left (`children`), the
// status mix on the right.
export function OverviewPanel({ label, children, mix, compact = false, theme = 'ledger' }) {
  const palette = theme === 'agent'
    ? { border: 'border-agent-line-light', accent: 'bg-agent-accent-dark' }
    : { border: 'border-bk-line', accent: 'bg-bk-accent' };
  return (
    <section
      aria-label={label}
      className={`overflow-hidden rounded-2xl border ${palette.border} bg-white ${mix ? 'grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]' : ''}`}
    >
      <div className={`relative ${mix ? `border-b ${palette.border} lg:border-b-0 lg:border-r` : ''} ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-7'}`}>
        <span aria-hidden className={`absolute left-0 top-7 h-10 w-[3px] rounded-r ${palette.accent}`} />
        {children}
      </div>
      {mix}
    </section>
  );
}
