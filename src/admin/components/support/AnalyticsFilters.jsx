import { useState } from 'react';
import { LuDownload, LuRotateCcw, LuSearch, LuSlidersHorizontal } from 'react-icons/lu';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, RANGE_OPTIONS, RESPONSE_TIME_OPTIONS, STATUS_OPTIONS, countActiveFilters } from './supportMeta.js';
import { MiniSelect } from './SupportPrimitives.jsx';

// Chat Logs filter bar. Every value here goes to the backend (see
// supportAnalytics.service.js#normalizeFilters) — nothing is filtered only
// on screen. Primary filters stay visible; the rest fold away on small
// screens behind "More filters" so the bar never overflows horizontally.

const isWide = () => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches;

export function AnalyticsFilters({ filters, onChange, onReset, onExport, exporting, agents }) {
  // Requests are debounced by the dashboard (SupportAnalytics.jsx), so the
  // search box can stay a plain controlled input shared with the table's.
  const [moreOpen, setMoreOpen] = useState(isWide);
  const activeCount = countActiveFilters(filters);

  const set = (key) => (value) => onChange({ [key]: value });

  return (
    <div className="rounded-lg border border-[#E4E9FB] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">User</span>
          <span className="relative block">
            <LuSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
              placeholder="Search by name, email, agency or #ID"
              className="h-9 w-full rounded-md border border-[#D7DDF0] bg-white pl-8 pr-3 text-xs text-ink placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15"
            />
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <MiniSelect label="Date range" value={filters.range} onChange={set('range')} className="sm:w-36">
            {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </MiniSelect>
          {filters.range === 'custom' && (
            <>
              <label className="flex min-w-0 flex-col gap-1 sm:w-36">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">From</span>
                <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => onChange({ from: e.target.value })} className="h-9 w-full min-w-0 rounded-md border border-[#D7DDF0] bg-white px-2 text-xs text-ink focus:border-[#6366F1] focus:outline-none" />
              </label>
              <label className="flex min-w-0 flex-col gap-1 sm:w-36">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">To</span>
                <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => onChange({ to: e.target.value })} className="h-9 w-full min-w-0 rounded-md border border-[#D7DDF0] bg-white px-2 text-xs text-ink focus:border-[#6366F1] focus:outline-none" />
              </label>
            </>
          )}
          <MiniSelect label="Status" value={filters.status} onChange={set('status')} className="sm:w-40">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </MiniSelect>
          <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold lg:hidden ${moreOpen ? 'border-[#6366F1] bg-[#EEF2FF] text-[#4338CA]' : 'border-[#D7DDF0] bg-white text-ink'}`}
            >
              <LuSlidersHorizontal size={14} /> More
            </button>
            <button type="button" onClick={onReset} disabled={activeCount === 0} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#D7DDF0] bg-white px-3 text-xs font-semibold text-ink hover:border-[#6366F1] hover:text-[#4F46E5] disabled:cursor-not-allowed disabled:opacity-40">
              <LuRotateCcw size={14} /> Reset{activeCount ? ` (${activeCount})` : ''}
            </button>
            <button type="button" onClick={onExport} disabled={exporting} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-[#4F46E5] px-3 text-xs font-semibold text-white shadow-sm hover:bg-[#4338CA] disabled:opacity-60 sm:flex-none">
              <LuDownload size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>

      <div className={`${moreOpen ? 'grid' : 'hidden'} mt-3 grid-cols-2 gap-3 border-t border-[#EEF1FA] pt-3 sm:grid-cols-3 lg:grid lg:grid-cols-6`}>
        <MiniSelect label="Agent / Admin" value={filters.agent} onChange={set('agent')}>
          <option value="">All agents</option>
          <option value="unassigned">Unassigned</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
        </MiniSelect>
        <MiniSelect label="Priority" value={filters.priority} onChange={set('priority')}>
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </MiniSelect>
        <MiniSelect label="Category" value={filters.category} onChange={set('category')}>
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </MiniSelect>
        <MiniSelect label="Response status" value={filters.responseStatus} onChange={set('responseStatus')}>
          <option value="">Any</option>
          <option value="replied">Replied</option>
          <option value="unreplied">Unreplied</option>
        </MiniSelect>
        <MiniSelect label="Repeat users" value={filters.repeat} onChange={set('repeat')}>
          <option value="">All users</option>
          <option value="repeat">Repeat users only</option>
        </MiniSelect>
        <MiniSelect label="First response" value={filters.responseTime} onChange={set('responseTime')}>
          <option value="">Any time</option>
          {RESPONSE_TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </MiniSelect>
      </div>
    </div>
  );
}
