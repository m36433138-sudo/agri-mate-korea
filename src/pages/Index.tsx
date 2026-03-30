import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tractor, Wrench, Users, Package,
  ChevronRight, MessageSquare, BookOpen,
  ClipboardList, Truck, ArrowUpRight, TrendingUp,
} from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatters";
import { TypeBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";

export default function Dashboard() {
  useRealtimeSync("machines", [["machines"]]);
  useRealtimeSync("repairs", [["repairs-recent"]]);
  useRealtimeSync("customers", [["customers-count"]]);
  useRealtimeSync("inventory", [["parts-count"]]);

  const { data: machines, isLoading: ml } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: repairs, isLoading: rl } = useQuery({
    queryKey: ["repairs-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repairs")
        .select("*, machines(model_name, serial_number)")
        .order("repair_date", { ascending: false })
        .limit(5);
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
    staleTime: 1000 * 60 * 2,
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
    staleTime: 1000 * 60 * 2,
  });

  const loading = ml || rl;
  const inStock = machines?.filter((m) => m.status === "재고중") ?? [];
  const newMachines = inStock.filter((m) => m.machine_type === "새기계");
  const usedMachines = inStock.filter((m) => m.machine_type === "중고기계");

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const repairsThisMonth = repairs?.filter((r) => r.repair_date.startsWith(thisMonth)).length ?? 0;
  const salesThisMonth = machines?.filter((m) => m.sale_date?.startsWith(thisMonth)).length ?? 0;

  const recentEntries = machines
    ?.filter((m) => m.status === "재고중")
    .sort((a, b) => (b.entry_date > a.entry_date ? 1 : -1))
    .slice(0, 5) ?? [];

  const stats = [
    {
      label: "전체 고객",
      value: loading ? null : `${customersCount ?? 0}명`,
      icon: Users,
      color: "text-info",
      bg: "bg-info/10",
      to: "/customers",
    },
    {
      label: "재고 기계",
      value: loading ? null : `${inStock.length}대`,
      sub: loading ? null : `새기계 ${newMachines.length} · 중고 ${usedMachines.length}`,
      icon: Tractor,
      color: "text-primary",
      bg: "bg-primary/10",
      to: "/machines",
    },
    {
      label: "이번 달 수리",
      value: loading ? null : `${repairsThisMonth}건`,
      icon: Wrench,
      color: "text-warning",
      bg: "bg-warning/10",
      to: "/repairs",
    },
    {
      label: "등록 부품",
      value: loading ? null : `${partsCount ?? 0}종`,
      icon: Package,
      color: "text-destructive",
      bg: "bg-destructive/10",
      to: "/parts",
    },
  ];

  // 빠른 액션 버튼
  const quickActions = [
    { label: "작업현황판", desc: "오늘 수리 현황", icon: ClipboardList, to: "/dashboard/operations", accent: "bg-primary text-primary-foreground" },
    { label: "방문수리 접수", desc: "출장 수리 등록", icon: Truck, to: "/onsite-repairs", accent: "bg-info text-white" },
    { label: "AI 어시스턴트", desc: "정비 질문하기", icon: MessageSquare, to: "/chat", accent: "bg-warning text-white" },
    { label: "실적 현황", desc: "이번 달 매출", icon: TrendingUp, to: "/dashboard/stats", accent: "bg-success text-white" },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">오늘의 업무 현황</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>
        {!loading && salesThisMonth > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-success bg-success/10 px-3 py-1.5 rounded-full">
            <ArrowUpRight className="h-3.5 w-3.5" />
            이번 달 판매 {salesThisMonth}대
          </div>
        )}
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex items-center gap-3 p-3.5 rounded-xl bg-card border hover:border-primary/30 hover:shadow-card-hover transition-all duration-150"
          >
            <div className={`p-2 rounded-lg shrink-0 ${action.accent}`}>
              <action.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none truncate">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Link key={i} to={stat.to}>
            <Card className="border-0 shadow-card hover:shadow-card-hover transition-all duration-150 rounded-2xl cursor-pointer group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                {stat.value === null ? (
                  <Skeleton className="h-7 w-20 mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-0.5 tabular-nums">{stat.value}</p>
                )}
                {stat.sub && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 최근 정비 내역 */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-sm">최근 정비 내역</h3>
              <Link
                to="/repairs"
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5"
              >
                전체보기 <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                </div>
              ) : repairs?.length === 0 ? (
                <p className="text-sm text-muted-foreground p-5 text-center">수리 이력이 없습니다.</p>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40">
                      <th className="px-5 py-2.5">기계</th>
                      <th className="px-5 py-2.5">작업 내용</th>
                      <th className="px-5 py-2.5 hidden sm:table-cell">비용</th>
                      <th className="px-5 py-2.5 text-right">날짜</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {repairs?.map((r: any) => (
                      <tr key={r.id} className="hover:bg-muted/25 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-sm font-semibold leading-none">{r.machines?.model_name}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{r.machines?.serial_number}</p>
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground max-w-[160px] truncate">
                          {r.repair_content}
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold tabular-nums hidden sm:table-cell">
                          {r.total_cost > 0 ? formatPrice(r.total_cost) : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(r.repair_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>

        {/* AI 어드바이저 카드 */}
        <Card className="border-0 rounded-2xl overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/75 text-primary-foreground shadow-lg">
          <CardContent className="p-6 flex flex-col h-full relative min-h-[240px]">
            <div className="absolute -top-4 -right-4 opacity-[0.07]">
              <BookOpen className="h-36 w-36" />
            </div>
            <div className="relative z-10 flex-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-white/15 rounded-lg">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm">AI 정비 어드바이저</span>
              </div>
              <h4 className="text-lg font-bold mb-3 leading-snug">기계 증상을<br />물어보세요</h4>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 text-xs border border-white/10 leading-relaxed text-primary-foreground/90">
                "유압 압력이 불규칙할 때는 펌프 입구 스트레이너 막힘을 먼저 확인하세요..."
              </div>
            </div>
            <Link
              to="/chat"
              className="mt-5 w-full py-2.5 bg-white text-primary font-bold rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-1.5 text-sm"
            >
              AI 상담 시작 <ChevronRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 최근 입고 기계 */}
      <Card className="border-0 shadow-card rounded-2xl">
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-sm">최근 입고 기계</h3>
          <Link to="/machines" className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5">
            전체보기 <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">입고 기계가 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {recentEntries.map((m) => (
                <Link
                  key={m.id}
                  to={`/machines/${m.id}`}
                  className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Tractor className="h-4 w-4 text-primary" />
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
