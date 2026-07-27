import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, GitCompare } from "lucide-react";

type Row = {
  part_code: string;
  part_name: string;
  jangheung_qty: number | null;
  jangheung_loc: string | null;
  gangjin_qty: number | null;
  gangjin_loc: string | null;
  sales_price: number | null;
};

function useDebounce<T>(value: T, delay = 300): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export default function BranchInventoryCompare() {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const hasSearch = debounced.trim().length >= 2;

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-compare", debounced],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("branch, part_code, part_name, quantity, sales_price, location_main, location_sub")
        .or(`part_code.ilike.%${debounced}%,part_name.ilike.%${debounced}%`)
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: hasSearch,
    staleTime: 30_000,
  });

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const map = new Map<string, Row>();
    for (const r of data) {
      const key = r.part_code;
      const loc = [r.location_main, r.location_sub].filter(Boolean).join(" / ") || null;
      const existing = map.get(key) || {
        part_code: r.part_code,
        part_name: r.part_name,
        jangheung_qty: null,
        jangheung_loc: null,
        gangjin_qty: null,
        gangjin_loc: null,
        sales_price: null,
      };
      if (r.branch === "장흥") {
        existing.jangheung_qty = r.quantity;
        existing.jangheung_loc = loc;
      } else if (r.branch === "강진") {
        existing.gangjin_qty = r.quantity;
        existing.gangjin_loc = loc;
      }
      if (r.sales_price != null) existing.sales_price = r.sales_price;
      existing.part_name = existing.part_name || r.part_name;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.part_code.localeCompare(b.part_code));
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="부품코드 또는 부품명 2글자 이상 입력..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 max-w-md"
          autoComplete="off"
        />
      </div>

      {!hasSearch ? (
        <Card className="shadow-card border-0 border-dashed border-2">
          <CardContent className="py-14 text-center">
            <GitCompare className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">장흥·강진 재고를 한 화면에서 비교</p>
            <p className="text-xs text-muted-foreground/60 mt-1">부품코드/부품명을 검색하세요</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">"{debounced}"에 해당하는 부품이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card border-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs" rowSpan={2}>부품코드</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs" rowSpan={2}>부품명</th>
                  <th className="text-center p-2 font-medium text-xs bg-primary/5" colSpan={2}>장흥</th>
                  <th className="text-center p-2 font-medium text-xs bg-info/5" colSpan={2}>강진</th>
                  <th className="text-right p-3 font-medium text-muted-foreground text-xs" rowSpan={2}>매출가</th>
                </tr>
                <tr className="border-b bg-muted/20 text-xs">
                  <th className="text-right p-2 font-medium text-muted-foreground">수량</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">위치</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">수량</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">위치</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const jhMissing = r.jangheung_qty == null;
                  const gjMissing = r.gangjin_qty == null;
                  return (
                    <tr key={r.part_code} className="border-b last:border-0 hover:bg-muted/25">
                      <td className="p-3 font-mono text-xs">{r.part_code}</td>
                      <td className="p-3 font-medium">{r.part_name}</td>
                      <td className={`p-2 text-right tabular-nums font-semibold ${jhMissing ? "text-muted-foreground/40" : ""}`}>
                        {jhMissing ? "—" : r.jangheung_qty}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{r.jangheung_loc || "-"}</td>
                      <td className={`p-2 text-right tabular-nums font-semibold ${gjMissing ? "text-muted-foreground/40" : ""}`}>
                        {gjMissing ? "—" : r.gangjin_qty}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{r.gangjin_loc || "-"}</td>
                      <td className="p-3 text-right text-muted-foreground tabular-nums">
                        {r.sales_price?.toLocaleString() ?? "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
