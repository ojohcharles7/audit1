"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GRID = "#eef2f6";
const AXIS = "#94a3b8";
const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  fontSize: 11,
  boxShadow: "0 10px 30px -18px rgba(15,23,42,.35)",
};

export function MonthlyPerformanceChart({
  data,
}: {
  data: { month: string; audits: number; score: number; findings: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: AXIS }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar yAxisId="left" dataKey="audits" name="Audits" fill="#0b1b2b" radius={[3, 3, 0, 0]} barSize={18} />
          <Bar yAxisId="left" dataKey="findings" name="Findings" fill="#fca5a5" radius={[3, 3, 0, 0]} barSize={12} />
          <Line yAxisId="right" type="monotone" dataKey="score" name="Avg score" stroke="#d71920" strokeWidth={2.5} dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RegionScoresChart({ data }: { data: { name: string; score: number; audits: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: AXIS }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={45} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [`${Number(value).toFixed(1)}%`, "Average score"]} />
          <Bar dataKey="score" radius={[4, 4, 0, 0]} barSize={26}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.score >= 85 ? "#12805c" : entry.score >= 70 ? "#0e7490" : entry.score >= 55 ? "#d97706" : "#d71920"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeverityChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="flex h-56 items-center gap-3">
      <div className="h-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={46} outerRadius={72} paddingAngle={2} strokeWidth={0}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-36 shrink-0 space-y-2">
        {data.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: item.color }} />
              <span className="truncate capitalize text-slate-500">{item.name}</span>
            </span>
            <span className="font-semibold tabular-nums text-slate-800">
              {item.value}
              <span className="ml-1 font-normal text-slate-400">{total ? Math.round((item.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CategoryBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 2, right: 12, left: 6, bottom: 2 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" fill="#d71920" radius={[0, 3, 3, 0]} barSize={13} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DiscrepancyTrendChart({ data }: { data: { month: string; amount: number }[] }) {
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="discrepancyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d71920" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#d71920" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: AXIS }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${Math.round(Number(v) / 1000)}k`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [`₦${Number(value).toLocaleString()}`, "Exposure"]} />
          <Area type="monotone" dataKey="amount" stroke="#d71920" strokeWidth={2} fill="url(#discrepancyFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ActionCompletionChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: AXIS }} axisLine={false} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={34}>
            {data.map((item) => (
              <Cell key={item.name} fill={item.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RiskHeatMap({
  counts,
  thresholds,
}: {
  counts: Record<string, number>;
  thresholds: { critical: number; high: number; medium: number };
}) {
  const cells = [];
  for (let impact = 5; impact >= 1; impact--) {
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const score = likelihood * impact;
      const rating = score >= thresholds.critical ? "critical" : score >= thresholds.high ? "high" : score >= thresholds.medium ? "medium" : "low";
      const color =
        rating === "critical" ? "bg-red-600 text-white" : rating === "high" ? "bg-orange-500 text-white" : rating === "medium" ? "bg-amber-300 text-amber-950" : "bg-emerald-400 text-emerald-950";
      cells.push(
        <div key={`${likelihood}-${impact}`} className={`relative grid min-h-9 place-items-center rounded text-[10px] font-semibold ${color}`} title={`L${likelihood} × I${impact} = ${score}`}>
          {counts[`${likelihood}-${impact}`] || ""}
        </div>,
      );
    }
  }
  return (
    <div>
      <div className="flex gap-2">
        <div className="flex flex-col items-center justify-center">
          <span className="rotate-180 text-[9px] font-semibold uppercase tracking-wide text-slate-400" style={{ writingMode: "vertical-rl" }}>
            Impact
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-5 gap-1">{cells}</div>
          <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[9px] text-slate-400">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          <p className="mt-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">Likelihood</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[9px] text-slate-400">
        {[
          ["Low", "bg-emerald-400"],
          ["Medium", "bg-amber-300"],
          ["High", "bg-orange-500"],
          ["Critical", "bg-red-600"],
        ].map(([label, color]) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`size-2 rounded-sm ${color}`} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
