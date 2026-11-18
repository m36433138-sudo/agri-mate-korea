import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Trash2, FilePlus2, Loader2, Map as MapIcon, Search } from "lucide-react";
import { useDiagrams, useDiagramPartSearch, useDiagramThumbUrls, type Diagram } from "@/hooks/useDiagrams";
import DiagramThumb from "@/components/diagrams/DiagramThumb";
import { categoryOf, modelsOf, DIAGRAM_CATEGORIES, type DiagramCategory } from "@/lib/diagramModelGroup";
import DiagramViewer, { type PickedPart } from "@/components/diagrams/DiagramViewer";
import { searchDiagrams } from "@/lib/diagramSearch";
import { machineModelChip } from "@/lib/repairDiagrams";
import { fetchDiagramInventory } from "@/lib/diagramInventory";
import { estimateTotals, lineAmount, newKey, resolveDiagramQty, type EstimateItem } from "@/lib/insuranceEstimate";
import { salesPriceOf, usePartsStock } from "@/components/diagrams/PartsStockList";
import { inventoryBranchName, matchesInventory } from "@/lib/diagramInventory";

export type QtyMode = "ask" | "one" | "diagram";
const MODE_KEY = "insuranceEstimate.qtyMode";
const PAGE = 60;
const readMode = (): QtyMode => {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(MODE_KEY) : null;
  return v === "one" || v === "diagram" ? v : "ask";
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineModel: string | null;
  onAdd: (items: EstimateItem[]) => void;
  items?: EstimateItem[];
  onUpdate?: (key: string, patch: Partial<EstimateItem>) => void;
  onRemove?: (key: string) => void;
  /** 담는 곳 이름. 기본은 보험 견적 */
  target?: string;
};

