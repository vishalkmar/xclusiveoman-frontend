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
} from "recharts";
import { formatCurrency } from "../../shared/fdPackage/index.js";

// Admin console's own Recharts theme — Revenue page (admin/pages/Revenue.jsx),
// all four tabs. Same indigo/purple/blue family every gradient pill/heading
// in this portal already uses (ProductCatalog.jsx's tab pills, Dashboard.jsx's
// gradient headings, …), not a generic chart-library default palette — a
// chart here should read as the same product as the rest of the console.
const INK = "#172554";
const MUTED = "#64748B";
const GRID = "#E4E9FB";
const ACCENT = "#4F46E5";
const ACCENT_LIGHT = "#818CF8";

// A short, distinct series palette for multi-bar/multi-slice charts (By
// Package / By Agent's top-N bars) — indigo through violet, the same family
// ProductCatalog's own tab-pill gradient (accent -> #7C3AED) already spans,
// just broken into individual stops instead of one gradient.
const SERIES_COLORS = [
  "#4F46E5",
  "#2563EB",
  "#7C3AED",
  "#0891B2",
  "#059669",
  "#D97706",
  "#DB2777",
  "#64748B",
];

// Booking-status colors — shared meaning with every STATUS_TONE Badge
// elsewhere in this app (green = settled, amber = in progress, red =
// cancelled, grey = done/neutral), just as distinct hex values instead of
// tone names, since a donut slice needs to be told apart from its neighbors
// at a glance in a way a shared pale Badge background doesn't have to be.
export const STATUS_COLORS = {
  pending_payment: "#FBBF24",
  deposit_paid: "#38BDF8",
  confirmed: "#34D399",
  balance_due: "#F59E0B",
  fully_paid: "#10B981",
  amendment_requested: "#FB923C",
  cancellation_requested: "#F87171",
  cancelled: "#EF4444",
  completed: "#94A3B8",
  waitlisted: "#A78BFA",
};

const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 8,
    border: `1px solid ${GRID}`,
    fontSize: 12,
    boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
  },
  labelStyle: { color: INK, fontWeight: 700, marginBottom: 4 },
};

// Shared with the Support Center analytics (components/support/SupportCharts.jsx)
// so its charts read as the same product without re-declaring the palette.
export const CHART_THEME = { INK, MUTED, GRID, ACCENT, ACCENT_LIGHT, SERIES_COLORS, TOOLTIP_STYLE };

function MonthTick(value) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

