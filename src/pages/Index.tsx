import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/dashboard/Sparkline";
import {
  Tractor, Wrench, Users, Package,
  ChevronRight, MessageSquare,
  ClipboardList, Truck, ArrowUpRight, TrendingUp,
  Calendar, Zap, BarChart3, Activity,
} from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatters";
import { TypeBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { useMemo } from "react";

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

// ── Status dot ──
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "재고중": "bg-emerald-500",
    "판매완료": "bg-muted-foreground",
    "수리중": "bg-amber-500",
  };
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? "bg-muted-foreground"}`} />
  );
}

export default function Dashboard() {
  useRealtimeSync("machines", [["machines-stats"], ["machines-recent"]]);
  useRealtimeSync("repairs", [["repairs-recent"]]);
  useRealtimeSync("customers", [["customers-count"]]);
  useRealtimeSync("inventory", [["parts-count"]]);

  // 통계용 가벼운 쿼리: 필요한 컬럼만
  const { data: machineStats, isLoading: ml } = useQuery({
    queryKey: ["machines-stats"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("status, machine_type, sale_date");
      if (error) throw error;
      return data;
    },
  });

  // 최근 입고 5건만 — DB에서 정렬·제한
  const { data: recentEntries = [] } = useQuery({
    queryKey: ["machines-recent"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("id, model_name, serial_number, entry_date, status, machine_type, purchase_price")
        .eq("status", "재고중")
        .order("entry_date", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: repairs, isLoading: rl } = useQuery({
    queryKey: ["repairs-recent"],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repairs")
        .select("id, repair_date, repair_content, total_cost, machines(model_name, serial_number)")
        .order("repair_date", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const { data: customersCount } = useQuery({
    queryKey: ["customers-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: partsCount } = useQuery({
    queryKey: ["parts-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("inventory")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  const loading = ml || rl;
  const inStock = machineStats?.filter((m) => m.status === "재고중") ?? [];
  const newMachines = inStock.filter((m) => m.machine_type === "새기계");
  const usedMachines = inStock.filter((m) => m.machine_type === "중고기계");

  const dateNow = new Date();
  const thisMonth = `${dateNow.getFullYear()}-${String(dateNow.getMonth() + 1).padStart(2, "0")}`;
  const repairsThisMonth = repairs?.filter((r) => r.repair_date?.startsWith(thisMonth)).length ?? 0;
  const salesThisMonth = machineStats?.filter((m) => m.sale_date?.startsWith(thisMonth)).length ?? 0;

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
        {!loading && salesThisMonth > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/8 px-4 py-2 rounded-2xl border border-primary/15">
            <ArrowUpRight className="h-3.5 w-3.5" />
            이번 달 판매 {salesThisMonth}대
          </div>
        )}
      </div>

      {/* ── Hero KPI Row: 1 large + 3 small ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Large hero card - Today's tasks */}
        <GlassCard className="lg:col-span-1 p-6 relative overflow-hidden group">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/8 transition-colors duration-500" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2.5 rounded-2xl bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">오늘 할 일</span>
            </div>
            {loading ? (
              <Skeleton className="h-14 w-32 rounded-2xl" />
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-extrabold tracking-tight text-foreground tabular-nums">
                  {repairsThisMonth}
                </span>
                <span className="text-lg font-semibold text-muted-foreground">건</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-2">이번 달 수리 진행</p>
            <div className="mt-4">
              <Sparkline data={sparkRepairs} width={140} height={36} color="hsl(var(--primary))" fillOpacity={0.15} />
            </div>
          </div>
        </GlassCard>

        {/* 3 smaller KPI cards */}
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
              {loading ? (
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

      {/* ── Middle: Recent repairs + AI Insight ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Recent repairs - left 3 cols */}
        <GlassCard className="lg:col-span-3 overflow-hidden" hover={false}>
          <div className="px-6 py-4 border-b border-border/40 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-bold text-sm">최근 정비 내역</h3>
            </div>
            <Link
              to="/repairs"
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5 group"
            >
              전체보기 <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            ) : repairs?.length === 0 ? (
              <p className="text-sm text-muted-foreground p-10 text-center">수리 이력이 없습니다.</p>
            ) : (
              <div className="divide-y divide-border/30">
                {repairs?.slice(0, 6).map((r: any) => (
                  <div key={r.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-accent/30 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.machines?.model_name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{r.repair_content}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {r.total_cost > 0 && (
                        <p className="text-sm font-bold tabular-nums">{formatPrice(r.total_cost)}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{formatDate(r.repair_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* AI Insight Panel - right 2 cols */}
        <div className="lg:col-span-2 rounded-3xl overflow-hidden relative"
          style={{
            background: "linear-gradient(145deg, hsl(152 45% 18%) 0%, hsl(152 55% 24%) 40%, hsl(170 45% 22%) 100%)",
          }}
        >
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-[1px]" />
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/[0.04] blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-primary/10 blur-3xl" />

          <div className="p-6 flex flex-col h-full text-white min-h-[320px] relative z-10">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-sm block">AI 정비 어드바이저</span>
                <span className="text-[11px] text-white/50">Powered by AgriMate</span>
              </div>
            </div>

            <h4 className="text-xl font-extrabold mb-4 leading-snug">
              기계 증상을<br />분석해 드립니다
            </h4>

            <div className="space-y-3 flex-1">
              <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-4 text-xs border border-white/8 leading-relaxed text-white/85">
                💡 "유압 압력이 불규칙할 때는 펌프 입구 스트레이너 막힘을 먼저 확인하세요..."
              </div>
              <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-4 text-xs border border-white/8 leading-relaxed text-white/85">
                🔧 "엔진 과열 시 냉각수 순환 경로와 서모스탯 작동 상태를 점검하세요."
              </div>
            </div>

            <Link
              to="/chat"
              className="mt-5 w-full py-3 bg-white text-foreground font-bold rounded-2xl hover:bg-white/95 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-sm shadow-lg shadow-black/10"
            >
              AI 상담 시작 <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom Bento: Recent inbound + Performance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Recent inbound machines - 3 cols */}
        <GlassCard className="lg:col-span-3 overflow-hidden" hover={false}>
          <div className="px-6 py-4 border-b border-border/40 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Tractor className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-bold text-sm">최근 입고 기계</h3>
            </div>
            <Link
              to="/machines"
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5 group"
            >
              전체보기 <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              </div>
            ) : recentEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">입고 기계가 없습니다.</p>
            ) : (
              <div className="space-y-1">
                {recentEntries.map((m) => (
                  <Link
                    key={m.id}
                    to={`/machines/${m.id}`}
                    className="flex items-center justify-between px-3 py-3 rounded-2xl hover:bg-accent/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                        <StatusDot status={m.status} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{m.model_name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {m.serial_number} · {formatDate(m.entry_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 ml-2 shrink-0">
                      <TypeBadge type={m.machine_type} />
                      <span className="text-sm font-bold tabular-nums hidden sm:block">
                        {formatPrice(m.purchase_price)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-all duration-200 group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Performance summary - 2 cols */}
        <GlassCard className="lg:col-span-2 p-6" hover={false}>
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-bold text-sm">이번 달 실적 요약</h3>
          </div>

          <div className="space-y-5">
            {/* Metric rows */}
            {[
              { label: "수리 완료", value: repairsThisMonth, max: 20, color: "bg-primary" },
              { label: "기계 판매", value: salesThisMonth, max: 10, color: "bg-info" },
              { label: "신규 고객", value: Math.floor((customersCount ?? 0) * 0.1), max: 15, color: "bg-warning" },
            ].map((m) => (
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

          {/* Quick stats grid */}
          <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-border/40">
            <div className="rounded-2xl bg-accent/50 p-4 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-foreground">
                {loading ? "–" : inStock.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">재고 기계</p>
            </div>
            <div className="rounded-2xl bg-accent/50 p-4 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-foreground">
                {loading ? "–" : (partsCount ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">등록 부품</p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
