import { LuCalendarDays, LuSearch, LuX } from 'react-icons/lu';
import { Card, Select, TextInput } from '../ui.jsx';
import { countActiveRequestFilters, SUBMISSION_DATE_OPTIONS } from './requestMeta.js';

// Status cards + status tabs + filter bar shared by the admin Quote Inbox and
// MICE Requests pages. Counts come from the page's /stats call, which applies
// every filter except status — so each card/tab shows what clicking it would
// list.

const STAT_TONES = {
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  green: 'bg-emerald-50 text-emerald-600',
  grey: 'bg-slate-100 text-slate-500',
  red: 'bg-rose-50 text-rose-600',
  teal: 'bg-cyan-50 text-cyan-700',
};

export function RequestStatusCards({ cards, counts, total, status, onSelect, loading }) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const value = card.value ? counts?.[card.value] ?? 0 : total;
        const Icon = card.icon;
        return (
          <button key={card.label} type="button" onClick={() => onSelect(card.value)} className="text-left" aria-pressed={status === card.value}>
            <Card className={`h-full border-white p-4 transition hover:-translate-y-0.5 hover:shadow-md ${status === card.value ? 'ring-2 ring-accent/30' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{card.label}</div>
                  <div className={`mt-2 text-2xl font-bold tabular-nums text-ink ${loading ? 'opacity-40' : ''}`}>{value}</div>
                  <div className="mt-1 text-[10px] text-muted">{card.detail}</div>
                </div>
                <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${STAT_TONES[card.tone]}`}>
                  <Icon size={17} />
                </span>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

export function RequestStatusTabs({ options, counts, status, onSelect }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-line-light bg-white p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className={`whitespace-nowrap rounded-md px-3 py-2 text-[11px] font-semibold ${status === option.value ? 'bg-accent text-white' : 'text-muted hover:bg-panel hover:text-ink'}`}
        >
          {option.label}
          {option.value && <span className="ml-1 opacity-70">{counts?.[option.value] ?? 0}</span>}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children }) {
  return <span className="mb-1 block text-[10px] font-semibold uppercase text-muted">{children}</span>;
}

/**
 * `showEventDates` adds the MICE-only event date range (when the event
 * happens, as opposed to when the request was submitted).
 */
export function RequestFilters({ filters, onChange, onClear, statusOptions, agencies, leadManagers, searchPlaceholder, showEventDates = false }) {
  const active = countActiveRequestFilters(filters);
  return (
    <Card className="mb-4 border-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="relative block sm:col-span-2 lg:col-span-2">
          <FieldLabel>Search</FieldLabel>
          <LuSearch size={15} className="pointer-events-none absolute bottom-3.5 left-3 text-[#94A3B8]" />
          <TextInput className="pl-9" placeholder={searchPlaceholder} value={filters.search} onChange={(e) => onChange({ search: e.target.value })} />
        </label>
        <label className="block">
          <FieldLabel>Status</FieldLabel>
          <Select value={filters.status} onChange={(e) => onChange({ status: e.target.value })}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <FieldLabel>Agency</FieldLabel>
          <Select value={filters.agencyId} onChange={(e) => onChange({ agencyId: e.target.value })}>
            <option value="">All agencies</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <FieldLabel>Lead manager</FieldLabel>
          <Select value={filters.assignedTo} onChange={(e) => onChange({ assignedTo: e.target.value })}>
            <option value="">All lead managers</option>
            <option value="unassigned">Unassigned</option>
            {leadManagers.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <FieldLabel>Submitted</FieldLabel>
          <Select value={filters.submissionRange} onChange={(e) => onChange({ submissionRange: e.target.value })}>
            {SUBMISSION_DATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </label>
      </div>

      {(filters.submissionRange === 'custom' || showEventDates) && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filters.submissionRange === 'custom' && (
            <>
              <label className="block">
                <FieldLabel>Submitted from</FieldLabel>
                <TextInput type="date" value={filters.submittedFrom} max={filters.submittedTo || undefined} onChange={(e) => onChange({ submittedFrom: e.target.value })} />
              </label>
              <label className="block">
                <FieldLabel>Submitted to</FieldLabel>
                <TextInput type="date" value={filters.submittedTo} min={filters.submittedFrom || undefined} onChange={(e) => onChange({ submittedTo: e.target.value })} />
              </label>
            </>
          )}
          {showEventDates && (
            <>
              <label className="block">
                <FieldLabel>
                  <LuCalendarDays size={11} className="mr-1 inline -translate-y-px" />
                  Event starts from
                </FieldLabel>
                <TextInput type="date" value={filters.eventFrom} max={filters.eventTo || undefined} onChange={(e) => onChange({ eventFrom: e.target.value })} />
              </label>
              <label className="block">
                <FieldLabel>Event starts by</FieldLabel>
                <TextInput type="date" value={filters.eventTo} min={filters.eventFrom || undefined} onChange={(e) => onChange({ eventTo: e.target.value })} />
              </label>
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted">{active ? `${active} filter${active === 1 ? '' : 's'} applied` : 'No filters applied'}</span>
        <button
          type="button"
          onClick={onClear}
          disabled={!active}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line-light bg-white px-3 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LuX size={14} /> Clear filters
        </button>
      </div>
    </Card>
  );
}
