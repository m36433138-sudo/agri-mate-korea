import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchDiagramInventory, fetchSupplyPrices, inventoryBranchName, inventoryPriceOf, matchesInventory, type DiagramInventoryRow } from "@/lib/diagramInventory";
import { resolvePartPrice, type PartPrice } from "@/lib/partPricing";

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

/** 얀마 공급가표 공급가 (부품번호 대문자 → 공급가) */
export function useSupplyPrices(codes: string[], enabled = true) {
  const sorted = [...new Set(codes.map((c) => c.trim().toUpperCase()))].sort();
  return useQuery<Map<string, number>>({
    queryKey: ["supply-prices", sorted],
    enabled: enabled && sorted.length > 0,
    staleTime: 600_000,
    queryFn: ({ signal }) => fetchSupplyPrices(sorted, signal),
  });
}

/** 재고 매출가 → 없으면 공급가표로 계산한 매출가 */
export function partPriceOf(code: string, rows: DiagramInventoryRow[], supply: Map<string, number> | undefined): PartPrice | null {
  return resolvePartPrice(inventoryPriceOf(code, rows), supply?.get(code.trim().toUpperCase()));
}

/** 판매가: 재고에 등록된 매출가 중 첫 번째 값 */
export function salesPriceOf(code: string, rows: DiagramInventoryRow[]): number | null {
  return rows.find((r) => matchesInventory(code, r) && r.sales_price != null)?.sales_price ?? null;
}

/** 여러 부품의 지점별 재고 · 위치 · 매입가/판매가를 한꺼번에 보여준다 */
export default function PartsStockList({ parts }: { parts: { code: string; name?: string | null }[] }) {
  const { data: rows = [], isFetching, isError, refetch } = usePartsStock(parts.map((p) => p.code));
  const { data: supply } = useSupplyPrices(parts.map((p) => p.code));
  if (parts.length === 0) return <p className="text-sm text-muted-foreground">선택한 부품이 없어요.</p>;
  if (isFetching && rows.length === 0) return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> 재고 확인 중…</p>;
  if (isError) return <div role="alert" className="text-sm text-destructive">재고를 불러오지 못했어요. <Button variant="ghost" size="sm" onClick={() => void refetch()}>다시 시도</Button></div>;

  return (
    <div className="space-y-2">
      {parts.map((p) => {
        const matched = rows.filter((r) => matchesInventory(p.code, r));
        const total = matched.reduce((s, r) => s + (r.quantity ?? 0), 0);
        const price = partPriceOf(p.code, rows, supply);
        return (
          <div key={p.code} className="rounded-lg border p-2.5 space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 text-xs">
                <span className="font-mono font-semibold break-all">{p.code}</span>
                {(p.name || matched[0]?.part_name) && <span className="text-muted-foreground"> · {p.name || matched[0]?.part_name}</span>}
              </p>
              <span className={`shrink-0 text-xs font-bold ${total > 0 ? "text-primary" : "text-destructive"}`}>{matched.length ? `합계 ${total}개` : "재고 없음"}</span>
            </div>
            {price?.source === "공급가표" && <p className="text-xs text-primary">공급가표 기준 매출가 {won(price.price)} <span className="text-muted-foreground">(부품관리 매출가 미등록)</span></p>}
            {matched.length === 0 ? (
              <p className="text-xs text-muted-foreground">재고 목록에 없는 부품번호예요. 위치 미등록</p>
            ) : (
              <div className="grid gap-1">
                {matched.map((r) => (
                  <div key={r.id} className="grid grid-cols-[3rem_3.5rem_1fr] sm:grid-cols-[3rem_3.5rem_1fr_auto] items-center gap-x-2 gap-y-1 text-xs border-l-2 border-primary/60 pl-2 py-0.5">
                    <span className="font-semibold">{inventoryBranchName(r.branch)}</span>
                    <span className={`font-bold tabular-nums ${(r.quantity ?? 0) > 0 ? "" : "text-destructive"}`}>{r.quantity ?? 0}개</span>
                    {[r.location_main, r.location_sub].some(Boolean) ? (
                      <span className="flex items-center gap-1 w-fit max-w-full rounded-lg bg-primary/10 text-primary px-2 py-1 text-sm font-extrabold break-words">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {[r.location_main, r.location_sub].filter(Boolean).join(" / ")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">위치 미등록</span>
                    )}
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
