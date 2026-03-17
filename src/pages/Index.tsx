import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Tractor, ShoppingCart, Wrench, Users, Package,
  TrendingUp, ArrowUpRight, Clock, CheckCircle2, AlertTriangle,
  ChevronRight, MessageSquare, BookOpen
} from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatters";
import { TypeBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";

export default function Dashboard() {
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

  const { data: customers } = useQuery({
    queryKey: ["customers-count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id");
      if (error) throw error;
      return data;
    },
  });

  const { data: parts } = useQuery({
    queryKey: ["parts-count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts").select("id");
      if (error) throw error;
      return data;
    },
  });

  const loading = ml || rl;
  const inStock = machines?.filter((m) => m.status === "재고중") ?? [];
  const newMachines = inStock.filter((m) => m.machine_type === "새기계");
  const usedMachines = inStock.filter((m) => m.machine_type === "중고기계");

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const salesThisMonth = machines?.filter((m) => m.sale_date?.startsWith(thisMonth)).length ?? 0;
  const repairsThisMonth = repairs?.filter((r) => r.repair_date.startsWith(thisMonth)).length ?? 0;

  const recentEntries = machines
    ?.filter((m) => m.status === "재고중")
    .sort((a, b) => (b.entry_date > a.entry_date ? 1 : -1))
    .slice(0, 5) ?? [];

  const stats = [
    { label: "전체 고객", value: loading ? null : `${customers?.length ?? 0}명`, icon: Users, color: "text-info", bg: "bg-info/10" },
    { label: "재고 기계", value: loading ? null : `${inStock.length}대`, sub: `새기계 ${newMachines.length} / 중고 ${usedMachines.length}`, icon: Tractor, color: "text-primary", bg: "bg-primary/10" },
    { label: "이번 달 수리", value: loading ? null : `${repairsThisMonth}건`, icon: Wrench, color: "text-warning", bg: "bg-warning/10" },
    { label: "등록 부품", value: loading ? null : `${parts?.length ?? 0}종`, icon: Package, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">오늘의 업무 현황</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <Card key={i} className="border-0 shadow-card hover:shadow-card-hover transition-shadow rounded-2xl">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div className={`p-3 rounded-2xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              {stat.value === null ? (
                <Skeleton className="h-7 w-20 mt-1" />
              ) : (
                <p className="text-2xl font-bold mt-0.5">{stat.value}</p>
              )}
              {stat.sub && <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Repairs */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-card rounded-2xl overflow-hidden">
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="font-bold text-base">최근 정비 내역</h3>
              <Link to="/repairs" className="text-sm text-primary font-semibold hover:underline flex items-center gap-0.5">
                전체보기 <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : repairs?.length === 0 ? (
                <p className="text-sm text-muted-foreground p-5 text-center">수리 이력이 없습니다.</p>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-muted/50">
                    <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="px-5 py-3">기계</th>
                      <th className="px-5 py-3">작업 내용</th>
                      <th className="px-5 py-3">비용</th>
                      <th className="px-5 py-3 text-right">날짜</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {repairs?.map((r: any) => (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold">{r.machines?.model_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{r.machines?.serial_number}</p>
                        </td>
                        <td className="px-5 py-3.5 text-sm">{r.repair_content}</td>
                        <td className="px-5 py-3.5 text-sm font-medium tabular-nums">
                          {r.total_cost > 0 ? formatPrice(r.total_cost) : "-"}
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">
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

        {/* AI Advisor Card */}
        <Card className="border-0 rounded-2xl overflow-hidden bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
          <CardContent className="p-6 flex flex-col h-full relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <BookOpen className="h-28 w-28" />
            </div>
            <div className="relative z-10 flex-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-primary-foreground/20 rounded-lg">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <span className="font-bold text-sm">AI 정비 어드바이저</span>
              </div>
              <h4 className="text-lg font-bold mb-3">기계의 증상을 물어보세요</h4>
              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-4 text-sm border border-primary-foreground/10 leading-relaxed">
                "유압 압력이 불규칙할 때는 먼저 펌프 입구 쪽의 스트레이너(Strainer) 막힘을 의심해야 합니다..."
              </div>
            </div>
            <Link
              to="/chat"
              className="mt-5 w-full py-3 bg-primary-foreground text-primary font-bold rounded-xl hover:bg-primary-foreground/90 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              AI 상담 시작 <ChevronRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Entries */}
      <Card className="border-0 shadow-card rounded-2xl">
        <div className="p-5 border-b flex justify-between items-center">
          <h3 className="font-bold text-base">최근 입고 기계</h3>
          <Link to="/machines" className="text-sm text-primary font-semibold hover:underline flex items-center gap-0.5">
            전체보기 <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <CardContent className="p-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">입고 기계가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {recentEntries.map((m) => (
                <Link
                  key={m.id}
                  to={`/machines/${m.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{m.model_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{m.serial_number} · {formatDate(m.entry_date)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <TypeBadge type={m.machine_type} />
                    <span className="text-sm font-bold tabular-nums">{formatPrice(m.purchase_price)}</span>
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
