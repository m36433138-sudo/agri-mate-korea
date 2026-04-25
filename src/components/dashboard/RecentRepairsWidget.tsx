import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Activity, ChevronRight, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { measureQuery } from "@/lib/queryProfiler";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatPrice } from "@/lib/formatters";

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/60 bg-card ${className}`}>{children}</div>
  );
}

export default function RecentRepairsWidget() {
  useRealtimeSync("repairs", [["repairs-recent"]]);

  const { data: repairs, isLoading } = useQuery({
    queryKey: ["repairs-recent"],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      // idx_repairs_repair_date_created_at (repair_date DESC, created_at DESC) 인덱스 활용
      const { data, error } = await measureQuery("repairs-recent", () =>
        supabase
          .from("repairs")
          .select("id, repair_date, created_at, repair_content, total_cost, machines!repairs_machine_id_fkey(model_name, serial_number)")
          .order("repair_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5)
      );
      if (error) throw error;
      return data;
    },
  });

  return (
    <GlassCard className="lg:col-span-3 overflow-hidden">
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
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : !repairs || repairs.length === 0 ? (
          <p className="text-sm text-muted-foreground p-10 text-center">수리 이력이 없습니다.</p>
        ) : (
          <div className="divide-y divide-border/30">
            {repairs.slice(0, 6).map((r: any) => (
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
  );
}
