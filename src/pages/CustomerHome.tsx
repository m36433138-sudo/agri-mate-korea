import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { formatDate } from "@/lib/formatters";
import { Tractor, Wrench, ChevronRight, MessageSquare, User, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import type { Machine, Repair } from "@/types/database";

export default function CustomerHome() {
  const { userId, profile } = useUserRole();

  const { data: customer, isLoading: cl } = useQuery({
    queryKey: ["my-customer", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
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

  const { data: recentRepairs, isLoading: rl } = useQuery({
    queryKey: ["my-recent-repairs", customerId],
    enabled: machineIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repairs")
        .select("*, machines(model_name)")
        .in("machine_id", machineIds)
        .order("repair_date", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const loading = cl || ml;
  const displayName = profile?.display_name || customer?.name || "고객";

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "좋은 아침이에요" : now.getHours() < 18 ? "안녕하세요" : "좋은 저녁이에요";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Welcome Section */}
      <div className="pt-2">
        <p className="text-sm text-muted-foreground">{greeting} 👋</p>
        <h1 className="text-2xl font-bold mt-1">
          {loading ? <Skeleton className="h-8 w-48" /> : `${displayName}님`}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-card rounded-2xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10">
              <Tractor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">보유 기계</p>
              {loading ? (
                <Skeleton className="h-7 w-12 mt-0.5" />
              ) : (
                <p className="text-2xl font-bold">{machines?.length ?? 0}대</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card rounded-2xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-warning/10">
              <Wrench className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">수리 이력</p>
              {loading || rl ? (
                <Skeleton className="h-7 w-12 mt-0.5" />
              ) : (
                <p className="text-2xl font-bold">{recentRepairs?.length ?? 0}건</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/my-page">
          <Card className="border-0 shadow-card rounded-2xl hover:shadow-card-hover transition-shadow cursor-pointer group">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">내 기계 · 수리 이력</p>
                  <p className="text-xs text-muted-foreground">상세 내역 확인하기</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/chat">
          <Card className="border-0 shadow-card rounded-2xl hover:shadow-card-hover transition-shadow cursor-pointer group">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-info/10">
                  <MessageSquare className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="font-semibold text-sm">AI 정비 상담</p>
                  <p className="text-xs text-muted-foreground">기계 증상을 물어보세요</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-info transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Repairs */}
      <Card className="border-0 shadow-card rounded-2xl">
        <div className="p-5 border-b flex justify-between items-center">
          <h3 className="font-bold text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            최근 정비 내역
          </h3>
          <Link to="/my-page" className="text-sm text-primary font-semibold hover:underline flex items-center gap-0.5">
            전체보기 <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <CardContent className="p-5">
          {rl || loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !recentRepairs || recentRepairs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">아직 정비 이력이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {recentRepairs.map((r: any) => (
                <div key={r.id} className="p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.repair_content}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.machines?.model_name} · {formatDate(r.repair_date)}
                      </p>
                    </div>
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

      {/* No customer linked notice */}
      {!loading && !customer && (
        <Card className="border-0 shadow-card rounded-2xl border-l-4 border-l-warning">
          <CardContent className="p-5">
            <p className="text-sm font-medium">고객 정보 미연결</p>
            <p className="text-xs text-muted-foreground mt-1">
              아직 계정에 연결된 고객 정보가 없습니다. 관리자에게 문의해주세요.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
