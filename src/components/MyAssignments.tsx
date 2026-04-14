import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Tractor } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  입고대기: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  수리대기: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  수리중:   "bg-sky-500/15 text-sky-400 ring-sky-500/30",
  수리완료: "bg-teal-500/15 text-teal-400 ring-teal-500/30",
  출고대기: "bg-green-500/15 text-green-400 ring-green-500/30",
  보류:     "bg-muted text-muted-foreground ring-border",
};

interface Props {
  employeeId: string | null;
}

export function MyAssignments({ employeeId }: Props) {
  useRealtimeSync("sheet_assignments", [["my-assignments"]]);

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["my-assignments", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sheet_assignments")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    staleTime: 2 * 60 * 1000,
  });

  // 완료 상태가 아닌 작업만 표시
  const activeAssignments = assignments?.filter(
    (a) => !["완료"].includes(a.status)
  ) ?? [];

  return (
    <Card className="shadow-card border-0 mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> 배정된 작업
          {activeAssignments.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
              {activeAssignments.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !employeeId ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            직원 계정이 연동되지 않았습니다. 관리자에게 문의해주세요.
          </p>
        ) : activeAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            현재 배정된 작업이 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {activeAssignments.map((a) => {
              const statusStyle = STATUS_COLORS[a.status] || STATUS_COLORS["보류"];
              return (
                <div
                  key={a.id}
                  className="p-4 rounded-lg border bg-card space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">
                        {a.customer_name || "미정"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Tractor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">
                          {a.machine_type || ""} {a.model || ""}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ring-1 ring-inset ${statusStyle}`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{a.branch}</span>
                    <span>
                      {formatDistanceToNow(new Date(a.updated_at), {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
