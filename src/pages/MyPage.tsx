import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
import { formatPrice, formatDate } from "@/lib/formatters";
import { useUserRole } from "@/hooks/useUserRole";
import { Tractor, Wrench, User } from "lucide-react";

export default function MyPage() {
  const { userId, profile } = useUserRole();

  const { data: machines, isLoading: ml } = useQuery({
    queryKey: ["my-machines", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .eq("customer_id", userId!)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const machineIds = machines?.map((m) => m.id) ?? [];

  const { data: repairs, isLoading: rl } = useQuery({
    queryKey: ["my-repairs", userId],
    enabled: machineIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repairs")
        .select("*, machines(model_name, serial_number)")
        .in("machine_id", machineIds)
        .order("repair_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">마이페이지</h1>

      {/* Profile Card */}
      <Card className="shadow-card border-0 mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile?.display_name || "사용자"}</h2>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              {profile?.phone && <p className="text-sm text-muted-foreground">{profile.phone}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Machines */}
      <Card className="shadow-card border-0 mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Tractor className="h-4 w-4" /> 내 기계
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ml ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !machines || machines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">등록된 기계가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {machines.map((m) => (
                <div key={m.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{m.model_name}</p>
                      <p className="text-sm text-muted-foreground font-mono">{m.serial_number}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TypeBadge type={m.machine_type} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t">
                    {m.sale_date && (
                      <div>
                        <p className="text-xs text-muted-foreground">구매일</p>
                        <p className="text-sm font-medium">{formatDate(m.sale_date)}</p>
                      </div>
                    )}
                    {m.sale_price && (
                      <div>
                        <p className="text-xs text-muted-foreground">구매가</p>
                        <p className="text-sm font-medium">{formatPrice(m.sale_price)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Repair History */}
      <Card className="shadow-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4" /> 수리 이력
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rl ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !repairs || repairs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">수리 이력이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {repairs.map((r: any) => (
                <div key={r.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{r.repair_content}</p>
                      <p className="text-sm text-muted-foreground">
                        {r.machines?.model_name} · {formatDate(r.repair_date)}
                      </p>
                    </div>
                    {r.total_cost > 0 && (
                      <span className="text-sm font-bold tabular-nums">{formatPrice(r.total_cost)}</span>
                    )}
                  </div>
                  {r.technician && (
                    <p className="text-xs text-muted-foreground mt-2">담당: {r.technician}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
