import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '../../shared/fdPackage/index.js';

// Agent Portal's own Recharts theme — Revenue page (agent/pages/Revenue.jsx),
// all three tabs. Same gold/ink identity as the rest of this portal
// (agent-accent #FFC15A, agent-ink #222222 — tailwind.config.js), a
// dependency-free mirror of admin/components/charts.jsx's own approach but
// with this portal's own palette, same "two portals stay fully independent
// modules" convention this codebase already applies to icons.jsx/ui.jsx.
const INK = '#222222';
const MUTED = '#6B6B6B';
const GRID = '#F1DDB8';
const ACCENT = '#E9A63D';
const ACCENT_LIGHT = '#FFC15A';

// A short, distinct series palette for the By Package tab's top-N
// breakdown — warm gold/amber/terracotta tones (no blue/indigo borrowed
// from the admin console's own separate identity), staying inside this
// portal's "golden hour" palette while still giving each slice/bar its own
// readable hue.
const SERIES_COLORS = ['#E9A63D', '#FFC15A', '#D97706', '#F59E0B', '#B45309', '#EF4A3D', '#C2851A', '#6B6B6B'];

// Booking-status colors — same hex values as admin/components/charts.jsx's
// own STATUS_COLORS (a booking's status means the same thing to an agent as
// it does to admin; only the surrounding chrome is portal-themed, not this).
export const STATUS_COLORS = {
  pending_payment: '#FBBF24',
  deposit_paid: '#38BDF8',
  confirmed: '#34D399',
  balance_due: '#F59E0B',
  fully_paid: '#10B981',
  amendment_requested: '#FB923C',
  cancellation_requested: '#F87171',
  cancelled: '#EF4444',
  completed: '#94A3B8',
  waitlisted: '#A78BFA',
};

const TOOLTIP_STYLE = {
  contentStyle: { borderRadius: 8, border: `1px solid ${GRID}`, fontSize: 12, boxShadow: '0 4px 16px rgba(34,34,34,0.08)' },
  labelStyle: { color: INK, fontWeight: 700, marginBottom: 4 },
};

