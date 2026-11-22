import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Skeleton } from "@/components/ui/skeleton";
import MessengerFeedCard from "@/components/dashboard/MessengerFeedCard";
import { Panel } from "@/components/dashboard/Panel";
import {
  Tractor, Wrench, ChevronRight, ClipboardList, Truck, TrendingUp, Sparkles, Plus, FileWarning, Wallet,
  type LucideIcon,
} from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatters";
import { TypeBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useFinance } from "@/hooks/useFinance";
import { useUserRole } from "@/hooks/useUserRole";
import { outstandingOf } from "@/types/workspace";
import { cn } from "@/lib/utils";

/** 금액을 "1,234만" 처럼 짧게 */
function shortWon(n: number) {
  if (n >= 100000000) return { value: (n / 100000000).toFixed(1).replace(/\.0$/, ""), unit: "억원" };
  if (n >= 10000) return { value: Math.round(n / 10000).toLocaleString("ko-KR"), unit: "만원" };
  return { value: n.toLocaleString("ko-KR"), unit: "원" };
}

function KpiCard({
  label, value, unit, sub, to, icon: Icon, tone = "default", loading,
}: {
  label: string; value: string | number; unit: string; sub?: string; to: string; icon: LucideIcon;
  tone?: "default" | "warn"; loading?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl bg-card border border-border/70 card-shadow p-4 sm:p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] sm:text-sm font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center",
            tone === "warn" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-24 rounded-lg" />
      ) : (
        <p className="flex items-baseline gap-1">
          <span
            className={cn(
              "text-[28px] sm:text-[32px] leading-none font-extrabold tracking-tight tabular-nums",
              tone === "warn" && Number(value) > 0 && "text-amber-600 dark:text-amber-400",
            )}
          >
            {value}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">{unit}</span>
        </p>
      )}
      <p className="text-xs text-muted-foreground flex items-center justify-between">
        <span className="truncate">{sub ?? " "}</span>
        <ChevronRight className="h-4 w-4 shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
      </p>
    </Link>
  );
}

