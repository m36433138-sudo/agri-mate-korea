import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, MapPin, Trash2 } from "lucide-react";
import { cart, useCart } from "@/lib/partOrderCart";
import { fetchDiagramInventory, inventoryBranchName, matchesInventory } from "@/lib/diagramInventory";

export default function PartOrderCartContents({ compact = false }: { compact?: boolean }) {
  const items = useCart();
  const [checked, setChecked] = useState<string[]>([]);
  const selected = items.filter((x) => checked.includes(x.partCode));
  const codes = selected.map((x) => x.partCode).sort();
  const selectionKey = JSON.stringify(codes);
  const [requested, setRequested] = useState<string | null>(null);
  const { data: rows = [], isFetching, isError, refetch } = useQuery({
    queryKey: ["order-cart-inventory", codes],
    enabled: codes.length > 0 && requested === selectionKey,
    staleTime: 120000,
    queryFn: ({ signal }) => fetchDiagramInventory(codes, signal),
  });
  const showing = requested === selectionKey && codes.length > 0;

  if (!items.length) return <p className="py-3 text-sm text-muted-foreground">주문 목록이 비어 있어요.</p>;
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <label className="flex min-h-10 items-center gap-2 text-xs cursor-pointer">
        <Checkbox aria-label="주문 부품 전체 선택" checked={selected.length === items.length ? true : selected.length ? "indeterminate" : false}
          onCheckedChange={(v) => setChecked(v === true ? items.map((x) => x.partCode) : [])} /> 전체 선택
      </label>
      <Button size="sm" variant="outline" disabled={!codes.length || isFetching} className="gap-1"
        onClick={() => { if (showing) void refetch(); else setRequested(selectionKey); }}>
        {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} 재고·위치 보기 ({codes.length})
      </Button>
    </div>
    <div className={compact ? "max-h-56 overflow-y-auto overscroll-contain" : "space-y-1"}>
      {[...items].reverse().map((x) => <div key={x.partCode} className="flex items-center gap-2 border-b py-2">
        <Checkbox aria-label={`${x.partCode} 선택`} checked={checked.includes(x.partCode)}
          onCheckedChange={(v) => setChecked((prev) => v === true ? [...prev.filter((c) => c !== x.partCode), x.partCode] : prev.filter((c) => c !== x.partCode))} />
        <div className="min-w-0 flex-1 text-left">
          <p className="font-mono text-xs break-all">{x.partCode}</p>
          <p className="text-xs text-muted-foreground truncate" title={x.partName}>{x.partName || "부품명 미등록"}</p>
        </div>
        <Input type="number" min={1} value={x.qty} aria-label={`${x.partCode} 수량`} onChange={(e) => cart.setQty(x.partCode, Number(e.target.value) || 1)} className="w-14 h-9 shrink-0 px-1.5" />
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" title="목록에서 삭제" aria-label={`${x.partCode} 삭제`} onClick={() => cart.remove(x.partCode)}><Trash2 className="h-4 w-4" /></Button>
      </div>)}
    </div>
    {showing && <section aria-label="선택 부품 재고 위치" className="space-y-3 border-t pt-3 text-left">
      <h4 className="text-sm font-semibold">선택 부품 재고·위치</h4>
      {isFetching ? <p role="status" className="text-xs text-muted-foreground">재고 확인 중…</p> : isError ? <div role="alert" className="text-sm text-destructive">재고를 불러오지 못했어요.<Button variant="ghost" size="sm" onClick={() => void refetch()}>다시 시도</Button></div> : selected.map((x) => {
        const matched = rows.filter((r) => matchesInventory(x.partCode, r));
        return <div key={x.partCode} className="space-y-1.5">
          <p className="text-xs font-mono font-semibold break-all">{x.partCode} <span className="font-sans text-muted-foreground">{x.partName}</span></p>
          {!matched.length ? <p className="text-xs text-muted-foreground">등록된 재고 없음 · 위치 미등록</p> : matched.map((r) => <div key={r.id} className="border-l-2 border-primary pl-2 text-xs space-y-1">
            <p><span className="font-semibold">{inventoryBranchName(r.branch)}</span> · {r.part_name || r.part_code} · <span className={(r.quantity ?? 0) <= 0 ? "text-destructive" : "text-primary"}>{r.quantity ?? 0}개</span></p>
            {r.part_code !== x.partCode && <p className="text-muted-foreground break-all">재고 번호 {r.part_code}</p>}
            <p className="break-words">위치: {[r.location_main, r.location_sub].filter(Boolean).join(" / ") || "미등록"}</p>
            <p className="text-muted-foreground">판매가: {r.sales_price == null ? "미등록" : `${r.sales_price.toLocaleString("ko-KR")}원`}</p>
          </div>)}
        </div>;
      })}
    </section>}
  </div>;
}