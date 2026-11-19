import { LuCircleCheck, LuEye, LuFlag, LuMessagesSquare, LuRotateCcw, LuSearch, LuUserPlus } from 'react-icons/lu';
import { Pagination } from '../ui.jsx';
import { CATEGORY_OPTIONS, CLOSED_STATUSES, PRIORITY_OPTIONS, RANGE_OPTIONS, STATUS_OPTIONS, formatMinutes, relativeTime, shortDate } from './supportMeta.js';
import { ActionMenu, Avatar, EmptyState, Panel, PriorityTag, Skeleton, StatusPill } from './SupportPrimitives.jsx';

// Row actions shared by the table, the mobile cards and the drawer.
export function conversationActions({ log, agents, onView, onUpdate }) {
  const closed = CLOSED_STATUSES.has(log.status);
  return [
    onView && { label: 'View chat', icon: LuEye, onClick: () => onView(log.id) },
    {
      label: 'Assign',
      icon: LuUserPlus,
      children: [
        ...agents.map((a) => ({ label: a.fullName, active: a.id === log.assignedToUserId, onClick: () => onUpdate(log.id, { assignedToUserId: a.id }) })),
        ...(log.assignedToUserId ? [{ label: 'Unassign', onClick: () => onUpdate(log.id, { assignedToUserId: null }) }] : []),
      ],
    },
    closed
      ? { label: 'Reopen', icon: LuRotateCcw, onClick: () => onUpdate(log.id, { status: 'open' }) }
      : { label: 'Mark resolved', icon: LuCircleCheck, tone: 'success', onClick: () => onUpdate(log.id, { status: 'resolved' }) },
    {
      label: 'Change priority',
      icon: LuFlag,
      children: PRIORITY_OPTIONS.map((p) => ({ label: p.label, active: p.value === log.priority, onClick: () => onUpdate(log.id, { priority: p.value }) })),
    },
  ];
}

const TH = 'whitespace-nowrap px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]';
const TD = 'whitespace-nowrap px-3 py-3 text-xs text-ink';

const SORTS = [
  { value: 'lastActivity', label: 'Last activity' },
  { value: 'created', label: 'Newest' },
  { value: 'waiting', label: 'Longest waiting' },
  { value: 'messages', label: 'Most messages' },
];

function HeaderSelect({ value, onChange, label, children }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 min-w-0 rounded-md border border-[#D7DDF0] bg-white px-2 text-xs text-ink focus:border-[#6366F1] focus:outline-none">
      {children}
    </select>
  );
}

