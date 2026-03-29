import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useListFilter } from "@/hooks/useListFilter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle } from "lucide-react";

type InventoryItem = {
  id: string;
  branch: string;
  part_code: string;
  part_name: string;
  quantity: number | null;
  min_stock: number | null;
  sales_price: number | null;
  location_main: string | null;
  location_sub: string | null;
};

export default function LowStockList() {
  const [branch, setBranch] = useState<"장흥" | "강진" | "전체">("전체");
  useRealtimeSync("inventory", [["inventory"]]);

  const { data: allInventory, isLoading } = useQuery({
    queryKey: ["inventory", "all-for-lowstock"],
    queryFn: async () => {
      const allRows: InventoryItem[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("inventory")
          .select("id, branch, part_code, part_name, quantity, min_stock, sales_price, location_main, location_sub")
          .order("part_code")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allRows.push(...(data as InventoryItem[]));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      return allRows;
    },
  });

  // 적정재고 미만인 항목만 (min_stock=1이면 quantity=0일 때)
  const lowStockItems = (allInventory || []).filter((item) => {
    const qty = item.quantity ?? 0;
    const minStock = item.min_stock ?? 1;
    return qty < minStock;
  });

  const filteredByBranch = branch === "전체"
    ? lowStockItems
    : lowStockItems.filter((i) => i.branch === branch);

  const { search, setSearch, filtered } = useListFilter<InventoryItem>({
    data: filteredByBranch,
    searchFields: ["part_code", "part_name"],
  });

  const jCount = lowStockItems.filter((i) => i.branch === "장흥").length;
  const gCount = lowStockItems.filter((i) => i.branch === "강진").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant={branch === "전체" ? "default" : "outline"} size="sm" onClick={() => setBranch("전체")}>
            전체 ({lowStockItems.length})
          </Button>
          <Button variant={branch === "장흥" ? "default" : "outline"} size="sm" onClick={() => setBranch("장흥")}>
            장흥 ({jCount})
          </Button>
          <Button variant={branch === "강진" ? "default" : "outline"} size="sm" onClick={() => setBranch("강진")}>
            강진 ({gCount})
          </Button>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm font-medium text-destructive">
            재고 부족 품목 총 {lowStockItems.length}건 (장흥 {jCount}건 / 강진 {gCount}건)
          </p>
        </div>
      )}

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="부품코드 또는 부품명 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (filtered?.length ?? 0) === 0 ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center text-muted-foreground">
            재고 부족 품목이 없습니다. 🎉
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card border-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">지점</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">부품코드</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">부품명</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">재고</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">적정재고</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">위치</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 bg-destructive/5 hover:bg-destructive/10 transition-colors">
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">{item.branch}</Badge>
                    </td>
                    <td className="p-3 font-mono text-xs">{item.part_code}</td>
                    <td className="p-3 font-medium">{item.part_name}</td>
                    <td className="p-3 text-right">
                      <Badge variant="destructive" className="text-xs">{item.quantity ?? 0}</Badge>
                    </td>
                    <td className="p-3 text-right text-muted-foreground">{item.min_stock ?? 1}</td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                      {[item.location_main, item.location_sub].filter(Boolean).join(" / ") || "-"}
                    </td>
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
