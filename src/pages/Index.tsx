import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tractor, ShoppingCart, Wrench } from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatters";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
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
        .from("repair_history")
        .select("*, machines(model_name, serial_number)")
        .order("repair_date", { ascending: false })
        .limit(5);
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

  const recentSales = machines
    ?.filter((m) => m.status === "판매완료" && m.sale_date)
    .sort((a, b) => (b.sale_date! > a.sale_date! ? 1 : -1))
    .slice(0, 5) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">대시보드</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard icon={Tractor} label="전체 재고" value={loading ? null : `${inStock.length}대`} sub={`새기계 ${newMachines.length} / 중고 ${usedMachines.length}`} />
        <SummaryCard icon={ShoppingCart} label="이번 달 판매" value={loading ? null : `${salesThisMonth}건`} />
        <SummaryCard icon={Wrench} label="이번 달 수리" value={loading ? null : `${repairsThisMonth}건`} />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">최근 수리 이력</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSkeleton />
            ) : repairs?.length === 0 ? (
              <p className="text-sm text-muted-foreground">수리 이력이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {repairs?.map((r) => (
                  <Link key={r.id} to={`/machines/${r.machine_id}`} className="flex items-start justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.repair_content}</p>
                      <p className="text-xs text-muted-foreground">{(r.machines as any)?.model_name} · {formatDate(r.repair_date)}</p>
                    </div>
                    {r.cost && <span className="text-sm font-medium tabular-nums ml-2 shrink-0">{formatPrice(r.cost)}</span>}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">최근 판매</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSkeleton />
            ) : recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground">판매 이력이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {recentSales.map((m) => (
                  <Link key={m.id} to={`/machines/${m.id}`} className="flex items-start justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.model_name}</p>
                      <p className="text-xs text-muted-foreground">{m.serial_number} · {formatDate(m.sale_date!)}</p>
                    </div>
                    {m.sale_price && <span className="text-sm font-bold tabular-nums ml-2 shrink-0 text-primary">{formatPrice(m.sale_price)}</span>}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | null; sub?: string }) {
  return (
    <Card className="shadow-card border-0">
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            {value === null ? <Skeleton className="h-6 w-16 mt-1" /> : <p className="text-xl font-bold">{value}</p>}
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
    </div>
  );
}
