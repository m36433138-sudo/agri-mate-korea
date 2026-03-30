import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Skeleton } from "@/components/ui/skeleton";
import GlowCard from "@/components/GlowCard";
import {
  Tractor, Wrench, Users, Package,
  ChevronRight, MessageSquare, BookOpen,
  ClipboardList, Truck, ArrowUpRight, TrendingUp,
} from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatters";
import { TypeBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";

export default function Dashboard() {
  useRealtimeSync("machines",   [["machines"]]);
  useRealtimeSync("repairs",    [["repairs-recent"]]);
  useRealtimeSync("customers",  [["customers-count"]]);
  useRealtimeSync("inventory",  [["parts-count"]]);

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
  const inStock      = machines?.filter((m) => m.status === "재고중") ?? [];
  const newMachines  = inStock.filter((m) => m.machine_type === "새기계");
  const usedMachines = inStock.filter((m) => m.machine_type === "중고기계");

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const repairsThisMonth = repairs?.filter((r) => r.repair_date?.startsWith(thisMonth)).length ?? 0;
  const salesThisMonth   = machines?.filter((m) => m.sale_date?.startsWith(thisMonth)).length ?? 0;

  const recentEntries = machines
    ?.filter((m) => m.status === "재고중")
    .sort((a, b) => (b.entry_date > a.entry_date ? 1 : -1))
    .slice(0, 5) ?? [];

  const stats = [
    {
      label: "전체 고객",
      value: `${customersCount ?? 0}`,
      unit: "명",
      icon: Users,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      accent: "#3B82F6",
      to: "/customers",
    },
    {
      label: "재고 기계",
      value: `${inStock.length}`,
      unit: "대",
      sub: `새기계 ${newMachines.length} · 중고 ${usedMachines.length}`,
      icon: Tractor,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      accent: "#10B981",
      to: "/machines",
    },
    {
      label: "이번 달 수리",
      value: `${repairsThisMonth}`,
      unit: "건",
      icon: Wrench,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      accent: "#F59E0B",
      to: "/repairs",
    },
    {
      label: "등록 부품",
      value: `${partsCount ?? 0}`,
      unit: "종",
      icon: Package,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
      accent: "#F43F5E",
      to: "/parts",
    },
  ];

  const quickActions = [
    { label: "작업현황판",   desc: "오늘 수리 현황",  icon: ClipboardList, to: "/dashboard/operations", bg: "bg-primary",    fg: "text-primary-foreground" },
    { label: "방문수리 접수", desc: "출장 수리 등록",  icon: Truck,         to: "/onsite-repairs",      bg: "bg-blue-500",   fg: "text-white" },
    { label: "AI 어시스턴트", desc: "정비 질문하기",   icon: MessageSquare, to: "/chat",                bg: "bg-amber-500",  fg: "text-white" },
    { label: "실적 현황",    desc: "이번 달 매출",    icon: TrendingUp,    to: "/dashboard/stats",     bg: "bg-violet-500", fg: "text-white" },
  ];

  return (
    <div className="space-y-6">
      {/* ── 헤더 ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">
            {now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">오늘의 업무 현황</h1>
        </div>
        {!loading && salesThisMonth > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-emerald-600 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-100">
            <ArrowUpRight className="h-3.5 w-3.5" />
            이번 달 판매 {salesThisMonth}대
          </div>
        )}
      </div>

      {/* ── 빠른 액션 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((a) => (
          <Link key={a.to} to={a.to}>
            <GlowCard className="flex items-center gap-3 p-4 cursor-pointer group">
              <div className={`p-2.5 rounded-xl shrink-0 ${a.bg} ${a.fg}`}>
                <a.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate leading-none">{a.label}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{a.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors ml-auto shrink-0" />
            </GlowCard>
          </Link>
        ))}
      </div>

      {/* ── KPI 카드 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Link key={i} to={s.to}>
            <GlowCard className="p-5 cursor-pointer group">
              {/* 상단: 아이콘 + 화살표 */}
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2.5 rounded-xl ${s.iconBg}`}>
                  <s.icon className={`h-5 w-5 ${s.iconColor}`} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors" />
              </div>
              {/* 숫자 */}
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              {loading ? (
                <Skeleton className="h-8 w-24 mt-1.5 rounded-lg" />
              ) : (
                <p className="text-3xl font-extrabold mt-1 tabular-nums tracking-tight">
                  {s.value}
                  <span className="text-lg font-semibold text-muted-foreground ml-1">{s.unit}</span>
                </p>
              )}
              {s.sub && (
                <p className="text-xs text-muted-foreground mt-1.5">{s.sub}</p>
              )}
              {/* 하단 컬러 바 */}
              <div className="mt-4 h-1 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: loading ? "0%" : "60%", background: s.accent }}
                />
              </div>
            </GlowCard>
          </Link>
        ))}
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 최근 정비 내역 */}
        <div className="lg:col-span-2">
          <GlowCard>
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
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
                <p className="text-sm text-muted-foreground p-8 text-center">수리 이력이 없습니다.</p>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-gray-50/80">
                      <th className="px-5 py-3">기계</th>
                      <th className="px-5 py-3">작업 내용</th>
                      <th className="px-5 py-3 hidden sm:table-cell">비용</th>
                      <th className="px-5 py-3 text-right">날짜</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {repairs?.map((r: any) => (
                      <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold leading-none">{r.machines?.model_name}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{r.machines?.serial_number}</p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-[160px] truncate">
                          {r.repair_content}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold tabular-nums hidden sm:table-cell">
                          {r.total_cost > 0 ? formatPrice(r.total_cost) : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(r.repair_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </GlowCard>
        </div>

        {/* AI 어드바이저 */}
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{
            background: "linear-gradient(135deg, hsl(142 64% 28%) 0%, hsl(142 64% 38%) 50%, hsl(217 91% 55%) 100%)",
          }}
        >
          <div className="p-6 flex flex-col h-full text-white min-h-[240px] relative">
            {/* 배경 장식 */}
            <div className="absolute -top-6 -right-6 opacity-[0.08]">
              <BookOpen className="h-40 w-40" />
            </div>
            {/* 반짝이는 원 장식 */}
            <div className="absolute top-4 right-8 w-20 h-20 rounded-full bg-white/5 blur-xl" />
            <div className="absolute bottom-8 left-4 w-16 h-16 rounded-full bg-white/5 blur-lg" />

            <div className="relative z-10 flex-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-white/15 backdrop-blur-sm rounded-xl border border-white/10">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm">AI 정비 어드바이저</span>
              </div>
              <h4 className="text-lg font-extrabold mb-3 leading-snug">
                기계 증상을<br />물어보세요
              </h4>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 text-xs border border-white/10 leading-relaxed text-white/90">
                "유압 압력이 불규칙할 때는 펌프 입구 스트레이너 막힘을 먼저 확인하세요..."
              </div>
            </div>
            <Link
              to="/chat"
              className="mt-5 w-full py-2.5 bg-white text-primary font-bold rounded-xl hover:bg-white/92 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-sm shadow-lg shadow-black/10"
            >
              AI 상담 시작 <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 최근 입고 기계 ── */}
      <GlowCard>
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-sm">최근 입고 기계</h3>
          <Link to="/machines" className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5">
            전체보기 <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">입고 기계가 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {recentEntries.map((m) => (
                <Link
                  key={m.id}
                  to={`/machines/${m.id}`}
                  className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <Tractor className="h-4.5 w-4.5 text-emerald-600" />
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
        </div>
      </GlowCard>
    </div>
  );
}