export default function Dashboard() {
  useRealtimeSync("machines", [["machines"]]);
  useRealtimeSync("repairs", [["repairs-recent"], ["dashboard-repair-counts"]]);
  const { profile } = useUserRole();
  const { finance, isLoading: fl } = useFinance();
  const receivables = finance.filter((f) => f.record_type === "receivable" && !f.is_paid);
  const receivableOutstanding = receivables.reduce((s, f) => s + outstandingOf(f), 0);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

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
        .select("*, machines(model_name, serial_number, customers(name))")
        .order("repair_date", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  // 숫자는 최근 8건이 아니라 DB에서 직접 센다 (이전에는 최근 8건 중 이번 달만 세서 실제보다 적게 나왔다)
  const { data: counts, isLoading: cl } = useQuery({
    queryKey: ["dashboard-repair-counts", monthStart],
    queryFn: async () => {
      const [month, unposted] = await Promise.all([
        supabase.from("repairs").select("id", { count: "exact", head: true }).gte("repair_date", monthStart),
        supabase.from("repairs").select("id", { count: "exact", head: true }).or("accounting_posted.is.null,accounting_posted.eq.false"),
      ]);
      if (month.error) throw month.error;
      if (unposted.error) throw unposted.error;
      return { month: month.count ?? 0, unposted: unposted.count ?? 0 };
    },
    staleTime: 1000 * 60,
  });

  const inStock = machines?.filter((m) => m.status === "재고중") ?? [];
  const newMachines = inStock.filter((m) => m.machine_type === "새기계");
  const usedMachines = inStock.filter((m) => m.machine_type === "중고기계");

  const recentEntries = useMemo(
    () => [...inStock].sort((a, b) => (b.entry_date > a.entry_date ? 1 : -1)).slice(0, 5),
    [machines], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const won = shortWon(receivableOutstanding);
  const hour = now.getHours();
  const hello = hour < 11 ? "좋은 아침이에요" : hour < 17 ? "안녕하세요" : "오늘도 수고 많으셨어요";

  const quickActions: { label: string; icon: LucideIcon; to: string }[] = [
    { label: "작업현황판", icon: ClipboardList, to: "/dashboard/operations" },
    { label: "방문수리 접수", icon: Truck, to: "/onsite-repairs" },
    { label: "실적 현황", icon: TrendingUp, to: "/dashboard/stats" },
    { label: "AI 어시스턴트", icon: Sparkles, to: "/chat" },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 인사 */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
          </p>
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight mt-1">
            {hello}{profile?.display_name ? `, ${profile.display_name}님` : ""}
          </h1>
        </div>
        <Link
          to="/repairs?new=1"
          className="hidden sm:inline-flex items-center gap-1.5 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> 수리 등록
        </Link>
      </div>

      {/* 오늘 챙길 숫자 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="미기표 수리" value={counts?.unposted ?? 0} unit="건" icon={FileWarning} tone="warn"
          sub="전산 기표가 남은 수리" to="/repairs?accounting=unposted" loading={cl}
        />
        <KpiCard
          label="미수금 잔액" value={won.value} unit={won.unit} icon={Wallet}
          sub={`${receivables.length}건 남음`} to="/receivables" loading={fl}
        />
        <KpiCard
          label="이번 달 수리" value={counts?.month ?? 0} unit="건" icon={Wrench}
          sub={`${now.getMonth() + 1}월 1일부터`} to="/repairs" loading={cl}
        />
        <KpiCard
          label="재고 기계" value={inStock.length} unit="대" icon={Tractor}
          sub={`새 ${newMachines.length} · 중고 ${usedMachines.length}`} to="/machines" loading={ml}
        />
      </div>

      {/* 바로가기 */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:flex-wrap">
        {quickActions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-card border border-border/70 text-sm font-medium hover:border-primary/40 hover:text-primary transition-colors"
          >
            <a.icon className="h-4 w-4 text-primary" />
            {a.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* 최근 정비 내역 */}
        <Panel title="최근 정비 내역" to="/repairs" className="lg:col-span-2">
          {rl ? (
            <div className="space-y-2 px-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
          ) : !repairs?.length ? (
            <p className="text-sm text-muted-foreground py-10 text-center">수리 이력이 없습니다.</p>
          ) : (
            <div>
              {repairs.slice(0, 6).map((r: any) => (
                <Link
                  key={r.id}
                  to={r.machine_id ? `/machines/${r.machine_id}` : "/repairs"}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-accent/60 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Wrench className="h-[18px] w-[18px] text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold truncate">
                      {r.machines?.model_name ?? "기계 미지정"}
                      {r.machines?.customers?.name && (
                        <span className="text-[13px] font-normal text-muted-foreground"> · {r.machines.customers.name}</span>
                      )}
                    </p>
                    <p className="text-[13px] text-muted-foreground truncate mt-0.5">{r.repair_content}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {r.total_cost > 0 && <p className="text-[15px] font-bold tabular-nums">{formatPrice(r.total_cost)}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(r.repair_date)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4 sm:space-y-5">
          <MessengerFeedCard limit={4} />

          {/* AI 상담 */}
          <Link
            to="/chat"
            className="group flex items-center gap-4 rounded-2xl bg-primary text-primary-foreground p-5 hover:bg-primary/95 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[15px]">AI 정비 어드바이저</p>
              <p className="text-[13px] text-primary-foreground/80 mt-0.5">증상을 적으면 점검 순서를 알려드려요</p>
            </div>
            <ChevronRight className="h-5 w-5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* 최근 입고 기계 */}
      <Panel title="최근 입고 기계" to="/machines">
        {ml ? (
          <div className="space-y-2 px-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        ) : recentEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">입고 기계가 없습니다.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-1">
            {recentEntries.map((m) => (
              <Link
                key={m.id}
                to={`/machines/${m.id}`}
                className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl hover:bg-accent/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Tractor className="h-[18px] w-[18px] text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold truncate">{m.model_name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {m.serial_number} · {formatDate(m.entry_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <TypeBadge type={m.machine_type} />
                  <span className="text-[15px] font-bold tabular-nums hidden lg:block">{formatPrice(m.purchase_price)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
