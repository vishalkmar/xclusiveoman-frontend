import { LuCircleCheckBig, LuClock, LuHourglass, LuMessageSquareDashed, LuRepeat, LuTimer, LuTriangleAlert } from 'react-icons/lu';
import { formatMinutes, relativeTime } from './supportMeta.js';
import { Avatar, EmptyState, Panel, PriorityTag, Skeleton } from './SupportPrimitives.jsx';

function Metric({ icon: Icon, label, value, hint, tone = 'default' }) {
  const tones = {
    default: 'text-[#4F46E5] bg-[#F3F4FF]',
    warn: 'text-[#B45309] bg-[#FFFBEB]',
    good: 'text-[#047857] bg-[#ECFDF5]',
  };
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-md border border-[#EEF1FA] bg-[#FAFBFF] p-3">
      <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-md ${tones[tone]}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-medium text-muted">{label}</div>
        <div className="mt-0.5 text-lg font-bold tabular-nums leading-tight text-ink">{value}</div>
        {hint && <div className="mt-0.5 truncate text-[11px] text-muted">{hint}</div>}
      </div>
    </div>
  );
}

export function SupportPerformance({ performance, loading, onOpenConversation }) {
  return (
    <Panel title="Support Performance" subtitle="For conversations in the selected filters">
      {loading && !performance ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[74px]" />)}
        </div>
      ) : performance ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Metric
            icon={LuCircleCheckBig}
            label="Resolution Rate"
            value={performance.resolutionRate == null ? '—' : `${performance.resolutionRate}%`}
            hint={`${performance.resolved} of ${performance.total} resolved`}
            tone="good"
          />
          <Metric icon={LuTimer} label="First Response Time" value={formatMinutes(performance.avgFirstResponseMinutes)} hint="Average, first agent message → first reply" />
          <Metric icon={LuClock} label="Avg. Resolution Time" value={formatMinutes(performance.avgResolutionMinutes)} hint="Created → resolved" />
          <button type="button" disabled={!performance.oldestPending} onClick={() => onOpenConversation(performance.oldestPending.id)} className="min-w-0 text-left disabled:cursor-default">
            <Metric
              icon={LuHourglass}
              label="Oldest Pending Chat"
              value={performance.oldestPending ? `${formatMinutes(performance.oldestPending.waitingMinutes)} waiting` : 'None'}
              hint={performance.oldestPending ? `${performance.oldestPending.userName} · ${performance.oldestPending.ref}` : 'Nobody is waiting on a reply'}
              tone={performance.oldestPending ? 'warn' : 'default'}
            />
          </button>
          <Metric icon={LuMessageSquareDashed} label="Unanswered > 30 min" value={performance.unansweredOver30} hint="Waiting on an admin reply" tone={performance.unansweredOver30 ? 'warn' : 'default'} />
          <Metric icon={LuRepeat} label="Reopened Chats" value={performance.reopened} hint="Resolved, then the agent wrote again" />
        </div>
      ) : null}
    </Panel>
  );
}

const REASON_STYLES = {
  urgent: 'bg-[#FEF2F2] text-[#B91C1C]',
  pending_1h: 'bg-[#FDF2F8] text-[#BE185D]',
  no_reply_15m: 'bg-[#FFFBEB] text-[#B45309]',
  repeated: 'bg-[#F5F3FF] text-[#6D28D9]',
  high: 'bg-[#FFF7ED] text-[#C2410C]',
  reopened: 'bg-[#F0F9FF] text-[#0369A1]',
};

export function NeedsAttention({ data, loading, onOpenConversation }) {
  const summaryChips = data ? data.rules.filter((r) => data.counts[r.key] > 0) : [];
  return (
    <Panel
      title="Needs Attention"
      subtitle="Live queue · respects filters except the date range"
      bodyClassName="p-0"
      actions={
        data?.total ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-semibold text-[#B91C1C]">
            <LuTriangleAlert size={13} /> {data.total} conversation{data.total === 1 ? '' : 's'} need{data.total === 1 ? 's' : ''} attention
          </span>
        ) : null
      }
    >
      {loading && !data ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : !data || data.total === 0 ? (
        <EmptyState icon={LuCircleCheckBig} title="No pending conversations" hint="Nothing is waiting too long, urgent, or reopened right now." />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 border-b border-[#EEF1FA] px-4 py-2.5 sm:px-5">
            {summaryChips.map((r) => (
              <span key={r.key} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${REASON_STYLES[r.key]}`}>
                {data.counts[r.key]} {r.label.toLowerCase()}
              </span>
            ))}
          </div>
          <ul className="max-h-[360px] divide-y divide-[#F1F3FA] overflow-y-auto">
            {data.items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onOpenConversation(item.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#FAFBFF] sm:px-5">
                  <Avatar name={item.userName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{item.userName}</span>
                      <span className="flex-none text-[11px] tabular-nums text-muted">
                        {item.waitingMinutes ? `${formatMinutes(item.waitingMinutes)} waiting` : relativeTime(item.lastActivityAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      <span className="font-medium text-[#64748B]">{item.ref}</span> · {item.lastMessage || 'No message'}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1">
                      {item.reasons.map((r) => (
                        <span key={r.key} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${REASON_STYLES[r.key]}`}>{r.label}</span>
                      ))}
                      <span className="ml-1"><PriorityTag priority={item.priority} /></span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
