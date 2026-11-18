import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronRight, FilePlus2, Loader2, Map as MapIcon, Search } from "lucide-react";
import { useDiagrams, useDiagramPartSearch, type Diagram } from "@/hooks/useDiagrams";
import DiagramViewer, { type PickedPart } from "@/components/diagrams/DiagramViewer";
import { searchDiagrams } from "@/lib/diagramSearch";
import { bookMatchesMachine } from "@/lib/repairDiagrams";
import { fetchDiagramInventory } from "@/lib/diagramInventory";
import { newKey, resolveDiagramQty, type EstimateItem } from "@/lib/insuranceEstimate";
import { salesPriceOf, usePartsStock } from "@/components/diagrams/PartsStockList";
import { inventoryBranchName, matchesInventory } from "@/lib/diagramInventory";

export type QtyMode = "ask" | "one" | "diagram";
const MODE_KEY = "insuranceEstimate.qtyMode";
const readMode = (): QtyMode => {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(MODE_KEY) : null;
  return v === "one" || v === "diagram" ? v : "ask";
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineModel: string | null;
  onAdd: (items: EstimateItem[]) => void;
};

export default function EstimateDiagramPicker({ open, onOpenChange, machineModel, onAdd }: Props) {
  const { diagrams, isLoading } = useDiagrams();
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [term, setTerm] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [mode, setModeState] = useState<QtyMode>(readMode);
  const [pending, setPending] = useState<PickedPart[] | null>(null);
  const [added, setAdded] = useState(0);
  const setMode = (m: QtyMode) => { setModeState(m); localStorage.setItem(MODE_KEY, m); };

  const { hits, pending: searching } = useDiagramPartSearch(term);
  const list = useMemo(() => {
    const found = searchDiagrams(diagrams, term, hits, { kind: "diagram", model: "전체" });
    const same = found.filter((h) => bookMatchesMachine(h.diagram.model_name, machineModel));
    const base = !term.trim() && !showAll && same.length > 0 ? same : found;
    return [...base].sort((a, b) => Number(bookMatchesMachine(b.diagram.model_name, machineModel)) - Number(bookMatchesMachine(a.diagram.model_name, machineModel)));
  }, [diagrams, term, hits, machineModel, showAll]);
  const sameCount = useMemo(() => diagrams.filter((d) => d.kind === "diagram" && bookMatchesMachine(d.model_name, machineModel)).length, [diagrams, machineModel]);

  const commit = async (parts: PickedPart[], qtyFor: (p: PickedPart) => number, prices?: Map<string, number | null>) => {
    let priceMap = prices;
    if (!priceMap) {
      try {
        const rows = await fetchDiagramInventory(parts.map((p) => p.code));
        priceMap = new Map(parts.map((p) => [p.code, salesPriceOf(p.code, rows)]));
      } catch { priceMap = new Map(); }
    }
    const items: EstimateItem[] = parts.map((p) => ({
      key: newKey(),
      item_type: "부품",
      part_code: p.code,
      part_name: p.name || "",
      quantity: Math.max(1, qtyFor(p)),
      unit_price: priceMap!.get(p.code) ?? 0,
      diagram_id: diagram?.id ?? null,
      diagram_title: diagram?.title ?? null,
    }));
    onAdd(items);
    setAdded((n) => n + items.length);
    const noPrice = items.filter((i) => !i.unit_price).length;
    toast.success(`${items.length}개 견적에 담았어요`, { description: noPrice ? `가격 미등록 ${noPrice}개는 단가를 직접 넣어 주세요.` : undefined });
  };

  const pick = (parts: PickedPart[]) => {
    if (parts.length === 0) return;
    if (mode === "one") { void commit(parts, () => 1); return; }
    if (mode === "diagram") {
      const resolved = parts.map((p) => resolveDiagramQty(p.qtyNote, machineModel));
      if (resolved.every((r) => r.qty != null)) { void commit(parts, (p) => resolved[parts.indexOf(p)].qty!); return; }
    }
    setPending(parts);
  };

  const close = (v: boolean) => {
    if (!v) { setDiagram(null); setAdded(0); }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-6xl w-[calc(100vw-1rem)] max-h-[94vh] overflow-y-auto p-3 sm:p-5">
        <DialogHeader className="space-y-2 pr-8">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <MapIcon className="h-5 w-5 text-primary" /> 도면에서 견적 담기
            {machineModel && <Badge variant="outline">{machineModel}</Badge>}
            {added > 0 && <Badge className="bg-primary/20 text-primary border-primary/40">이번에 {added}개 담음</Badge>}
          </DialogTitle>
          <DialogDescription className="sr-only">부품 도면에서 부품을 눌러 보험 견적서에 담습니다.</DialogDescription>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground">누를 때 수량</span>
            {([["ask", "매번 묻기"], ["one", "항상 1개"], ["diagram", "도면 소요 수량"]] as const).map(([m, label]) => (
              <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} className="h-7 px-2.5 text-xs" onClick={() => setMode(m)} aria-pressed={mode === m}>{label}</Button>
            ))}
            <Button size="sm" variant="secondary" className="h-7 ml-auto" onClick={() => close(false)}>담기 끝내기</Button>
          </div>
        </DialogHeader>

        {diagram ? (
          <DiagramViewer
            key={diagram.id}
            diagram={diagram}
            onBack={() => setDiagram(null)}
            allDiagrams={diagrams}
            onOpenDiagram={setDiagram}
            onPickParts={pick}
          />
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="도면 이름 · 부품번호 검색 (예: 탱크커버, 77200)" className="pl-9" />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {!term.trim() && machineModel && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {sameCount > 0 ? <span>{showAll ? "전체 도면" : `${machineModel} 도면 ${sameCount}장`}</span> : <span>{machineModel} 도면이 없어 전체 도면을 보여 드려요.</span>}
                {sameCount > 0 && <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowAll((v) => !v)}>{showAll ? "이 기종만" : "전체 보기"}</Button>}
              </div>
            )}
            {isLoading && diagrams.length === 0 ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : list.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">찾는 도면이 없어요.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {list.slice(0, 120).map((h) => (
                  <li key={h.diagram.id}>
                    <button type="button" onClick={() => setDiagram(h.diagram)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{h.diagram.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {h.diagram.model_name || "기종 미지정"}
                          {h.partCodes.length > 0 && <span className="text-primary"> · {h.partCodes.slice(0, 3).join(", ")}{h.partCodes.length > 3 ? ` 외 ${h.partCodes.length - 3}` : ""}</span>}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {list.length > 120 && <p className="text-xs text-center text-muted-foreground">앞의 120장만 보여요. 검색어를 더 넣어 주세요.</p>}
          </div>
        )}

        <QtyPrompt
          parts={pending}
          machineModel={machineModel}
          onCancel={() => setPending(null)}
          onConfirm={(qtyFor, prices, remember) => {
            const parts = pending!;
            setPending(null);
            if (remember) setMode(remember);
            void commit(parts, qtyFor, prices);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** 부품을 누르면: 1개로 담을지, 도면 소요 수량만큼 담을지 묻고 재고·가격도 함께 보여준다 */
function QtyPrompt({ parts, machineModel, onCancel, onConfirm }: {
  parts: PickedPart[] | null;
  machineModel: string | null;
  onCancel: () => void;
  onConfirm: (qtyFor: (p: PickedPart) => number, prices: Map<string, number | null>, remember: QtyMode | null) => void;
}) {
  const open = !!parts && parts.length > 0;
  const list = parts ?? [];
  const { data: rows = [], isFetching } = usePartsStock(list.map((p) => p.code), open);
  const [remember, setRemember] = useState(false);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const resolved = list.map((p) => resolveDiagramQty(p.qtyNote, machineModel));
  const diagramQty = (p: PickedPart, i: number) => chosen[p.code] ?? resolved[i].qty ?? 1;
  const totalDiagram = list.reduce((s, p, i) => s + diagramQty(p, i), 0);
  const prices = new Map(list.map((p) => [p.code, salesPriceOf(p.code, rows)]));
  const anyNote = resolved.some((r) => r.options.length > 0);

  const done = (m: "one" | "diagram") => {
    const idx = new Map(list.map((p, i) => [p.code, i]));
    onConfirm(m === "one" ? () => 1 : (p) => diagramQty(p, idx.get(p.code)!), prices, remember ? m : null);
    setChosen({}); setRemember(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onCancel(); setChosen({}); } }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FilePlus2 className="h-4 w-4 text-primary" /> 견적에 몇 개 담을까요?</DialogTitle>
          <DialogDescription>
            {list.length === 1 ? "이 부품을" : `부품 ${list.length}개를`} 1개씩 담거나, 도면에 적힌 소요 수량만큼 담을 수 있어요.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {list.map((p, i) => {
            const r = resolved[i];
            const inv = rows.filter((x) => matchesInventory(p.code, x));
            const stock = inv.reduce((s, x) => s + (x.quantity ?? 0), 0);
            const price = prices.get(p.code);
            return (
              <div key={p.code} className="rounded-lg border p-2.5 space-y-1 text-xs">
                <p><span className="font-mono font-semibold">{p.code}</span>{p.name && <span className="text-muted-foreground"> · {p.name}</span>}</p>
                <p className="text-muted-foreground">
                  도면 소요 수량: {r.options.length === 0 ? "표시 없음" : p.qtyNote}
                  {r.matchedModel && <span className="text-primary"> → {r.matchedModel} {r.qty ?? "-"}개</span>}
                </p>
                {r.notUsed && <p className="text-amber-400">이 기종에는 「-」로 표시된 부품이에요. 확인 후 담아 주세요.</p>}
                {r.ambiguous && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-muted-foreground">기종 선택:</span>
                    {r.options.filter((o) => o.qty != null).map((o) => (
                      <Button key={`${o.model}-${o.qty}`} size="sm" variant={chosen[p.code] === o.qty ? "default" : "outline"} className="h-6 px-2 text-[11px]"
                        onClick={() => setChosen((c) => ({ ...c, [p.code]: o.qty! }))}>{o.model} {o.qty}개</Button>
                    ))}
                  </div>
                )}
                <p>
                  {isFetching && inv.length === 0 ? <span className="text-muted-foreground">재고 확인 중…</span> : inv.length === 0 ? <span className="text-muted-foreground">재고 없음 · 가격 미등록</span> : (
                    <>
                      <span className={stock > 0 ? "text-primary font-semibold" : "text-destructive font-semibold"}>재고 {stock}개</span>
                      <span className="text-muted-foreground"> · {inv.map((x) => `${inventoryBranchName(x.branch)} ${x.quantity ?? 0}개${x.location_main ? ` (${[x.location_main, x.location_sub].filter(Boolean).join("/")})` : ""}`).join(", ")}</span>
                      <span> · 판매가 {price == null ? "미등록" : `${price.toLocaleString("ko-KR")}원`}</span>
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="outline" onClick={() => done("one")}>1개씩 담기{list.length > 1 ? ` (${list.length}개)` : ""}</Button>
          <Button onClick={() => done("diagram")} disabled={!anyNote}>도면 수량대로 ({totalDiagram}개)</Button>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} /> 다음부터 묻지 않고 고른 방식으로 바로 담기
        </label>
      </DialogContent>
    </Dialog>
  );
}
