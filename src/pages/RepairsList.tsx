import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Search } from "lucide-react";

export default function RepairsList() {
  const [search, setSearch] = useState("");

  const { data: repairs, isLoading } = useQuery({
    queryKey: ["all-repairs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_history")
        .select("*, machines(id, model_name, serial_number)")
        .order("repair_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = repairs?.filter(r => {
    const s = search.toLowerCase();
    return (
      r.repair_content.toLowerCase().includes(s) ||
      (r.machines as any)?.serial_number?.toLowerCase().includes(s) ||
      (r.machines as any)?.model_name?.toLowerCase().includes(s) ||
      (r.technician?.toLowerCase().includes(s) ?? false)
    );
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">수리이력</h1>

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
                  <th className="text-left p-3 font-medium text-muted-foreground">부품</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">담당</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">비용</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 whitespace-nowrap">{formatDate(r.repair_date)}</td>
                    <td className="p-3">
                      <Link to={`/machines/${(r.machines as any)?.id}`} className="hover:text-primary">
                        <span className="font-medium">{(r.machines as any)?.model_name}</span>
                        <span className="block text-xs text-muted-foreground font-mono">{(r.machines as any)?.serial_number}</span>
                      </Link>
                    </td>
                    <td className="p-3">{r.repair_content}</td>
                    <td className="p-3 text-muted-foreground">{r.parts_used || "-"}</td>
                    <td className="p-3 text-muted-foreground">{r.technician || "-"}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{r.cost != null ? formatPrice(r.cost) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
