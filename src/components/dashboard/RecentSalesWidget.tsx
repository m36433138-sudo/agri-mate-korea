import { forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronRight, BadgeDollarSign } from "lucide-react";
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

export default function RecentSalesWidget() {
  useRealtimeSync("machines", [["machines-recent-sales"]]);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["machines-recent-sales"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      // idx_machines_sale_date (sale_date DESC) WHERE sale_date IS NOT NULL 부분 인덱스 활용
      const { data, error } = await measureQuery("machines-recent-sales", () =>
        supabase
          .from("machines")
          .select("id, model_name, serial_number, sale_date, sale_price, machine_type, customers(name)")
          .not("sale_date", "is", null)
          .order("sale_date", { ascending: false })
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
          <BadgeDollarSign className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-bold text-sm">최근 판매 기계</h3>
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
        ) : sales.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">판매 내역이 없습니다.</p>
        ) : (
          <div className="space-y-1">
            {sales.map((m: any) => (
              <Link
                key={m.id}
                to={`/machines/${m.id}`}
                className="flex items-center justify-between px-3 py-3 rounded-2xl hover:bg-accent/40 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{m.model_name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {m.customers?.name ?? "—"} · {formatDate(m.sale_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 ml-2 shrink-0">
                  <TypeBadge type={m.machine_type} />
                  {m.sale_price ? (
                    <span className="text-sm font-bold tabular-nums hidden sm:block">
                      {formatPrice(m.sale_price)}
                    </span>
                  ) : null}
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