function MonthTick(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

// Small segmented control for picking a chart's visualization — mirrors
// admin/components/charts.jsx's own ChartTypeToggle, themed gold instead of
// indigo. Sits in a Card's own header row (Revenue.jsx's ChartCard) next to
// its label, same rounded-pill language as the page's own top-level tab bar.
export function ChartTypeToggle({ options, value, onChange }) {
  return (
    <div className="flex flex-none items-center gap-1 rounded-full border border-agent-line-light bg-agent-panel/60 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
            value === opt.value ? 'bg-white text-agent-accent-dark shadow-sm' : 'text-agent-muted hover:text-agent-ink'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export const TREND_CHART_TYPES = [
  { value: 'area', label: 'Area' },
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
];

// Overview tab — spend-by-month trend, switchable between area/line/bar.
export function SpendTrendChart({ months, type = 'area' }) {
  if (months.length === 0) return <p className="text-sm text-agent-muted">No data for this range.</p>;

  const sharedAxes = (
    <>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey="month" tickFormatter={MonthTick} tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
      <YAxis
        tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
        tick={{ fontSize: 11, fill: MUTED }}
        axisLine={false}
        tickLine={false}
        width={40}
      />
      <Tooltip
        {...TOOLTIP_STYLE}
        formatter={(value, name) => (name === 'revenue' ? [formatCurrency(value), 'Paid'] : [value, 'Bookings'])}
        labelFormatter={MonthTick}
      />
    </>
  );

  return (
    <ResponsiveContainer width="100%" height={260}>
      {type === 'line' ? (
        <LineChart data={months} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          {sharedAxes}
          <Line type="monotone" dataKey="revenue" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3, fill: ACCENT }} activeDot={{ r: 5 }} />
        </LineChart>
      ) : type === 'bar' ? (
        <BarChart data={months} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          {sharedAxes}
          <Bar dataKey="revenue" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      ) : (
        <AreaChart data={months} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="agent-revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.4} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          {sharedAxes}
          <Area type="monotone" dataKey="revenue" stroke={ACCENT} strokeWidth={2.5} fill="url(#agent-revenue-fill)" />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}

export const BREAKDOWN_CHART_TYPES = [
  { value: 'bar', label: 'Bar' },
  { value: 'pie', label: 'Pie' },
];

// By Package tab — top-N breakdown, switchable between horizontal bars and
// a pie.
export function TopRevenueBarChart({ data, nameKey, type = 'bar', height }) {
  if (data.length === 0) return null;

  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height || 260}>
        <PieChart>
          <Pie data={data} dataKey="revenue" nameKey={nameKey} innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip {...TOOLTIP_STYLE} formatter={(value, _name, entry) => [formatCurrency(value), entry.payload[nameKey]]} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const chartHeight = height || Math.max(160, data.length * 40);
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey={nameKey}
          tick={{ fontSize: 12, fill: INK }}
          axisLine={false}
          tickLine={false}
          width={140}
          tickFormatter={(v) => (v.length > 22 ? `${v.slice(0, 22)}…` : v)}
        />
        <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [formatCurrency(value), 'Amount Paid']} />
        <Bar dataKey="revenue" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const STATUS_CHART_TYPES = [
  { value: 'donut', label: 'Donut' },
  { value: 'bar', label: 'Bar' },
];

// Payments tab — bookings-by-status, switchable between a donut with a side
// legend and a horizontal bar.
export function StatusDonutChart({ data, statusLabel, type = 'donut' }) {
  if (data.length === 0) return <p className="text-sm text-agent-muted">No bookings match these filters.</p>;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (type === 'bar') {
    const chartData = data.map((d) => ({ ...d, label: statusLabel(d.status) }));
    return (
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: INK }} axisLine={false} tickLine={false} width={150} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [`${value} booking(s)`, undefined]} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={22}>
            {chartData.map((d) => (
              <Cell key={d.status} fill={STATUS_COLORS[d.status] || MUTED} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="h-56 w-full flex-none sm:w-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="status" innerRadius="60%" outerRadius="90%" paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.status} fill={STATUS_COLORS[d.status] || MUTED} />
              ))}
            </Pie>
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(value, _name, entry) => [`${value} booking(s)`, statusLabel(entry.payload.status)]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full flex-1 space-y-2">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <div key={d.status} className="flex items-center gap-2.5 text-xs">
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: STATUS_COLORS[d.status] || MUTED }} />
              <span className="flex-1 truncate font-semibold text-agent-ink">{statusLabel(d.status)}</span>
              <span className="flex-none text-agent-muted">
                {d.count} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Payments tab — a single stacked bar (paid vs outstanding, out of total
// booked value). Plain CSS, same reasoning as admin's own copy of this
// component: one shape with two segments doesn't need a type toggle.
export function PaidVsOutstandingBar({ totalBookedValue, totalCollected, totalOutstanding }) {
  const paidPct = totalBookedValue > 0 ? Math.min(100, (totalCollected / totalBookedValue) * 100) : 0;
  const outstandingPct = totalBookedValue > 0 ? Math.min(100 - paidPct, (totalOutstanding / totalBookedValue) * 100) : 0;

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-agent-panel">
        <div className="h-full transition-all" style={{ width: `${paidPct}%`, background: ACCENT }} />
        <div className="h-full transition-all" style={{ width: `${outstandingPct}%`, background: ACCENT_LIGHT }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: ACCENT }} />
          <span className="font-semibold text-agent-ink">Paid</span>
          <span className="text-agent-muted">{formatCurrency(totalCollected)}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: ACCENT_LIGHT }} />
          <span className="font-semibold text-agent-ink">Outstanding</span>
          <span className="text-agent-muted">{formatCurrency(totalOutstanding)}</span>
        </span>
      </div>
    </div>
  );
}
