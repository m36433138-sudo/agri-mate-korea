import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { measureQuery } from "@/lib/queryProfiler";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/dashboard/Sparkline";
import {
  Tractor, Users, Package,
  ChevronRight, MessageSquare,
  ClipboardList, Truck, ArrowUpRight, TrendingUp,
  Calendar, Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

// 하단 위젯은 지연 로딩 (초기 JS 번들에서 분리)
const RecentRepairsWidget = lazy(() => import("@/components/dashboard/RecentRepairsWidget"));
const AIInsightWidget = lazy(() => import("@/components/dashboard/AIInsightWidget"));
const RecentMachinesWidget = lazy(() => import("@/components/dashboard/RecentMachinesWidget"));
const MonthlySummaryWidget = lazy(() => import("@/components/dashboard/MonthlySummaryWidget"));

// ── Glass card component ──
function GlassCard({
  children,
  className = "",
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`
        rounded-2xl border border-border/60
        bg-card
        ${hover ? "hover:border-border hover:bg-card/80 transition-all duration-200" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// 위젯 placeholder skeleton
function WidgetSkeleton({ className = "" }: { className?: string }) {
  return <Skeleton className={`rounded-2xl ${className}`} />;
}

export default function Dashboard() {
  useRealtimeSync("machines", [["machines-stats"], ["machines-sales-month"]]);
  useRealtimeSync("customers", [["customers-count"]]);
  useRealtimeSync("inventory", [["parts-count"]]);
  useRealtimeSync("repairs", [["repairs-month-count"]]);

  // 이번 달 범위 (월별 판매 집계 + 수리 카운트 공용)
  const dateNow = new Date();
  const monthStart = `${dateNow.getFullYear()}-${String(dateNow.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonthDate = new Date(dateNow.getFullYear(), dateNow.getMonth() + 1, 1);
  const monthEnd = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;

  // 재고 현황용 가벼운 쿼리: 재고중 행만, 필요한 컬럼만
  const { data: machineStats, isLoading: ml } = useQuery({
    queryKey: ["machines-stats"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await measureQuery("machines-stats", () =>
        supabase
          .from("machines")
          .select("status, machine_type")
          .eq("status", "재고중")
      );
      if (error) throw error;
      return data;
    },
  });

  // 이번 달 판매 건수: 날짜 범위로 한정 + count만 (head: true)
  const { data: salesThisMonth = 0 } = useQuery({
    queryKey: ["machines-sales-month", monthStart],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { count, error } = await measureQuery("machines-sales-month", () =>
        supabase
          .from("machines")
          .select("*", { count: "exact", head: true })
          .gte("sale_date", monthStart)
          .lt("sale_date", monthEnd)
      );
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: customersCount, isLoading: cl } = useQuery({
    queryKey: ["customers-count"],
    queryFn: async () => {
      const { count, error } = await measureQuery("customers-count", () =>
        supabase.from("customers").select("*", { count: "exact", head: true })
      );
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: partsCount, isLoading: pl } = useQuery({
    queryKey: ["parts-count"],
    queryFn: async () => {
      const { count, error } = await measureQuery("parts-count", () =>
        supabase.from("inventory").select("*", { count: "exact", head: true })
      );
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  // 이번 달 수리 건수만 카운트 — 가벼운 쿼리
  const { data: repairsThisMonth = 0, isLoading: rl } = useQuery({
    queryKey: ["repairs-month-count", monthStart],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { count, error } = await measureQuery("repairs-month-count", () =>
        supabase
          .from("repairs")
          .select("*", { count: "exact", head: true })
          .gte("repair_date", monthStart)
          .lt("repair_date", monthEnd)
      );
      if (error) throw error;
      return count ?? 0;
    },
  });

  const loading = ml;
  const heroLoading = rl;
  const customersLoading = cl;
  const partsLoading = pl;
  const inStock = machineStats ?? [];
  const newMachines = inStock.filter((m) => m.machine_type === "새기계");
  const usedMachines = inStock.filter((m) => m.machine_type === "중고기계");

  // Fake sparkline data (would come from time-series in production)
  const sparkCustomers = [12, 15, 13, 18, 22, 20, 24, 28, 26, 30];
  const sparkMachines = [5, 8, 6, 10, 9, 12, 11, 14, 13, 15];
  const sparkRepairs = [3, 5, 4, 7, 6, 8, 10, 9, 11, repairsThisMonth || 8];

  const quickActions = [
    { label: "작업현황판", desc: "오늘 수리 현황", icon: ClipboardList, to: "/dashboard/operations" },
    { label: "방문수리 접수", desc: "출장 수리 등록", icon: Truck, to: "/onsite-repairs" },
    { label: "AI 어시스턴트", desc: "정비 질문하기", icon: MessageSquare, to: "/chat" },
    { label: "실적 현황", desc: "이번 달 매출", icon: TrendingUp, to: "/dashboard/stats" },
  ];

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-medium">
              {dateNow.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
            </p>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            오늘의 업무 현황
          </h1>
        </div>
        {loading ? (
          <Skeleton className="hidden sm:block h-10 w-40 rounded-2xl" />
        ) : salesThisMonth > 0 ? (
          <div className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/8 px-4 py-2 rounded-2xl border border-primary/15">
            <ArrowUpRight className="h-3.5 w-3.5" />
            이번 달 판매 {salesThisMonth}대
          </div>
        ) : null}
      </div>

      {/* ── Hero KPI Row: 1 large + 3 small (즉시 렌더, above the fold) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <GlassCard className="lg:col-span-1 p-6 relative overflow-hidden group">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/8 transition-colors duration-500" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2.5 rounded-2xl bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">오늘 할 일</span>
            </div>
            {heroLoading ? (
              <>
                <Skeleton className="h-12 w-28 rounded-xl" />
                <Skeleton className="h-4 w-32 mt-3 rounded" />
                <Skeleton className="h-9 w-[140px] mt-4 rounded-xl" />
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-5xl font-extrabold tracking-tight text-foreground tabular-nums">
                    {repairsThisMonth}
                  </span>
                  <span className="text-lg font-semibold text-muted-foreground">건</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">이번 달 수리 진행</p>
                <div className="mt-4">
                  <Sparkline data={sparkRepairs} width={140} height={36} color="hsl(var(--primary))" fillOpacity={0.15} />
                </div>
              </>
            )}
          </div>
        </GlassCard>

        {[
          {
            label: "전체 고객",
            value: `${customersCount ?? 0}`,
            unit: "명",
            icon: Users,
            spark: sparkCustomers,
            color: "hsl(217, 91%, 60%)",
            iconBg: "bg-[hsl(217,91%,60%)]/10",
            iconColor: "text-[hsl(217,91%,60%)]",
            to: "/customers",
            isLoading: customersLoading,
          },
          {
            label: "재고 기계",
            value: `${inStock.length}`,
            unit: "대",
            sub: `새 ${newMachines.length} · 중고 ${usedMachines.length}`,
            icon: Tractor,
            spark: sparkMachines,
            color: "hsl(152, 57%, 38%)",
            iconBg: "bg-primary/10",
            iconColor: "text-primary",
            to: "/machines",
            isLoading: loading,
          },
          {
            label: "등록 부품",
            value: `${partsCount ?? 0}`,
            unit: "종",
            icon: Package,
            spark: [4, 6, 5, 8, 7, 9, 11, 10, 12, partsCount ?? 10],
            color: "hsl(38, 92%, 50%)",
            iconBg: "bg-warning/10",
            iconColor: "text-warning",
            to: "/parts",
            isLoading: partsLoading,
          },
        ].map((s) => (
          <Link key={s.to} to={s.to}>
            <GlassCard className="p-5 h-full group cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-xl ${s.iconBg}`}>
                  <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5" />
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{s.label}</p>
              {s.isLoading ? (
                <Skeleton className="h-8 w-20 rounded-xl" />
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight tabular-nums">{s.value}</span>
                  <span className="text-sm font-medium text-muted-foreground">{s.unit}</span>
                </div>
              )}
              {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
              <div className="mt-3">
                <Sparkline data={s.spark} width={100} height={28} color={s.color} />
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((a) => (
          <Link key={a.to} to={a.to}>
            <GlassCard className="flex items-center gap-3 p-4 cursor-pointer group">
              <div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                <a.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate leading-none">{a.label}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{a.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-all duration-200 ml-auto shrink-0 group-hover:translate-x-0.5" />
            </GlassCard>
          </Link>
        ))}
      </div>

      {/* ── Middle: Recent repairs + AI Insight (지연 로딩) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Suspense fallback={<WidgetSkeleton className="lg:col-span-3 h-[360px]" />}>
          <RecentRepairsWidget />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton className="lg:col-span-2 h-[360px]" />}>
          <AIInsightWidget />
        </Suspense>
      </div>

      {/* ── Bottom Bento: Recent inbound + Performance (지연 로딩) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Suspense fallback={<WidgetSkeleton className="lg:col-span-3 h-[320px]" />}>
          <RecentMachinesWidget />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton className="lg:col-span-2 h-[320px]" />}>
          <MonthlySummaryWidget
            loading={loading}
            repairsThisMonth={repairsThisMonth}
            salesThisMonth={salesThisMonth}
            customersCount={customersCount ?? 0}
            inStockCount={inStock.length}
            partsCount={partsCount ?? 0}
          />
        </Suspense>
      </div>
    </div>
  );
}