export default function EstimateDiagramPicker({ open, onOpenChange, machineModel, onAdd, items = [], onUpdate, onRemove, target = "견적" }: Props) {
  const { diagrams, isLoading } = useDiagrams();
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [term, setTerm] = useState("");
  const [mode, setModeState] = useState<QtyMode>(readMode);
  const [pending, setPending] = useState<PickedPart[] | null>(null);
  const [added, setAdded] = useState(0);
  const setMode = (m: QtyMode) => { setModeState(m); localStorage.setItem(MODE_KEY, m); };

  // 먼저 기종을 고르고, 그 기종 도면만 사진 카드로 보여 준다
  const [category, setCategory] = useState<DiagramCategory | "전체">("전체");
  const [model, setModel] = useState<string | null>(null); // null = 아직 안 고름, "전체" = 모든 기종
  const [shown, setShown] = useState(PAGE);
  const sheets = useMemo(() => diagrams.filter((d) => d.kind === "diagram"), [diagrams]);
  const allChips = useMemo(() => Array.from(new Set(sheets.flatMap((d) => modelsOf(d.model_name)).filter(Boolean))), [sheets]);
  const chips = useMemo(() => Array.from(new Set(
    sheets.filter((d) => category === "전체" || categoryOf(d.model_name, d.machine_type) === category).flatMap((d) => modelsOf(d.model_name)).filter(Boolean),
  )), [sheets, category]);
  const chipCount = useMemo(() => {
    const c = new Map<string, number>();
    for (const d of sheets) for (const m of modelsOf(d.model_name)) c.set(m, (c.get(m) ?? 0) + 1);
    return c;
  }, [sheets]);
  const machineChip = useMemo(() => machineModelChip(allChips, machineModel), [allChips, machineModel]);
  const autoPicked = useRef(false);
  useEffect(() => {
    if (!open) { autoPicked.current = false; return; }
    if (autoPicked.current || !machineChip) return;
    autoPicked.current = true;
    setModel(machineChip);
    setCategory(categoryOf(machineChip));
  }, [open, machineChip]);
  const chooseModel = (m: string | null) => { setModel(m); setShown(PAGE); setTerm(""); };

  const { hits, pending: searching } = useDiagramPartSearch(term);
  const list = useMemo(() => {
    if (model === null && !term.trim()) return [];
    return searchDiagrams(diagrams, term, hits, { kind: "diagram", model: model ?? "전체", category: model ? "전체" : category });
  }, [diagrams, term, hits, model, category]);
  useEffect(() => { setShown(PAGE); }, [term]);
  const thumbPaths = useMemo(() => diagrams.filter((d) => d.kind !== "photo" && d.image_path).map((d) => d.image_path as string), [diagrams]);
  const { data: thumbs, isError: thumbsFailed } = useDiagramThumbUrls(open ? thumbPaths : []);

  // 도면을 열었다 「목록」으로 돌아오면 보던 자리로
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  const openSheet = (d: Diagram) => { savedScroll.current = scrollRef.current?.scrollTop ?? 0; setDiagram(d); };
  useEffect(() => {
    if (diagram) { scrollRef.current?.scrollTo({ top: 0 }); return; }
    const top = savedScroll.current;
    if (!top) return;
    // 카드가 다 자리 잡을 때까지 몇 프레임 다시 맞춘다
    let tries = 0, raf = 0;
    const fix = () => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTop = top;
      if (Math.abs(el.scrollTop - top) > 4 && tries++ < 60) raf = requestAnimationFrame(fix);
    };
    raf = requestAnimationFrame(fix);
    return () => cancelAnimationFrame(raf);
  }, [diagram]);

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
    toast.success(`${items.length}개 ${target}에 담았어요`, { description: noPrice ? `가격 미등록 ${noPrice}개는 단가를 직접 넣어 주세요.` : undefined });
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
    if (!v) { setDiagram(null); setAdded(0); setTerm(""); }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-none w-screen h-[100dvh] sm:rounded-none p-0 gap-0 flex flex-col lg:flex-row overflow-hidden">
        <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-5">
        <DialogHeader className="space-y-2 pr-8">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <MapIcon className="h-5 w-5 text-primary" /> 도면에서 {target} 담기
            {machineModel && <Badge variant="outline">{machineModel}</Badge>}
            {added > 0 && <Badge className="bg-primary/20 text-primary border-primary/40">이번에 {added}개 담음</Badge>}
          </DialogTitle>
          <DialogDescription className="sr-only">부품 도면에서 부품을 눌러 {target}에 담습니다.</DialogDescription>
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
            onOpenDiagram={openSheet}
            onPickParts={pick}
            pickTarget={target}
          />
        ) : (
          <div className="space-y-3 pt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={term} onChange={(e) => setTerm(e.target.value)}
                placeholder={model && model !== "전체" ? `${model} 안에서 도면 이름 · 부품번호 검색 (예: 탱크커버, 77200)` : "도면 이름 · 부품번호 검색 (예: 탱크커버, 77200)"} className="pl-9" />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            {model === null || model === "전체" ? (
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-1 rounded-xl border bg-card p-1" role="tablist" aria-label="분류">
                  {(["전체", ...DIAGRAM_CATEGORIES] as const).map((c) => (
                    <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => setCategory(c)}
                      className={`rounded-lg py-2 text-sm font-medium transition-colors ${category === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{c}</button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{model === null ? "기종을 먼저 골라 주세요. 고른 기종의 도면만 사진으로 보여 드려요." : "모든 기종 도면을 보고 있어요."}</p>
                {isLoading && diagrams.length === 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2" aria-label="기종">
                    {chips.map((m) => (
                      <button key={m} type="button" onClick={() => chooseModel(m)}
                        className={`rounded-xl border px-3 py-3 text-left transition-colors hover:border-primary hover:bg-primary/10 ${m === machineChip ? "border-primary/60 bg-primary/5" : "bg-card"}`}>
                        <p className="font-semibold text-sm leading-tight">{m}</p>
                        <p className="text-[11px] text-muted-foreground">도면 {(chipCount.get(m) ?? 0).toLocaleString()}장{m === machineChip ? " · 이 기계" : ""}</p>
                      </button>
                    ))}
                    {model === null && (
                      <button type="button" onClick={() => chooseModel("전체")} className="rounded-xl border border-dashed px-3 py-3 text-left text-sm text-muted-foreground hover:bg-muted">모든 기종 보기</button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-sm px-3 py-1 bg-primary/15 text-primary border-primary/40">{model}</Badge>
                <span className="text-xs text-muted-foreground">도면 {(chipCount.get(model) ?? 0).toLocaleString()}장</span>
                <Button size="sm" variant="outline" className="h-7 ml-auto" onClick={() => chooseModel(null)}>다른 기종 고르기</Button>
              </div>
            )}

            {(model !== null || term.trim()) && (
              list.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{searching ? "찾는 중…" : "찾는 도면이 없어요."}</p>
              ) : (
                <>
                  {term.trim() && <p className="text-xs text-muted-foreground">「{term.trim()}」 도면 {list.length}장</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-2">
                    {list.slice(0, shown).map((h) => (
                      <button key={h.diagram.id} type="button" onClick={() => openSheet(h.diagram)} aria-label={`${h.diagram.title} 열기`}
                        className="rounded-xl overflow-hidden border bg-card text-left hover:border-primary transition-colors">
                        <DiagramThumb diagram={h.diagram} thumb={thumbs ? (thumbs.get(h.diagram.image_path ?? "") ?? null) : thumbsFailed ? null : undefined} />
                        <div className="p-2">
                          <p className="text-xs font-medium line-clamp-2 min-h-8" title={h.diagram.title}>{h.diagram.title}</p>
                          {(model === "전체" || term.trim()) && h.diagram.model_name && <p className="text-[10px] text-muted-foreground truncate">{h.diagram.model_name}</p>}
                          {h.partCodes.length > 0 && <p className="text-[10px] text-primary truncate">{h.partCodes.slice(0, 2).join(", ")}{h.partCodes.length > 2 ? ` 외 ${h.partCodes.length - 2}` : ""}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                  {list.length > shown && (
                    <Button variant="outline" className="w-full" onClick={() => setShown((n) => n + PAGE)}>도면 더 보기 ({(list.length - shown).toLocaleString()}장 남음)</Button>
                  )}
                </>
              )
            )}
          </div>
        )}

        </div>
        <EstimateSidePanel items={items} onUpdate={onUpdate} onRemove={onRemove} target={target} />
        <QtyPrompt
          target={target}
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
function QtyPrompt({ target, parts, machineModel, onCancel, onConfirm }: {
  target: string;
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
          <DialogTitle className="flex items-center gap-2"><FilePlus2 className="h-4 w-4 text-primary" /> {target}에 몇 개 담을까요?</DialogTitle>
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

/** 도면 옆에 항상 보이는 현재 견적 목록 */
function EstimateSidePanel({ items, onUpdate, onRemove, target }: { items: EstimateItem[]; onUpdate?: (k: string, p: Partial<EstimateItem>) => void; onRemove?: (k: string) => void; target: string }) {
  const isEstimate = target === "견적";
  const t = estimateTotals(items);
  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
  return (
    <aside className="lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l bg-muted/20 flex flex-col max-h-[40dvh] lg:max-h-none">
      <div className="px-3 py-2 pr-12 border-b text-sm font-semibold flex items-center justify-between">
        <span>현재 {target} {items.length}줄</span><span className="text-primary">{won(t.total)}</span>
      </div>
      <div className="flex-1 overflow-y-auto divide-y">
        {items.length === 0 && <p className="p-4 text-xs text-center text-muted-foreground">왼쪽 도면에서 부품 번호를 누르면 여기에 쌓여요.</p>}
        {items.map((it) => (
          <div key={it.key} className="px-3 py-2 text-xs flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate"><span className="text-muted-foreground">{it.item_type}</span> {it.part_code && <span className="font-mono">{it.part_code}</span>} {it.part_name}</p>
              <p className="text-muted-foreground">{it.unit_price ? won(it.unit_price) : <span className="text-amber-400">단가 미입력</span>}</p>
            </div>
            <Input aria-label="수량" inputMode="decimal" value={String(it.quantity)} onChange={(e) => onUpdate?.(it.key, { quantity: Number(e.target.value.replace(/[^0-9.]/g, "")) || 1 })} className="h-7 w-12 px-1 text-right text-xs" />
            <span className="w-20 text-right tabular-nums font-medium">{won(lineAmount(it))}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="삭제" onClick={() => onRemove?.(it.key)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t text-xs text-muted-foreground flex justify-between"><span>부품 {won(t.parts)}</span>{isEstimate && <span>공임 {won(t.labor)}</span>}</div>
    </aside>
  );
}
