import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_THEME } from '../charts.jsx';
import { CATEGORY_META, formatMinutes } from './supportMeta.js';

// Support analytics charts — admin Recharts theme (charts.jsx CHART_THEME).
// Multi-series colours were checked with the dataviz palette validator:
// indigo / green / amber are CVD-separable and every chart with >1 series
// carries a legend. Category and agent bars are single-hue on purpose: the
// axis label already identifies each bar, so colour would only add noise.

const { INK, MUTED, GRID, ACCENT, TOOLTIP_STYLE } = CHART_THEME;
const GREEN = '#059669';
const AMBER = '#D97706';

const AXIS = { tick: { fontSize: 11, fill: MUTED }, tickLine: false };

function tickFormatter(unit) {
  return (value) => {
    const d = new Date(value);
    if (unit === 'hour') return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (unit === 'month') return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
}

function tooltipLabel(unit) {
  return (value) => {
    const d = new Date(value);
    if (unit === 'hour') return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (unit === 'month') return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
}

export function ChartLegend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export const VOLUME_LEGEND = [
  { label: 'New conversations', color: ACCENT },
  { label: 'Resolved', color: GREEN },
];

export function ConversationVolumeChart({ data, unit }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="support-volume-new" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="at" tickFormatter={tickFormatter(unit)} {...AXIS} axisLine={{ stroke: GRID }} minTickGap={24} />
        <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={36} />
        <Tooltip {...TOOLTIP_STYLE} labelFormatter={tooltipLabel(unit)} formatter={(value, name) => [value, name === 'created' ? 'New conversations' : 'Resolved']} />
        <Area type="monotone" dataKey="created" stroke={ACCENT} strokeWidth={2} fill="url(#support-volume-new)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
        <Area type="monotone" dataKey="resolved" stroke={GREEN} strokeWidth={2} fill="none" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const RESOLUTION_LEGEND = [
  { label: 'Received', color: ACCENT },
  { label: 'Resolved', color: GREEN },
  { label: 'Pending', color: AMBER },
];

export function ResolutionOverviewChart({ rows }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="period" {...AXIS} tick={{ fontSize: 11, fill: INK }} axisLine={{ stroke: GRID }} />
        <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={36} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: '#F6F7FF' }} />
        <Bar dataKey="received" name="Received" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="resolved" name="Resolved" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="pending" name="Pending" fill={AMBER} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ResponseTimeTrendChart({ data, unit }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="at" tickFormatter={tickFormatter(unit)} {...AXIS} axisLine={{ stroke: GRID }} minTickGap={24} />
        <YAxis tickFormatter={(v) => formatMinutes(v)} {...AXIS} axisLine={false} width={58} />
        <Tooltip
          {...TOOLTIP_STYLE}
          labelFormatter={tooltipLabel(unit)}
          formatter={(value, _name, entry) => [`${formatMinutes(value)} · ${entry.payload.count} chat${entry.payload.count === 1 ? '' : 's'}`, 'Avg first response']}
        />
        <Line type="monotone" dataKey="avgMinutes" stroke={ACCENT} strokeWidth={2} connectNulls dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Horizontal single-hue bars — categories and "Resolved by Agent".
export function HorizontalBars({ data, labelKey, valueKey, valueLabel, height }) {
  return (
    <ResponsiveContainer width="100%" height={height || Math.max(150, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...AXIS} axisLine={{ stroke: GRID }} />
        <YAxis type="category" dataKey={labelKey} tick={{ fontSize: 12, fill: INK }} axisLine={false} tickLine={false} width={104} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: '#F6F7FF' }} formatter={(value) => [value, valueLabel]} />
        <Bar dataKey={valueKey} fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function categoryRows(categories) {
  return [...categories]
    .map((c) => ({ ...c, label: CATEGORY_META[c.category]?.label || c.category }))
    .sort((a, b) => b.count - a.count);
}
