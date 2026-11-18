import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchDiagramInventory, inventoryBranchName, matchesInventory, type DiagramInventoryRow } from "@/lib/diagramInventory";

const won = (n: number | null | undefined) => (n == null ? "미등록" : `${n.toLocaleString("ko-KR")}원`);

export function usePartsStock(codes: string[], enabled = true) {
  const sorted = [...new Set(codes)].sort();
  return useQuery<DiagramInventoryRow[]>({
    queryKey: ["parts-stock", sorted],
    enabled: enabled && sorted.length > 0,
    staleTime: 120_000,
    queryFn: ({ signal }) => fetchDiagramInventory(sorted, signal),
  });
}

/** 판매가: 재고에 등록된 매출가 중 첫 번째 값 */
export function salesPriceOf(code: string, rows: DiagramInventoryRow[]): number | null {
  return rows.find((r) => matchesInventory(code, r) && r.sales_price != null)?.sales_price ?? null;
}

/** 여러 부품의 지점별 재고 · 위치 · 매입가/판매가를 한꺼번에 보여준다 */
export default function PartsStockList({ parts }: { parts: { code: string; name?: string | null }[] }) {
  const { data: rows = [], isFetching, isError, refetch } = usePartsStock(parts.map((p) => p.code));
  if (parts.length === 0) return <p className="text-sm text-muted-foreground">선택한 부품이 없어요.</p>;
  if (isFetching && rows.length === 0) return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> 재고 확인 중…</p>;
  if (isError) return <div role="alert" className="text-sm text-destructive">재고를 불러오지 못했어요. <Button variant="ghost" size="sm" onClick={() => void refetch()}>다시 시도</Button></div>;

  return (
    <div className="space-y-2">
      {parts.map((p) => {
        const matched = rows.filter((r) => matchesInventory(p.code, r));
        const total = matched.reduce((s, r) => s + (r.quantity ?? 0), 0);
        return (
          <div key={p.code} className="rounded-lg border p-2.5 space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 text-xs">
                <span className="font-mono font-semibold break-all">{p.code}</span>
                {(p.name || matched[0]?.part_name) && <span className="text-muted-foreground"> · {p.name || matched[0]?.part_name}</span>}
              </p>
              <span className={`shrink-0 text-xs font-bold ${total > 0 ? "text-primary" : "text-destructive"}`}>{matched.length ? `합계 ${total}개` : "재고 없음"}</span>
            </div>
            {matched.length === 0 ? (
              <p className="text-xs text-muted-foreground">재고 목록에 없는 부품번호예요. 위치·가격 미등록</p>
            ) : (
              <div className="grid gap-1">
                {matched.map((r) => (
                  <div key={r.id} className="grid grid-cols-[3rem_3.5rem_1fr] sm:grid-cols-[3rem_3.5rem_1fr_auto] items-baseline gap-x-2 gap-y-0.5 text-xs border-l-2 border-primary/60 pl-2">
                    <span className="font-semibold">{inventoryBranchName(r.branch)}</span>
                    <span className={(r.quantity ?? 0) > 0 ? "" : "text-destructive"}>{r.quantity ?? 0}개</span>
                    <span className="break-words">{[r.location_main, r.location_sub].filter(Boolean).join(" / ") || "위치 미등록"}</span>
                    <span className="col-span-3 sm:col-span-1 text-muted-foreground sm:text-right">
                      판매 {won(r.sales_price)} · 매입 {won(r.purchase_price)}
                    </span>
                    {r.part_code !== p.code && <span className="col-span-3 sm:col-span-4 text-muted-foreground break-all">재고 번호 {r.part_code}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
