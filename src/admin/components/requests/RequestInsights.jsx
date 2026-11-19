import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LuBadgeCheck, LuChartColumn, LuChevronDown, LuChevronUp, LuHourglass, LuSend, LuTrendingUp, LuUsers, LuWallet } from 'react-icons/lu';
import { CHART_THEME, StatusDonutChart } from '../charts.jsx';
import { formatCurrency } from '../../../shared/fdPackage/index.js';
import { compactCurrency, compactNumber, formatHours } from './requestMeta.js';

// Insights panel for the Quote Inbox (Custom FIT) and MICE Requests pages —
// fed by GET /admin/package-requests/stats or /admin/mice-rfqs/stats
// (services/requestStats.service.js), so it always reflects the page's
// current filters (every filter except status).
//
// Colours: the three-series trend uses the validated indigo / amber / green
// triad; the pipeline donut groups statuses into five phases (a donut can't
// carry 11 distinguishable statuses) using the validated violet / sky /
// magenta / amber / green order. Single-dimension bars stay single-hue.

const { INK, MUTED, GRID, ACCENT, TOOLTIP_STYLE } = CHART_THEME;
const AMBER = '#D97706';
const GREEN = '#059669';
const AXIS = { tick: { fontSize: 11, fill: MUTED }, tickLine: false };
const STORAGE_KEY = 'xo.admin.requestInsights.open';

