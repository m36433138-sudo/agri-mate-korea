import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthPoint } from "@/lib/repairTrend";
import { formatPrice } from "@/lib/formatters";

export function shortAxis(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1).replace(/\.0$/, "")}억`;
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;
  return String(n);
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: MonthPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border bg-popover/95 backdrop-blur px-3.5 py-2.5 shadow-lg text-sm min-w-[170px]">
      <p className="text-xs text-muted-foreground mb-1.5">{p.key.slice(0, 4)}년 {p.label} · {p.count}건</p>
      <p className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-chart-1" />수리 매출</span>
        <b className="tabular-nums">{formatPrice(p.total)}</b>
      </p>
      <p className="flex items-center justify-between gap-4 mt-0.5">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-chart-2" />공임비</span>
        <b className="tabular-nums">{formatPrice(p.labor)}</b>
      </p>
    </div>
  );
}

/** 월별 수리 매출(선+그라데이션)과 공임비(빗금) */
export function SalesTrendChart({ data, height = 280 }: { data: MonthPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full -ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trend-total" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
            <pattern id="trend-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="7" stroke="hsl(var(--chart-2))" strokeOpacity={0.35} strokeWidth={3} />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} dy={8} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={shortAxis} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: "hsl(var(--foreground))", strokeOpacity: 0.5, strokeWidth: 1.5 }} />
          <Area type="monotone" dataKey="total" stroke="hsl(var(--chart-1))" strokeWidth={2.5} fill="url(#trend-total)"
            activeDot={{ r: 5, strokeWidth: 3, stroke: "hsl(var(--card))", fill: "hsl(var(--chart-1))" }} />
          <Area type="monotone" dataKey="labor" stroke="hsl(var(--chart-2))" strokeWidth={2.5} fill="url(#trend-hatch)"
            activeDot={{ r: 5, strokeWidth: 3, stroke: "hsl(var(--card))", fill: "hsl(var(--chart-2))" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
