import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, ClipboardList } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/formatters";

export default function RepairLogHistory() {
  const [search, setSearch] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["repair-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_logs")
        .select("*, customers(name), machines(model_name, serial_number, machine_type)")
        .order("repair_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: allParts } = useQuery({
    queryKey: ["repair-log-parts-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_log_parts")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const partsMap = new Map<string, typeof allParts>();
  allParts?.forEach((p: any) => {
    const list = partsMap.get(p.repair_log_id) || [];
    list.push(p);
    partsMap.set(p.repair_log_id, list);
  });

  const filtered = logs?.filter((log: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.mechanic_name?.toLowerCase().includes(q) ||
      log.description?.toLowerCase().includes(q) ||
      log.customers?.name?.toLowerCase().includes(q) ||
      log.machines?.model_name?.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="고객, 기사, 내용 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {!filtered?.length ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
            정비 기록이 없습니다.
          </CardContent>
        </Card>
      ) : (
        filtered.map((log: any) => {
          const parts = partsMap.get(log.id) || [];
          return (
            <Card key={log.id} className="shadow-card border-0">
              <CardHeader className="bg-muted/30 border-b pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">
                    {log.machines
                      ? `${log.machines.machine_type} ${log.machines.model_name}`
                      : "기계 미지정"}
                  </CardTitle>
                  <Badge variant="secondary">{formatDate(log.repair_date)}</Badge>
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  {log.customers?.name && <span>고객: {log.customers.name}</span>}
                  <span>담당: {log.mechanic_name}</span>
                  {log.operating_hours && <span>사용시간: {log.operating_hours}시간</span>}
                  {log.branch && <Badge variant="outline" className="text-xs">{log.branch}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <p className="text-sm mb-2">{log.description}</p>
                {parts.length > 0 && (
                  <div className="bg-primary/5 p-3 rounded-md">
                    <h4 className="text-xs font-bold text-primary mb-2">교체 부품</h4>
                    <ul className="text-sm space-y-1">
                      {parts.map((p: any, idx: number) => (
                        <li key={idx} className="flex justify-between border-b border-primary/10 pb-1 last:border-0">
                          <span className="font-mono text-xs">{p.part_code}</span>
                          <span className="font-medium">{p.quantity_used}개</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