function readOpen() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function Panel({ title, subtitle, legend, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-lg border border-[#E4E9FB] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-ink">{title}</h4>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>}
        </div>
        {legend}
      </div>
      {children}
    </section>
  );
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <span className={i.line ? 'h-0.5 w-3 rounded-full' : 'h-2 w-2 rounded-full'} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function Empty({ text = 'No data for these filters', height = 220 }) {
  return (
    <div className="flex items-center justify-center rounded-md bg-[#FAFBFF] text-xs text-muted" style={{ height }}>
      {text}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone = 'indigo' }) {
  const tones = { indigo: 'bg-[#EEF2FF] text-[#4F46E5]', green: 'bg-[#ECFDF5] text-[#047857]', amber: 'bg-[#FFFBEB] text-[#B45309]', sky: 'bg-[#F0F9FF] text-[#0369A1]' };
  return (
    <div className="min-w-0 rounded-lg border border-[#E4E9FB] bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-md ${tones[tone]}`}>
          <Icon size={15} />
        </span>
        <span className="line-clamp-2 text-[11px] font-medium leading-tight text-muted">{label}</span>
      </div>
      <div className="mt-2 text-xl font-bold tabular-nums text-ink">{value}</div>
      {hint && <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted">{hint}</div>}
    </div>
  );
}

const bucketTick = (unit) => (value) =>
  new Date(value).toLocaleDateString(undefined, unit === 'day' ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' });

function TrendChart({ trend }) {
  const hasData = trend.points.some((p) => p.submitted || p.quoted);
  if (!hasData) return <Empty height={250} />;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={trend.points} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="at" tickFormatter={bucketTick(trend.unit)} {...AXIS} axisLine={{ stroke: GRID }} minTickGap={20} />
        <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={36} />
        <Tooltip
          {...TOOLTIP_STYLE}
          cursor={{ fill: '#F6F7FF' }}
          labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, trend.unit === 'day' ? { weekday: 'short', day: 'numeric', month: 'short' } : { month: 'long', year: 'numeric' })}
          formatter={(value, name, entry) => (name === 'Quotes sent' ? [`${value} · ${formatCurrency(entry.payload.value)}`, name] : [value, name])}
        />
        <Bar dataKey="submitted" name="Submitted" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line type="monotone" dataKey="quoted" name="Quotes sent" stroke={AMBER} strokeWidth={2} dot={{ r: 3, fill: AMBER, strokeWidth: 0 }} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
        <Line type="monotone" dataKey="won" name="Won" stroke={GREEN} strokeWidth={2} dot={{ r: 3, fill: GREEN, strokeWidth: 0 }} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Conversion funnel — plain HTML bars: exact counts, % of submitted, and the
// step-to-step drop-off are easier to read as text than as a chart shape.
function Funnel({ funnel }) {
  const top = funnel[0]?.count || 0;
  if (!top) return <Empty height={230} />;
  return (
    <ol className="space-y-2.5">
      {funnel.map((step, i) => {
        const pct = Math.round((step.count / top) * 100);
        const prev = funnel[i - 1]?.count;
        const kept = prev ? Math.round((step.count / prev) * 100) : null;
        return (
          <li key={step.stage}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-ink">{step.stage}</span>
              <span className="tabular-nums text-muted">
                <span className="font-semibold text-ink">{step.count}</span> · {pct}%
                {kept != null && <span className={`ml-2 ${kept < 50 ? 'text-[#B45309]' : 'text-[#64748B]'}`}>{kept}% kept</span>}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF1FA]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(pct, step.count ? 2 : 0)}%`, background: i === funnel.length - 1 || /accept|convert/i.test(step.stage) ? GREEN : ACCENT, opacity: 1 - i * 0.06 }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function UpcomingChart({ upcoming, peopleLabel }) {
  if (!upcoming.some((u) => u.count)) return <Empty height={230} text="Nothing scheduled in the next 6 months" />;
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={upcoming} margin={{ top: 6, right: 8, left: -14, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="at" tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })} {...AXIS} axisLine={{ stroke: GRID }} />
        <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={36} />
        <Tooltip
          {...TOOLTIP_STYLE}
          cursor={{ fill: '#F6F7FF' }}
          labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          formatter={(value, name, entry) => (name === 'Scheduled' ? [`${value} · ${compactNumber(entry.payload.people)} ${peopleLabel}`, name] : [value, name])}
        />
        <Bar dataKey="count" name="Scheduled" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar dataKey="confirmed" name="Confirmed" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RankedBars({ data, valueLabel, height }) {
  if (!data.length) return <Empty height={height || 200} />;
  return (
    <ResponsiveContainer width="100%" height={height || Math.max(180, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...AXIS} axisLine={{ stroke: GRID }} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: INK }} axisLine={false} tickLine={false} width={112} />
        <Tooltip
          {...TOOLTIP_STYLE}
          cursor={{ fill: '#F6F7FF' }}
          formatter={(value, _name, entry) => [`${value} · ${entry.payload.won} won${entry.payload.value ? ` (${formatCurrency(entry.payload.value)})` : ''}`, valueLabel]}
        />
        <Bar dataKey="count" fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SizeChart({ data, label }) {
  if (!data.some((d) => d.count)) return <Empty height={200} />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...AXIS} tick={{ fontSize: 11, fill: INK }} axisLine={{ stroke: GRID }} />
        <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={36} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: '#F6F7FF' }} formatter={(value) => [value, 'Requests']} labelFormatter={(l) => `${label}: ${l}`} />
        <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LeadManagerTable({ rows }) {
  if (!rows.length) return <Empty height={120} />;
  const th = 'whitespace-nowrap px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]';
  const td = 'whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-ink';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-[#FAFBFF]">
          <tr>
            <th className={th}>Lead manager</th>
            <th className={`${th} text-right`}>Requests</th>
            <th className={`${th} text-right`}>Open</th>
            <th className={`${th} text-right`}>Quoted</th>
            <th className={`${th} text-right`}>Won</th>
            <th className={`${th} text-right`}>Won value</th>
            <th className={`${th} text-right`}>Avg time to quote</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F3FA]">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className={`${td} font-semibold ${r.key === 'unassigned' ? 'text-muted' : ''}`}>{r.label}</td>
              <td className={`${td} text-right font-semibold`}>{r.count}</td>
              <td className={`${td} text-right ${r.open ? 'text-[#B45309]' : 'text-muted'}`}>{r.open}</td>
              <td className={`${td} text-right`}>{r.quoted}</td>
              <td className={`${td} text-right text-[#047857]`}>{r.won}</td>
              <td className={`${td} text-right`}>{r.value ? formatCurrency(r.value) : '—'}</td>
              <td className={`${td} text-right`}>{formatHours(r.avgTurnaroundHours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * @param {object} props
 * @param {object} props.stats        /stats response
 * @param {Array}  props.phases       [{ key, label, color, statuses: [] }] — donut grouping
 * @param {object} props.labels       { size, people, upcoming, sizeChart }
 */
export function RequestInsights({ stats, loading, phases, labels }) {
  const [open, setOpen] = useState(readOpen);

  function toggle() {
    setOpen((v) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, v ? '0' : '1');
      } catch {
        // Storage blocked — the toggle still works for this visit.
      }
      return !v;
    });
  }

  const k = stats?.kpis;
  const phaseData = stats
    ? phases.map((ph) => ({ status: ph.key, count: ph.statuses.reduce((s, st) => s + (stats.statusCounts[st] || 0), 0) })).filter((p) => p.count > 0)
    : [];
  const phaseColors = Object.fromEntries(phases.map((p) => [p.key, p.color]));
  const phaseLabel = (key) => phases.find((p) => p.key === key)?.label || key;

  return (
    <section className="mb-5" aria-label="Insights">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-ink">
            <LuChartColumn size={17} className="text-accent" /> Insights
          </h3>
          <p className="text-[11px] text-muted">Reflects the filters below (all statuses).</p>
        </div>
        <button type="button" onClick={toggle} aria-expanded={open} className="inline-flex items-center gap-1.5 rounded-md border border-line-light bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent">
          {open ? <LuChevronUp size={14} /> : <LuChevronDown size={14} />} {open ? 'Hide insights' : 'Show insights'}
        </button>
      </div>

      {open && (
        <div className={`space-y-4 transition-opacity ${loading && stats ? 'opacity-60' : ''}`}>
          {!stats ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[92px] animate-pulse rounded-lg bg-[#EEF1FA]" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Kpi icon={LuSend} label="Quote rate" value={k.quoteRate == null ? '—' : `${k.quoteRate}%`} hint={`${k.quoted} of ${k.total} quoted`} />
                <Kpi icon={LuBadgeCheck} label="Win rate" value={k.winRate == null ? '—' : `${k.winRate}%`} hint={`${k.won} won · ${k.lost} lost`} tone="green" />
                <Kpi icon={LuHourglass} label="Avg time to quote" value={formatHours(k.avgTurnaroundHours)} hint={`Median ${formatHours(k.medianTurnaroundHours)}`} tone="amber" />
                <Kpi icon={LuTrendingUp} label="Live pipeline" value={compactCurrency(k.pipelineValue)} hint="Quotes awaiting the agent" tone="sky" />
                <Kpi icon={LuWallet} label="Won value" value={compactCurrency(k.wonValue)} hint={k.avgDealValue ? `Avg ${compactCurrency(k.avgDealValue)} per deal` : 'No wins yet'} tone="green" />
                <Kpi icon={LuUsers} label={labels.size} value={k.avgSize ?? '—'} hint={`${compactNumber(k.totalPeople)} ${labels.people} total`} />
              </div>

              {k.unassigned > 0 && (
                <p className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">
                  <strong>{k.unassigned}</strong> open request{k.unassigned === 1 ? ' has' : 's have'} no lead manager yet — filter Lead manager → Unassigned to pick them up.
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                <Panel
                  title="Request trend"
                  subtitle={`Submitted per ${stats.trend.unit}; won counted against the ${stats.trend.unit} each request was submitted`}
                  legend={<Legend items={[{ label: 'Submitted', color: ACCENT }, { label: 'Quotes sent', color: AMBER, line: true }, { label: 'Won', color: GREEN, line: true }]} />}
                >
                  <TrendChart trend={stats.trend} />
                </Panel>
                <Panel title="Pipeline by phase" subtitle="Where requests currently sit">
                  <StatusDonutChart data={phaseData} statusLabel={phaseLabel} colorMap={phaseColors} unit="request(s)" emptyText="No requests for these filters" />
                </Panel>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Panel title="Conversion funnel" subtitle="Requests that reached each stage">
                  <Funnel funnel={stats.funnel} />
                </Panel>
                <Panel title={labels.upcoming} subtitle="Next 6 months, excluding declined/expired" legend={<Legend items={[{ label: 'Scheduled', color: ACCENT }, { label: 'Confirmed', color: GREEN }]} />}>
                  <UpcomingChart upcoming={stats.upcoming} peopleLabel={labels.people} />
                </Panel>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <Panel title="Top destinations" subtitle="By number of requests">
                  <RankedBars data={stats.topDestinations} valueLabel="Requests" />
                </Panel>
                <Panel title="Top agencies" subtitle="By number of requests">
                  <RankedBars data={stats.topAgencies} valueLabel="Requests" />
                </Panel>
                <Panel title={labels.sizeChart} subtitle="How large requests are" className="lg:col-span-2 xl:col-span-1">
                  <SizeChart data={stats.sizeDistribution} label={labels.sizeChart} />
                </Panel>
              </div>

              <Panel title="Lead manager performance" subtitle="Workload and outcomes per assigned lead manager">
                <LeadManagerTable rows={stats.leadManagers} />
              </Panel>
            </>
          )}
        </div>
      )}
    </section>
  );
}
