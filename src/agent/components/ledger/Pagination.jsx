import { LuChevronDown, LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { PAGE_SIZES } from './ledgerUtils.js';

// 1 … 4 5 6 … 12 — always the first and last page, the current page and
// its neighbours, with gaps collapsed into an ellipsis.
function pageItems(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['gap-' + p, p] : [p]));
}

const NAV =
  'flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[12.5px] font-semibold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bk-accent/40 disabled:cursor-not-allowed disabled:opacity-40';

// Client-side pager for a list already held in memory: range label,
// rows-per-page choice, and numbered pages with previous/next.
export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, itemLabel = 'items' }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-bk-line-soft px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4 text-[12.5px] text-bk-muted">
        <p>
          <span className="font-semibold tabular-nums text-bk-ink">
            {from}–{to}
          </span>{' '}
          of <span className="tabular-nums">{total}</span> {itemLabel}
        </p>
        <label className="relative flex items-center gap-2">
          <span className="hidden sm:inline">Rows</span>
          <span className="sr-only sm:hidden">Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 appearance-none rounded-lg border border-bk-line bg-white pl-2.5 pr-7 text-[12.5px] font-semibold text-bk-ink focus:border-bk-accent focus:outline-none focus:ring-2 focus:ring-bk-accent/20"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <LuChevronDown aria-hidden className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-bk-muted" />
        </label>
      </div>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className={`${NAV} border-bk-line bg-white text-bk-ink hover:bg-bk-hover`}
          >
            <LuChevronLeft strokeWidth={1.75} className="h-4 w-4" />
          </button>
          {pageItems(page, totalPages).map((p) =>
            typeof p === 'string' ? (
              <span key={p} aria-hidden className="w-6 text-center text-[12.5px] text-bk-muted">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`${NAV} ${
                  p === page
                    ? 'border-bk-accent-strong bg-bk-accent-strong text-white'
                    : 'border-transparent text-bk-ink hover:border-bk-line hover:bg-bk-hover'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className={`${NAV} border-bk-line bg-white text-bk-ink hover:bg-bk-hover`}
          >
            <LuChevronRight strokeWidth={1.75} className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
