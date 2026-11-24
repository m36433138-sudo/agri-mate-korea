import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Skeleton } from "@/components/ui/skeleton";
import MessengerFeedCard from "@/components/dashboard/MessengerFeedCard";
import { AttendanceCard } from "@/components/dashboard/AttendanceCard";
import { InstallAppBanner } from "@/components/dashboard/InstallAppBanner";
import { LiveStaffPanel } from "@/components/dashboard/LiveStaffPanel";
import { Panel } from "@/components/dashboard/Panel";
import { SalesTrendChart } from "@/components/dashboard/SalesTrendChart";
import { AiAssistantCard, DeltaChip, KpiCard, TechnicianLoad } from "@/components/dashboard/DashboardBits";
import {
  Tractor, Wrench, ClipboardList, Truck, TrendingUp, Plus, FileWarning, Wallet, Coins, CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatters";
import { TypeBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useFinance } from "@/hooks/useFinance";
import { useUserRole } from "@/hooks/useUserRole";
import { outstandingOf } from "@/types/workspace";
import { buildRepairTrend, trendStart, type TrendRow } from "@/lib/repairTrend";

/** 금액을 "1,234만" 처럼 짧게 */
function shortWon(n: number) {
  if (n >= 100000000) return { value: (n / 100000000).toFixed(1).replace(/\.0$/, ""), unit: "억원" };
  if (n >= 10000) return { value: Math.round(n / 10000).toLocaleString("ko-KR"), unit: "만원" };
  return { value: n.toLocaleString("ko-KR"), unit: "원" };
}

const AI_SUGGESTIONS = ["이번 달 판매 실적은 어떤가요?", "수리 이력을 요약해 주세요", "현재 재고 현황을 알려주세요"];

export default function Dashboard() {
  useRealtimeSync("machines", [["machines"]]);
  useRealtimeSync("repairs", [["repairs-recent"], ["dashboard-repair-counts"], ["dashboard-repair-trend"]]);
  const { profile } = useUserRole();
  const { finance, isLoading: fl } = useFinance();
  const receivables = finance.filter((f) => f.record_type === "receivable" && !f.is_paid);
  const receivableOutstanding = receivables.reduce((s, f) => s + outstandingOf(f), 0);

  const now = new Date();
  const start = trendStart(now);

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

  // 최근 12개월 수리 (그래프 · 이번 달/지난달 비교). Data API 1000행 제한을 넘도록 범위로 나눠 받는다.
  const { data: trendRows, isLoading: tl } = useQuery({
    queryKey: ["dashboard-repair-trend", start],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const out: TrendRow[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("repairs")
          .select("id, repair_date, labor_cost, total_cost, technician")
          .gte("repair_date", start)
          .order("repair_date")
          .order("id")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...((data ?? []) as TrendRow[]));
        if (!data || data.length < PAGE) break;
      }
      return out;
    },
  });

  const { data: unposted, isLoading: ul } = useQuery({
    queryKey: ["dashboard-repair-counts"],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("repairs")
        .select("id", { count: "exact", head: true })
        .or("accounting_posted.is.null,accounting_posted.eq.false");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const trend = useMemo(() => buildRepairTrend(trendRows ?? [], now), [trendRows]); // eslint-disable-line react-hooks/exhaustive-deps

  const inStock = machines?.filter((m) => m.status === "재고중") ?? [];
  const newMachines = inStock.filter((m) => m.machine_type === "새기계");
  const usedMachines = inStock.filter((m) => m.machine_type === "중고기계");
  const recentEntries = useMemo(
    () => [...inStock].sort((a, b) => (b.entry_date > a.entry_date ? 1 : -1)).slice(0, 5),
    [machines], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const sales = shortWon(trend.thisMonth.total);
  const won = shortWon(receivableOutstanding);
  const yearTotal = trend.months.reduce((s, m) => s + m.total, 0);
  const hour = now.getHours();
  const hello = hour < 11 ? "좋은 아침이에요" : hour < 17 ? "안녕하세요" : "오늘도 수고 많으셨어요";

  const quickActions: { label: string; icon: LucideIcon; to: string }[] = [
    { label: "작업현황판", icon: ClipboardList, to: "/dashboard/operations" },
    { label: "방문수리 접수", icon: Truck, to: "/onsite-repairs" },
    { label: "실적 현황", icon: TrendingUp, to: "/dashboard/stats" },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 인사 */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight">
            {hello}{profile?.display_name ? `, ${profile.display_name}님!` : "!"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">오늘도 안전한 정비 되세요. 챙길 일부터 보여드릴게요.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-2 h-11 px-4 rounded-full bg-card border border-border/70 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            {now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
          </span>
          <Link
            to="/repairs?new=1"
            className="hidden sm:inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> 수리 등록
          </Link>
        </div>
      </div>

      <InstallAppBanner />

      {/* 출퇴근 + 지금 근무 중(위치 공유) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        <div className="lg:col-span-5"><AttendanceCard /></div>
        <div className="lg:col-span-7"><LiveStaffPanel /></div>
      </div>

      {/* 1줄: AI 카드 + 숫자 카드 4개 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        <div className="lg:col-span-8 grid grid-cols-2 gap-3 sm:gap-4 content-start order-1 lg:order-2">
          <KpiCard
            label="이번 달 수리 매출" icon={Coins} value={sales.value} unit={sales.unit} loading={tl}
            chip={<DeltaChip pct={trend.totalChange} />} sub={`지난달 이맘때 ${shortWon(trend.lastMonthToDate.total).value}${shortWon(trend.lastMonthToDate.total).unit}`} to="/dashboard/stats"
          />
          <KpiCard
            label="이번 달 수리" icon={Wrench} value={trend.thisMonth.count} unit="건" loading={tl}
            chip={<DeltaChip pct={trend.countChange} />} sub={`지난달 이맘때 ${trend.lastMonthToDate.count}건`} to="/repairs"
          />
          <KpiCard
            label="미수금 잔액" icon={Wallet} value={won.value} unit={won.unit} loading={fl}
            sub={`${receivables.length}건 남음`} to="/receivables"
          />
          <KpiCard
            label="미기표 수리" icon={FileWarning} value={unposted ?? 0} unit="건" loading={ul} warn={(unposted ?? 0) > 0}
            sub="전산 기표가 남은 수리" to="/repairs?accounting=unposted"
          />
        </div>
        <AiAssistantCard suggestions={AI_SUGGESTIONS} className="lg:col-span-4 min-h-[300px] order-2 lg:order-1" />
      </div>

      {/* 2줄: 매출 그래프 + 기사별 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        <Panel
          title="월별 수리 매출"
          className="lg:col-span-8"
          to="/dashboard/stats"
          linkLabel="실적 현황"
          bodyClassName="px-4 pb-4"
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 pb-2 text-sm">
            <span className="text-muted-foreground">최근 12개월 <b className="text-foreground tabular-nums">{formatPrice(yearTotal)}</b></span>
            <span className="flex items-center gap-1.5 text-muted-foreground"><i className="w-2.5 h-2.5 rounded-full bg-chart-1" />수리 매출</span>
            <span className="flex items-center gap-1.5 text-muted-foreground"><i className="w-2.5 h-2.5 rounded-full bg-chart-2" />공임비</span>
          </div>
          {tl ? <Skeleton className="h-[260px] w-full rounded-2xl" /> : <SalesTrendChart data={trend.months} height={260} />}
        </Panel>
        <Panel title="이번 달 기사별 수리" className="lg:col-span-4" bodyClassName="px-2 pb-5">
          <TechnicianLoad items={trend.technicians} loading={tl} />
        </Panel>
      </div>

      {/* 바로가기 */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:flex-wrap">
        {quickActions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-card border border-border/70 text-sm font-medium hover:border-foreground/25 transition-colors"
          >
            <a.icon className="h-4 w-4 text-primary" />
            {a.label}
          </Link>
        ))}
      </div>

      {/* 3줄: 최근 정비 + 메신저 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        <Panel title="최근 정비 내역" to="/repairs" className="lg:col-span-8">
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
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-foreground/[0.04] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-foreground/[0.06] flex items-center justify-center shrink-0">
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
        <MessengerFeedCard limit={5} className="lg:col-span-4" />
      </div>

      {/* 4줄: 재고 기계 */}
      <Panel
        title="최근 입고 기계"
        to="/machines"
        badge={!ml ? (
          <span className="text-xs font-medium text-muted-foreground">재고 {inStock.length}대 · 새 {newMachines.length} · 중고 {usedMachines.length}</span>
        ) : undefined}
      >
        {ml ? (
          <div className="space-y-2 px-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        ) : recentEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">입고 기계가 없습니다.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3">
            {recentEntries.map((m) => (
              <Link
                key={m.id}
                to={`/machines/${m.id}`}
                className="flex items-center justify-between gap-3 px-3 py-3 rounded-2xl hover:bg-foreground/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Tractor className="h-[18px] w-[18px] text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold truncate">{m.model_name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{m.serial_number} · {formatDate(m.entry_date)}</p>
                  </div>
                </div>
                <TypeBadge type={m.machine_type} />
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
