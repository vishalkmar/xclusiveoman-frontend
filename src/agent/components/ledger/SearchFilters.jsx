import { LuChevronDown, LuListFilter, LuSearch, LuX } from 'react-icons/lu';

const FIELD_ICON = 'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bk-muted';

// Free-text search plus one status filter.
//   options: [{ key, label }] — "all" is added in front as `allLabel`.
export function SearchFilters({ query, onQueryChange, placeholder, filter, onFilterChange, options, allLabel = 'All statuses', theme = 'ledger', className = '' }) {
  const palette = theme === 'agent'
    ? { field: 'border-agent-line-light text-agent-ink', icon: 'text-agent-muted', focus: 'focus:border-agent-accent-dark focus:ring-agent-accent/20', soft: 'hover:bg-agent-panel', hover: 'hover:text-agent-ink' }
    : { field: 'border-bk-line text-bk-ink', icon: 'text-bk-muted', focus: 'focus:border-bk-accent focus:ring-bk-accent/20', soft: 'hover:bg-bk-line-soft', hover: 'hover:text-bk-ink' };
  const field = `h-10 w-full rounded-lg border bg-white text-[13px] shadow-[0_1px_0_rgba(23,36,58,0.03)] focus:outline-none focus:ring-2 ${palette.field} ${palette.focus}`;
  return (
    <div className={`flex w-full flex-col gap-2 sm:flex-row md:w-auto ${className}`}>
      <label className="relative block sm:flex-1 md:w-64 md:flex-none">
        <span className="sr-only">Search</span>
        <LuSearch aria-hidden strokeWidth={1.75} className={`${FIELD_ICON} ${palette.icon}`} />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className={`${field} pl-9 pr-8 placeholder:text-agent-muted/80 [&::-webkit-search-cancel-button]:hidden`}
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
            className={`absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded ${palette.icon} ${palette.soft} ${palette.hover}`}
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        )}
      </label>

      <label className="relative block sm:w-44">
        <span className="sr-only">Filter by status</span>
        <LuListFilter aria-hidden strokeWidth={1.75} className={`${FIELD_ICON} ${palette.icon}`} />
        <select value={filter} onChange={(e) => onFilterChange(e.target.value)} className={`${field} appearance-none pl-9 pr-8`}>
          <option value="all">{allLabel}</option>
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <LuChevronDown aria-hidden className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${palette.icon}`} />
      </label>
    </div>
  );
}
