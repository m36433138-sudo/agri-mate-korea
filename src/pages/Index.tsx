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
        .from("repairs")
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

  const recentEntries = machines
    ?.filter((m) => m.status === "재고중")
    .sort((a, b) => (b.entry_date > a.entry_date ? 1 : -1))
    .slice(0, 5) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">대시보드</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <SummaryCard icon={Tractor} label="전체 재고" value={loading ? null : `${inStock.length}대`} sub={`새기계 ${newMachines.length} / 중고 ${usedMachines.length}`} />
        <SummaryCard icon={ShoppingCart} label="이번 달 판매" value={loading ? null : `${salesThisMonth}건`} />
        <SummaryCard icon={Wrench} label="이번 달 수리" value={loading ? null : `${repairsThisMonth}건`} />
      </div>

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
                {repairs?.map((r: any) => (
                  <Link key={r.id} to={`/machines/${r.machine_id}`} className="flex items-start justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.repair_content}</p>
                      <p className="text-xs text-muted-foreground">{r.machines?.model_name} · {formatDate(r.repair_date)}</p>
                    </div>
                    {r.total_cost > 0 && <span className="text-sm font-medium tabular-nums ml-2 shrink-0">{formatPrice(r.total_cost)}</span>}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">최근 입고 기계</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSkeleton />
            ) : recentEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">입고 기계가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {recentEntries.map((m) => (
                  <Link key={m.id} to={`/machines/${m.id}`} className="flex items-start justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.model_name}</p>
                      <p className="text-xs text-muted-foreground">{m.serial_number} · {formatDate(m.entry_date)}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <TypeBadge type={m.machine_type} />
                    </div>
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