// Small segmented control for picking a chart's visualization — sits in a
// Card's own header row (see Revenue.jsx's ChartCard) next to its label,
// same rounded-pill language as the page's own top-level tab bar
// (TABS.map(...) in Revenue.jsx) just sized down for a secondary,
// in-card control rather than page navigation.
export function ChartTypeToggle({ options, value, onChange }) {
  return (
    <div className='flex flex-none items-center gap-1 rounded-full border border-line-light bg-panel/60 p-0.5'>
      {options.map((opt) => (
        <button
          key={opt.value}
          type='button'
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
            value === opt.value
              ? "bg-white text-accent shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export const TREND_CHART_TYPES = [
  { value: "area", label: "Area" },
  { value: "line", label: "Line" },
  { value: "bar", label: "Bar" },
];

// Overview tab — revenue-by-month trend, switchable between area/line/bar
// (ChartTypeToggle, TREND_CHART_TYPES) — same data/axes/tooltip either way,
// just a different geometry for the same monotone series.
export function RevenueTrendChart({ months, type = "area" }) {
  if (months.length === 0)
    return <p className='text-sm text-muted'>No data for this range.</p>;

  const sharedAxes = (
    <>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis
        dataKey='month'
        tickFormatter={MonthTick}
        tick={{ fontSize: 11, fill: MUTED }}
        axisLine={{ stroke: GRID }}
        tickLine={false}
      />
      <YAxis
        tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
        tick={{ fontSize: 11, fill: MUTED }}
        axisLine={false}
        tickLine={false}
        width={40}
      />
      <Tooltip
        {...TOOLTIP_STYLE}
        formatter={(value, name) =>
          name === "revenue"
            ? [formatCurrency(value), "Revenue"]
            : [value, "Bookings"]
        }
        labelFormatter={MonthTick}
      />
    </>
  );

  return (
    <ResponsiveContainer width='100%' height={260}>
      {type === "line" ? (
        <LineChart
          data={months}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          {sharedAxes}
          <Line
            type='monotone'
            dataKey='revenue'
            stroke={ACCENT}
            strokeWidth={2.5}
            dot={{ r: 3, fill: ACCENT }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      ) : type === "bar" ? (
        <BarChart
          data={months}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          {sharedAxes}
          <Bar
            dataKey='revenue'
            fill={ACCENT}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      ) : (
        <AreaChart
          data={months}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id='admin-revenue-fill' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor={ACCENT} stopOpacity={0.35} />
              <stop offset='100%' stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {sharedAxes}
          <Area
            type='monotone'
            dataKey='revenue'
            stroke={ACCENT}
            strokeWidth={2.5}
            fill='url(#admin-revenue-fill)'
          />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}

export function DashboardRevenueChart({ days }) {
  if (!days?.length) {
    return (
      <p className='text-sm text-muted'>No revenue data for this period.</p>
    );
  }

  const formatDay = (value) =>
    new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

  return (
    <ResponsiveContainer width='100%' height={245}>
      <AreaChart data={days} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient
            id='dashboard-revenue-fill'
            x1='0'
            y1='0'
            x2='0'
            y2='1'
          >
            <stop offset='0%' stopColor='#7C5CFF' stopOpacity={0.28} />
            <stop offset='100%' stopColor='#7C5CFF' stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey='date'
          tick={false}
          axisLine={{ stroke: "#D1D5DB" }}
          tickLine={false}
        />
        <YAxis hide domain={[0, "auto"]} />
        <Tooltip
          {...TOOLTIP_STYLE}
          labelFormatter={formatDay}
          formatter={(value) => [formatCurrency(value), "Revenue"]}
        />
        <Area
          type='linear'
          dataKey='revenue'
          stroke='#7C5CFF'
          strokeWidth={2}
          fill='url(#dashboard-revenue-fill)'
          activeDot={{ r: 4, fill: "#7C5CFF" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const BREAKDOWN_CHART_TYPES = [
  { value: "bar", label: "Bar" },
  { value: "pie", label: "Pie" },
];

// By Package / By Agent tabs — top-N breakdown, switchable between
// horizontal bars and a pie. The bar layout preserves room for long names.
export function TopRevenueBarChart({ data, nameKey, type = "bar", height }) {
  if (data.length === 0) return null;

  if (type === "pie") {
    return (
      <ResponsiveContainer width='100%' height={height || 260}>
        <PieChart>
          <Pie
            data={data}
            dataKey='revenue'
            nameKey={nameKey}
            innerRadius='55%'
            outerRadius='85%'
            paddingAngle={2}
            stroke='none'
          >
            {data.map((_, index) => (
              <Cell
                key={index}
                fill={SERIES_COLORS[index % SERIES_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value, _name, entry) => [
              formatCurrency(value),
              entry.payload[nameKey],
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const chartHeight = height || Math.max(160, data.length * 40);
  return (
    <ResponsiveContainer width='100%' height={chartHeight}>
      <BarChart
        data={data}
        layout='vertical'
        margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
      >
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis
          type='number'
          tickFormatter={(value) =>
            value >= 1000 ? `${Math.round(value / 1000)}k` : value
          }
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis
          type='category'
          dataKey={nameKey}
          tick={{ fontSize: 12, fill: INK }}
          axisLine={false}
          tickLine={false}
          width={140}
          tickFormatter={(value) =>
            value.length > 22 ? `${value.slice(0, 22)}…` : value
          }
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value) => [formatCurrency(value), "Revenue"]}
        />
        <Bar dataKey='revenue' radius={[0, 6, 6, 0]} maxBarSize={22}>
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={SERIES_COLORS[index % SERIES_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const STATUS_CHART_TYPES = [
  { value: "donut", label: "Donut" },
  { value: "bar", label: "Bar" },
];

// Booking status breakdown shared by Revenue and the dashboard.
export function StatusDonutChart({
  data,
  statusLabel,
  type = "donut",
  colorMap = STATUS_COLORS,
  showPercent = true,
  unit = "booking(s)",
  emptyText = "No bookings match these filters.",
}) {
  if (data.length === 0) {
    return <p className='text-sm text-muted'>{emptyText}</p>;
  }
  const total = data.reduce((sum, item) => sum + item.count, 0);

  if (type === "bar") {
    const chartData = data.map((item) => ({
      ...item,
      label: statusLabel(item.status),
    }));
    return (
      <ResponsiveContainer
        width='100%'
        height={Math.max(160, data.length * 40)}
      >
        <BarChart
          data={chartData}
          layout='vertical'
          margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
        >
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis
            type='number'
            allowDecimals={false}
            tick={{ fontSize: 11, fill: MUTED }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis
            type='category'
            dataKey='label'
            tick={{ fontSize: 12, fill: INK }}
            axisLine={false}
            tickLine={false}
            width={150}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value) => [`${value} ${unit}`, undefined]}
          />
          <Bar dataKey='count' radius={[0, 6, 6, 0]} maxBarSize={22}>
            {chartData.map((item) => (
              <Cell key={item.status} fill={colorMap[item.status] || MUTED} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className='flex flex-col items-center gap-6 sm:flex-row'>
      <div className='h-56 w-full flex-none sm:w-56'>
        <ResponsiveContainer width='100%' height='100%'>
          <PieChart>
            <Pie
              data={data}
              dataKey='count'
              nameKey='status'
              innerRadius='60%'
              outerRadius='90%'
              paddingAngle={2}
              stroke='none'
            >
              {data.map((item) => (
                <Cell key={item.status} fill={colorMap[item.status] || MUTED} />
              ))}
            </Pie>
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(value, _name, entry) => [
                `${value} ${unit}`,
                statusLabel(entry.payload.status),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className='w-full flex-1 space-y-2'>
        {data.map((item) => {
          const percentage =
            total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div
              key={item.status}
              className='flex items-center gap-2.5 text-xs'
            >
              <span
                className='h-2.5 w-2.5 flex-none rounded-full'
                style={{ background: colorMap[item.status] || MUTED }}
              />
              <span className='flex-1 truncate font-semibold text-ink'>
                {statusLabel(item.status)}
              </span>
              <span className='flex-none text-muted'>
                {showPercent ? `${item.count} · ${percentage}%` : item.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Compare mode — Period A is always the accent indigo, Period B a teal from
// SERIES_COLORS, so the two periods read the same way in every chart and
// in the page's own legend swatches (Revenue.jsx's compare filter bar).
export const COMPARE_COLOR_A = ACCENT;
export const COMPARE_COLOR_B = "#0891B2";

function compactTick(v) {
  return v >= 1000 ? `${Math.round(v / 1000)}k` : v;
}

// By Package / By Agent in compare mode — horizontal paired bars, one row per
// package/agency (names need the Y-axis width, same reason as
// TopRevenueBarChart). rows: [{ name, a, b }].
export function ComparisonBreakdownChart({ rows, labelA, labelB }) {
  if (rows.length === 0) return null;
  return (
    <ResponsiveContainer width='100%' height={Math.max(180, rows.length * 52)}>
      <BarChart
        data={rows}
        layout='vertical'
        margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
        barGap={2}
      >
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis
          type='number'
          tickFormatter={compactTick}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis
          type='category'
          dataKey='name'
          tick={{ fontSize: 12, fill: INK }}
          axisLine={false}
          tickLine={false}
          width={140}
          tickFormatter={(v) => (v.length > 22 ? `${v.slice(0, 22)}…` : v)}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value, name) => [
            formatCurrency(value),
            name === "a" ? labelA : labelB,
          ]}
        />
        <Bar
          dataKey='a'
          fill={COMPARE_COLOR_A}
          radius={[0, 4, 4, 0]}
          maxBarSize={16}
        />
        <Bar
          dataKey='b'
          fill={COMPARE_COLOR_B}
          radius={[0, 4, 4, 0]}
          maxBarSize={16}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Payments tab — a single stacked bar (collected vs outstanding, out of
// total booked value) instead of three disconnected stat cards trying to
// convey the same ratio. Deliberately plain CSS (a div's width, not a
// Recharts bar) — this is one shape with two segments, not a dataset that
// needs axes/tooltips/a legend of its own, so no type toggle here.
export function CollectedVsOutstandingBar({
  totalBookedValue,
  totalCollected,
  totalOutstanding,
}) {
  const collectedPct =
    totalBookedValue > 0
      ? Math.min(100, (totalCollected / totalBookedValue) * 100)
      : 0;
  const outstandingPct =
    totalBookedValue > 0
      ? Math.min(
          100 - collectedPct,
          (totalOutstanding / totalBookedValue) * 100
        )
      : 0;

  return (
    <div>
      <div className='flex h-4 w-full overflow-hidden rounded-full bg-panel'>
        <div
          className='h-full transition-all'
          style={{ width: `${collectedPct}%`, background: ACCENT }}
        />
        <div
          className='h-full transition-all'
          style={{ width: `${outstandingPct}%`, background: ACCENT_LIGHT }}
        />
      </div>
      <div className='mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs'>
        <span className='flex items-center gap-2'>
          <span
            className='h-2.5 w-2.5 flex-none rounded-full'
            style={{ background: ACCENT }}
          />
          <span className='font-semibold text-ink'>Collected</span>
          <span className='text-muted'>{formatCurrency(totalCollected)}</span>
        </span>
        <span className='flex items-center gap-2'>
          <span
            className='h-2.5 w-2.5 flex-none rounded-full'
            style={{ background: ACCENT_LIGHT }}
          />
          <span className='font-semibold text-ink'>Outstanding</span>
          <span className='text-muted'>{formatCurrency(totalOutstanding)}</span>
        </span>
      </div>
    </div>
  );
}
