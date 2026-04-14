import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
import { formatPrice, formatDate } from "@/lib/formatters";
import { useUserRole } from "@/hooks/useUserRole";
import { Tractor, Wrench, User } from "lucide-react";
import { MyAssignments } from "@/components/MyAssignments";
import type { Customer, Machine, Repair } from "@/types/database";

export default function MyPage() {
  const { userId, role, profile } = useUserRole();

  // 직원인 경우 employees 테이블에서 employee_id 조회
  const { data: employee } = useQuery({
    queryKey: ["my-employee", userId],
    enabled: !!userId && (role === "admin" || role === "employee"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  // First find the customer record linked to this user
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ["my-customer", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    },
  });

  const customerId = customer?.id;

  const { data: machines, isLoading: ml } = useQuery({
    queryKey: ["my-machines", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .eq("customer_id", customerId!)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data as Machine[];
    },
  });

  const machineIds = machines?.map((m) => m.id) ?? [];

  const { data: repairs, isLoading: rl } = useQuery({
    queryKey: ["my-repairs", customerId],
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

  const isLoading = customerLoading || ml;

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
              <h2 className="text-xl font-bold">{profile?.display_name || customer?.name || "사용자"}</h2>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              {(profile?.phone || customer?.phone) && (
                <p className="text-sm text-muted-foreground">{profile?.phone || customer?.phone}</p>
              )}
              {customer?.address && (
                <p className="text-sm text-muted-foreground">{customer.address}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 직원 배정 작업 (admin/employee만) */}
      {(role === "admin" || role === "employee") && (
        <MyAssignments employeeId={employee?.id ?? null} />
      )}

      {/* My Machines */}
      <Card className="shadow-card border-0 mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Tractor className="h-4 w-4" /> 내 기계
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !customer ? (
            <p className="text-sm text-muted-foreground py-4 text-center">연결된 고객 정보가 없습니다. 관리자에게 문의해주세요.</p>
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
