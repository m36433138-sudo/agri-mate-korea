import { BarChart3 } from "lucide-react";

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/60 bg-card ${className}`}>{children}</div>
  );
}

interface Props {
  loading: boolean;
  repairsThisMonth: number;
  salesThisMonth: number;
  customersCount: number;
  inStockCount: number;
  partsCount: number;
}

export default function MonthlySummaryWidget({
  loading,
  repairsThisMonth,
  salesThisMonth,
  customersCount,
  inStockCount,
  partsCount,
}: Props) {
  const metrics = [
    { label: "수리 완료", value: repairsThisMonth, max: 20, color: "bg-primary" },
    { label: "기계 판매", value: salesThisMonth, max: 10, color: "bg-info" },
    { label: "신규 고객", value: Math.floor(customersCount * 0.1), max: 15, color: "bg-warning" },
  ];

  return (
    <GlassCard className="lg:col-span-2 p-6">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-bold text-sm">이번 달 실적 요약</h3>
      </div>

      <div className="space-y-5">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">{m.label}</span>
              <span className="text-sm font-bold tabular-nums">{loading ? "–" : m.value}</span>
            </div>
            <div className="h-2 rounded-full bg-accent overflow-hidden">
              <div
                className={`h-full rounded-full ${m.color} transition-all duration-700 ease-out`}
                style={{ width: loading ? "0%" : `${Math.min((m.value / m.max) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-border/40">
        <div className="rounded-2xl bg-accent/50 p-4 text-center">
          <p className="text-2xl font-extrabold tabular-nums text-foreground">
            {loading ? "–" : inStockCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">재고 기계</p>
        </div>
        <div className="rounded-2xl bg-accent/50 p-4 text-center">
          <p className="text-2xl font-extrabold tabular-nums text-foreground">
            {loading ? "–" : partsCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">등록 부품</p>
        </div>
      </div>
    </GlassCard>
  );
}
