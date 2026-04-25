import { forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronRight, Tractor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { measureQuery } from "@/lib/queryProfiler";
import { Skeleton } from "@/components/ui/skeleton";
import { TypeBadge } from "@/components/StatusBadge";
import { formatDate, formatPrice } from "@/lib/formatters";

const GlassCard = forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
  ({ children, className = "" }, ref) => (
    <div ref={ref} className={`rounded-2xl border border-border/60 bg-card ${className}`}>
      {children}
    </div>
  )
);
GlassCard.displayName = "GlassCard";

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    재고중: "bg-emerald-500",
    판매완료: "bg-muted-foreground",
    수리중: "bg-amber-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? "bg-muted-foreground"}`} />;
}

export default function RecentMachinesWidget() {
  useRealtimeSync("machines", [["machines-recent"]]);

  const { data: recentEntries = [], isLoading } = useQuery({
    queryKey: ["machines-recent"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await measureQuery("machines-recent", () =>
        supabase
          .from("machines")
          .select("id, model_name, serial_number, entry_date, status, machine_type, purchase_price")
          .eq("status", "재고중")
          .order("entry_date", { ascending: false })
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
        {isLoading ? (
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
  );
}
