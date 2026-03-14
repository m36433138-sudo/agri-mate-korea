import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
import { formatPrice, formatDate } from "@/lib/formatters";
import { ArrowLeft } from "lucide-react";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: machines } = useQuery({
    queryKey: ["customer-machines", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("*").eq("customer_id", id!).order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const machineIds = machines?.map(m => m.id) ?? [];

  const { data: repairs } = useQuery({
    queryKey: ["customer-repairs", id],
    enabled: machineIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("repair_history").select("*, machines(model_name)").in("machine_id", machineIds).order("repair_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /></div>;
  if (!customer) return <p className="text-muted-foreground">고객을 찾을 수 없습니다.</p>;

  return (
    <div>
      <Link to="/customers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> 고객 목록
      </Link>

      <Card className="shadow-card border-0 mb-6">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div><p className="text-xs text-muted-foreground">연락처</p><p className="font-medium">{customer.phone}</p></div>
            <div><p className="text-xs text-muted-foreground">주소</p><p className="font-medium">{customer.address || "-"}</p></div>
            {customer.notes && <div><p className="text-xs text-muted-foreground">비고</p><p className="font-medium">{customer.notes}</p></div>}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card border-0 mb-6">
        <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">보유/구매 기계</CardTitle></CardHeader>
        <CardContent>
          {machines?.length === 0 ? (
            <p className="text-sm text-muted-foreground">구매 기계가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {machines?.map(m => (
                <Link key={m.id} to={`/machines/${m.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{m.model_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{m.serial_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TypeBadge type={m.machine_type} />
                    {m.sale_date && <span className="text-xs text-muted-foreground">{formatDate(m.sale_date)}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card border-0">
        <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">수리 이력</CardTitle></CardHeader>
        <CardContent>
          {!repairs || repairs.length === 0 ? (
            <p className="text-sm text-muted-foreground">수리 이력이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {repairs.map(r => (
                <div key={r.id} className="p-3 rounded-lg bg-muted/30">
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">{r.repair_content}</p>
                    {r.cost != null && <span className="text-sm tabular-nums font-medium">{formatPrice(r.cost)}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{(r.machines as any)?.model_name} · {formatDate(r.repair_date)}{r.technician ? ` · ${r.technician}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