export function ChatLogsTable({ logs, pagination, loading, filters, onFilterChange, sort, onSortChange, onPageChange, agents, onView, onUpdate, busyId }) {
  const rows = logs || [];
  const showSkeleton = loading && !logs;

  // The table's own controls drive the same dashboard-wide filters as the
  // filter bar above, so the two can never disagree.
  const controls = (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
      <label className="relative col-span-2 block sm:w-56">
        <LuSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="search"
          aria-label="Search chat logs"
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder="Search logs…"
          className="h-8 w-full rounded-md border border-[#D7DDF0] bg-white pl-8 pr-2 text-xs text-ink placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:outline-none"
        />
      </label>
      <HeaderSelect label="Status" value={filters.status} onChange={(status) => onFilterChange({ status })}>
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </HeaderSelect>
      <HeaderSelect label="Date range" value={filters.range} onChange={(range) => onFilterChange({ range })}>
        {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </HeaderSelect>
      <HeaderSelect label="Priority" value={filters.priority} onChange={(priority) => onFilterChange({ priority })}>
        <option value="">All priorities</option>
        {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </HeaderSelect>
      <HeaderSelect label="Category" value={filters.category} onChange={(category) => onFilterChange({ category })}>
        <option value="">All categories</option>
        {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </HeaderSelect>
      <HeaderSelect label="Sort by" value={sort} onChange={onSortChange}>
        {SORTS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
      </HeaderSelect>
    </div>
  );

  return (
    <Panel title="Chat Logs" subtitle={pagination ? `${pagination.total} conversation${pagination.total === 1 ? '' : 's'}` : 'Loading…'} actions={controls} bodyClassName="p-0">
      {showSkeleton ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={LuMessagesSquare} title="No conversations found" hint="Try a wider date range or reset the filters." className="py-12" />
      ) : (
        <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* Tablet & desktop: full table, scrolls inside its own box. */}
          <div className="relative hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="border-b border-[#EEF1FA] bg-[#FAFBFF]">
                <tr>
                  <th className={TH}>ID</th>
                  <th className={TH}>User</th>
                  <th className={TH}>Last Message</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Priority</th>
                  <th className={TH}>Agent</th>
                  <th className={`${TH} text-right`}>Messages</th>
                  <th className={`${TH} text-right`}>First Response</th>
                  <th className={`${TH} text-right`}>Resolution</th>
                  <th className={TH}>Created</th>
                  <th className={TH}>Last Activity</th>
                  <th className={`${TH} text-right`}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F3FA]">
                {rows.map((log) => (
                  <tr key={log.id} onClick={() => onView(log.id)} className={`cursor-pointer hover:bg-[#FAFBFF] ${busyId === log.id ? 'opacity-50' : ''}`}>
                    <td className={`${TD} font-mono text-[11px] text-[#64748B]`}>{log.ref}</td>
                    <td className="max-w-[200px] px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={log.userName} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-ink">{log.userName}</div>
                          <div className="truncate text-[11px] text-muted">{log.agencyName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[240px] px-3 py-3">
                      <div className="truncate text-xs text-ink" title={log.lastMessage}>
                        {log.lastMessageFromStaff && <span className="text-muted">You: </span>}
                        {log.lastMessage || <span className="text-muted">—</span>}
                      </div>
                      {log.unansweredCount > 1 && <div className="mt-0.5 text-[10px] font-semibold text-[#BE185D]">{log.unansweredCount} unanswered</div>}
                    </td>
                    <td className={TD}><StatusPill status={log.status} /></td>
                    <td className={TD}><PriorityTag priority={log.priority} /></td>
                    <td className={`${TD} max-w-[140px] truncate ${log.assignedToName ? '' : 'text-muted'}`}>{log.assignedToName || 'Unassigned'}</td>
                    <td className={`${TD} text-right tabular-nums`}>{log.messageCount}</td>
                    <td className={`${TD} text-right tabular-nums`}>{formatMinutes(log.firstResponseMinutes)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{formatMinutes(log.resolutionMinutes)}</td>
                    <td className={`${TD} text-muted`}>{shortDate(log.createdAt)}</td>
                    <td className={`${TD} text-muted`}>{relativeTime(log.lastActivityAt)}</td>
                    <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu items={conversationActions({ log, agents, onView, onUpdate })} label={`Actions for ${log.ref}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: one card per conversation. */}
          <ul className="divide-y divide-[#F1F3FA] md:hidden">
            {rows.map((log) => (
              <li key={log.id} className="flex gap-3 px-4 py-3" onClick={() => onView(log.id)}>
                <Avatar name={log.userName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{log.userName}</span>
                    <span className="flex-none text-[11px] text-muted">{relativeTime(log.lastActivityAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">{log.lastMessage || '—'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <StatusPill status={log.status} />
                    <PriorityTag priority={log.priority} />
                    <span className="text-[11px] text-muted">{log.messageCount} msgs · {log.ref}</span>
                  </div>
                </div>
                <div className="flex-none" onClick={(e) => e.stopPropagation()}>
                  <ActionMenu items={conversationActions({ log, agents, onView, onUpdate })} label={`Actions for ${log.ref}`} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {pagination && pagination.total > 0 && (
        <div className="border-t border-[#EEF1FA] px-4 pb-4 sm:px-5">
          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onChange={onPageChange} itemLabel="conversations" />
        </div>
      )}
    </Panel>
  );
}
