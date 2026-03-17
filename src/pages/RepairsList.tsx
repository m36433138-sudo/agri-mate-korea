import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Search, Plus } from "lucide-react";
import RepairInputModal from "@/components/RepairInputModal";

export default function RepairsList() {
  const [search, setSearch] = useState("");
  const [repairOpen, setRepairOpen] = useState(false);

  const { data: repairs, isLoading } = useQuery({
    queryKey: ["all-repairs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repairs")
        .select("*, machines(id, model_name, serial_number)")
        .order("repair_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = repairs?.filter((r: any) => {
    const s = search.toLowerCase();
    return (
      r.repair_content.toLowerCase().includes(s) ||
      r.machines?.serial_number?.toLowerCase().includes(s) ||
      r.machines?.model_name?.toLowerCase().includes(s) ||
      (r.technician?.toLowerCase().includes(s) ?? false)
    );
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">수리이력</h1>
        <Button onClick={() => setRepairOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> 수리 등록
        </Button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="제조번호, 수리내용, 담당기사 검색..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered?.length === 0 ? (
        <Card className="shadow-card border-0"><CardContent className="py-12 text-center text-muted-foreground">수리 이력이 없습니다.</CardContent></Card>
      ) : (
        <Card className="shadow-card border-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">수리일</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">기계</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">수리내용</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">담당</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">공임비</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">총비용</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((r: any) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 whitespace-nowrap">{formatDate(r.repair_date)}</td>
                    <td className="p-3">
                      <Link to={`/machines/${r.machines?.id}`} className="hover:text-primary">
                        <span className="font-medium">{r.machines?.model_name}</span>
                        <span className="block text-xs text-muted-foreground font-mono">{r.machines?.serial_number}</span>
                      </Link>
                    </td>
                    <td className="p-3">{r.repair_content}</td>
                    <td className="p-3 text-muted-foreground">{r.technician || "-"}</td>
                    <td className="p-3 text-right tabular-nums">{r.labor_cost > 0 ? formatPrice(r.labor_cost) : "-"}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{r.total_cost > 0 ? formatPrice(r.total_cost) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <RepairInputModal open={repairOpen} onOpenChange={setRepairOpen} />
    </div>
  );
}
