import { LuUserCheck, LuUsers } from 'react-icons/lu';
import { HorizontalBars } from './SupportCharts.jsx';
import { dayLabel, formatMinutes } from './supportMeta.js';
import { Avatar, EmptyState, Panel, Skeleton } from './SupportPrimitives.jsx';

const TH = 'whitespace-nowrap px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]';
const TD = 'whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-ink';

function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9" />)}
    </div>
  );
}

// Conversations and Messages are deliberately separate columns — one
// agency may open few chats but send many messages in them.
export function MostActiveUsers({ users, loading, onOpenUser }) {
  return (
    <Panel title="Most Active Users" subtitle="Click a user to see their full support history" bodyClassName="p-0">
      {loading && !users ? (
        <TableSkeleton />
      ) : !users?.length ? (
        <EmptyState icon={LuUsers} title="No users match the selected filters" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#FAFBFF]">
              <tr>
                <th className={TH}>User</th>
                <th className={`${TH} text-right`}>Conversations</th>
                <th className={`${TH} text-right`}>Messages</th>
                <th className={`${TH} text-right`}>Resolved</th>
                <th className={`${TH} text-right`}>Pending</th>
                <th className={`${TH} text-right`}>Last Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3FA]">
              {users.map((u) => (
                <tr key={u.userId} onClick={() => onOpenUser(u)} className="cursor-pointer hover:bg-[#FAFBFF]">
                  <td className="max-w-[220px] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-ink">{u.name}</div>
                        <div className="truncate text-[11px] text-muted">{u.agencyName || u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className={`${TD} text-right font-semibold`}>{u.conversations}</td>
                  <td className={`${TD} text-right`}>{u.messages}</td>
                  <td className={`${TD} text-right text-[#047857]`}>{u.resolved}</td>
                  <td className={`${TD} text-right ${u.pending ? 'text-[#B45309]' : 'text-muted'}`}>{u.pending}</td>
                  <td className={`${TD} text-right text-muted`}>{dayLabel(u.lastContactAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// Assignment-based: a chat counts toward whoever it's assigned to in Chat
// Logs. Unassigned chats are grouped so the table still accounts for them.
export function AgentPerformance({ agents, loading, onFilterAgent }) {
  const assigned = (agents || []).filter((a) => a.agentId);
  return (
    <Panel title="Agent Performance" subtitle="Based on the admin each conversation is assigned to" bodyClassName="p-0">
      {loading && !agents ? (
        <TableSkeleton rows={4} />
      ) : !agents?.length ? (
        <EmptyState icon={LuUserCheck} title="No conversations in this view" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#FAFBFF]">
                <tr>
                  <th className={TH}>Agent</th>
                  <th className={`${TH} text-right`}>Assigned</th>
                  <th className={`${TH} text-right`}>Resolved</th>
                  <th className={`${TH} text-right`}>Pending</th>
                  <th className={`${TH} text-right`}>Avg Response</th>
                  <th className={`${TH} text-right`}>Avg Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F3FA]">
                {agents.map((a) => (
                  <tr key={a.agentId || 'unassigned'} onClick={() => onFilterAgent(a.agentId || 'unassigned')} className="cursor-pointer hover:bg-[#FAFBFF]" title="Filter the dashboard to this agent">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {a.agentId ? <Avatar name={a.name} size="sm" /> : <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-dashed border-[#CBD5E1] text-[10px] text-muted">—</span>}
                        <span className={`truncate text-xs font-semibold ${a.agentId ? 'text-ink' : 'text-muted'}`}>{a.name}</span>
                      </div>
                    </td>
                    <td className={`${TD} text-right font-semibold`}>{a.assigned}</td>
                    <td className={`${TD} text-right text-[#047857]`}>{a.resolved}</td>
                    <td className={`${TD} text-right ${a.pending ? 'text-[#B45309]' : 'text-muted'}`}>{a.pending}</td>
                    <td className={`${TD} text-right`}>{formatMinutes(a.avgResponseMinutes)}</td>
                    <td className={`${TD} text-right`}>{formatMinutes(a.avgResolutionMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="min-w-0 border-t border-[#EEF1FA] p-4 xl:border-l xl:border-t-0">
            <h4 className="mb-2 text-xs font-semibold text-ink">Resolved by Agent</h4>
            {assigned.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">No conversations have been assigned yet. Assign chats from the Chat Logs table to track per-agent performance.</p>
            ) : (
              <HorizontalBars data={assigned} labelKey="name" valueKey="resolved" valueLabel="Resolved" />
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
