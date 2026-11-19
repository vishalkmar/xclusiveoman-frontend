import { LuArrowDownRight, LuArrowUpRight, LuCalendarCheck, LuCalendarDays, LuCalendarRange, LuCircleCheck, LuHourglass, LuInbox, LuMessageSquare, LuTimer } from 'react-icons/lu';
import { formatMinutes } from './supportMeta.js';
import { Skeleton } from './SupportPrimitives.jsx';

// Change vs the previous period. `inverse` = lower is better (response time).
function Delta({ changePct, label, inverse = false }) {
  if (changePct == null) return <span className="text-muted">{label ? `No data ${label.replace(/^vs /, 'for ')}` : '—'}</span>;
  if (changePct === 0) return <span className="text-muted">No change {label}</span>;
  const good = inverse ? changePct < 0 : changePct > 0;
  const Arrow = changePct > 0 ? LuArrowUpRight : LuArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${good ? 'text-[#047857]' : 'text-[#B91C1C]'}`}>
        <Arrow size={12} />
        {changePct > 0 ? '+' : ''}
        {changePct}%
      </span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

function StatCard({ icon: Icon, label, value, footer, highlight }) {
  return (
    <div className={`min-w-0 rounded-lg border bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${highlight ? 'border-[#FDE68A]' : 'border-[#E4E9FB]'}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-md ${highlight ? 'bg-[#FFFBEB] text-[#B45309]' : 'bg-[#F3F4FF] text-[#4F46E5]'}`}>
          <Icon size={15} />
        </span>
        <span className="line-clamp-2 text-xs font-medium leading-tight text-muted">{label}</span>
      </div>
      <div className="mt-2.5 text-2xl font-bold tabular-nums leading-none text-ink">{value}</div>
      <div className="mt-2 line-clamp-2 text-[11px] leading-snug">{footer}</div>
    </div>
  );
}

const RESOLVED_CARDS = [
  { key: 'today', label: 'Resolved Today', icon: LuCircleCheck },
  { key: 'week', label: 'Resolved This Week', icon: LuCalendarCheck },
  { key: 'month', label: 'Resolved This Month', icon: LuCalendarDays },
  { key: 'year', label: 'Resolved This Year', icon: LuCalendarRange },
];

export function SummaryCards({ summary, loading }) {
  if (loading && !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-lg border border-[#E4E9FB] bg-white px-4 py-3.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-6 w-12" />
            <Skeleton className="mt-2.5 h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }
  if (!summary) return null;

  const resolvedByKey = Object.fromEntries(summary.resolved.map((r) => [r.key, r]));
  const avgResponse = summary.avgResponseMinutes;

  return (
    <div className={`grid grid-cols-2 gap-3 transition-opacity md:grid-cols-4 2xl:grid-cols-8 ${loading ? 'opacity-60' : ''}`}>
      {RESOLVED_CARDS.map(({ key, label, icon }) => {
        const r = resolvedByKey[key];
        return <StatCard key={key} icon={icon} label={label} value={r?.value ?? 0} footer={<Delta changePct={r?.changePct} label={r?.comparisonLabel} />} />;
      })}
      <StatCard
        icon={LuHourglass}
        label="Awaiting Admin Reply"
        value={summary.awaitingAdmin}
        highlight={summary.awaitingAdmin > 0}
        footer={<span className="text-muted">{summary.awaitingAdmin ? 'Agent sent the last message' : 'Nobody is waiting'}</span>}
      />
      <StatCard icon={LuMessageSquare} label="New Conversations" value={summary.newConversations.value} footer={<Delta changePct={summary.newConversations.changePct} label="vs previous period" />} />
      <StatCard icon={LuInbox} label="Open Conversations" value={summary.openConversations} footer={<span className="text-muted">{summary.newStatusCount} not yet answered</span>} />
      <StatCard
        icon={LuTimer}
        label="Avg. Response Time"
        value={formatMinutes(avgResponse.value)}
        footer={<Delta changePct={avgResponse.changePct} label="vs previous period" inverse />}
      />
    </div>
  );
}
