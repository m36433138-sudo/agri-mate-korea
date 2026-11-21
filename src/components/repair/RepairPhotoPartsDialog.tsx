import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, Loader2, RotateCcw, Sparkles, Tag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDiagrams } from "@/hooks/useDiagrams";
import { diagramIdsForModel, photoModelOptions, toJpegDataUrl } from "@/lib/photoPartFinder";
import { machineModelChip } from "@/lib/repairDiagrams";
import { fetchDiagramInventory } from "@/lib/diagramInventory";
import { salesPriceOf } from "@/components/diagrams/PartsStockList";
import { newKey, type EstimateItem } from "@/lib/insuranceEstimate";
import {
  MAX_REPAIR_PHOTOS, mergePhotoCandidates, preChecked, stopsQueue, type PhotoMatch,
} from "@/lib/repairPhotoParts";

type Status = "wait" | "run" | "done" | "fail";
type Photo = { id: string; dataUrl: string; status: Status; description?: string; matches?: PhotoMatch[]; error?: string };

const PARALLEL = 2;

const confClass: Record<string, string> = {
  높음: "bg-emerald-950/60 text-emerald-400 border-emerald-800",
  보통: "bg-amber-950/60 text-amber-400 border-amber-800",
  낮음: "bg-muted text-muted-foreground",
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineModel: string | null;
  onAdd: (items: EstimateItem[]) => void;
  target?: string;
};

/** 수리 사진 여러 장 → 사진마다 도면과 대조해 부품 후보 → 직원이 체크한 것만 담는다 */
export default function RepairPhotoPartsDialog({ open, onOpenChange, machineModel, onAdd, target = "수리 부품" }: Props) {
  const { diagrams, isLoading } = useDiagrams();
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const options = useMemo(() => photoModelOptions(diagrams), [diagrams]);
  const autoChip = useMemo(() => machineModelChip(options, machineModel), [options, machineModel]);

  const [model, setModel] = useState("");
  const [pickModel, setPickModel] = useState(false);
  const [q, setQ] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);
  const gen = useRef(0);
  const started = useRef(new Set<string>());

  // 수리 기계 모델로 기종 자동 선택
  useEffect(() => {
    if (open && !model && autoChip) setModel(autoChip);
  }, [open, model, autoChip]);

  const reset = () => {
    gen.current++;
    started.current.clear();
    setPhotos([]); setChecked({}); setQty({}); setBlocked(null); setPickModel(false); setQ(""); setModel("");
  };

  const chooseModel = (m: string) => {
    if (m === model) { setPickModel(false); return; }
    gen.current++;
    started.current.clear();
    setModel(m); setPickModel(false); setChecked({}); setQty({});
    setPhotos((prev) => prev.map((p) => ({ id: p.id, dataUrl: p.dataUrl, status: "wait" })));
  };

  const analyze = useCallback(async (photo: Photo, forModel: string) => {
    const myGen = gen.current;
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: "run", error: undefined } : p)));
    let status: number | null = null;
    try {
      const { data, error } = await supabase.functions.invoke("find-part-by-photo", {
        body: { image: photo.dataUrl, model: forModel, diagram_ids: diagramIdsForModel(diagrams, forModel) },
      });
      if (error) {
        const ctx = (error as any).context;
        status = typeof ctx?.status === "number" ? ctx.status : null;
        const msg = ctx?.json ? (await ctx.json().catch(() => null))?.error : null;
        throw new Error(msg || error.message);
      }
      if (data?.error) throw new Error(data.error);
      if (myGen !== gen.current) return;
      setPhotos((prev) => prev.map((p) => (p.id === photo.id
        ? { ...p, status: "done", description: data?.description ?? "", matches: Array.isArray(data?.matches) ? data.matches : [] }
        : p)));
    } catch (e: any) {
      if (myGen !== gen.current) return;
      const msg = e?.message || "인식 실패";
      if (stopsQueue(status)) setBlocked(msg);
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: stopsQueue(status) ? "wait" : "fail", error: msg } : p)));
      started.current.delete(photo.id);
    }
  }, [diagrams]);

  // 대기 사진을 2장씩 차례로 분석
  useEffect(() => {
    if (!open || !model || blocked || isLoading) return;
    const running = photos.filter((p) => p.status === "run").length;
    const next = photos.filter((p) => p.status === "wait" && !started.current.has(p.id)).slice(0, Math.max(0, PARALLEL - running));
    for (const p of next) { started.current.add(p.id); void analyze(p, model); }
  }, [open, model, blocked, isLoading, photos, analyze]);

  const addFiles = async (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    const room = MAX_REPAIR_PHOTOS - photos.length;
    if (room <= 0) { toast.error(`사진은 한 번에 ${MAX_REPAIR_PHOTOS}장까지예요.`); return; }
    if (list.length > room) toast.warning(`${MAX_REPAIR_PHOTOS}장까지만 올려요. ${list.length - room}장은 빠졌어요.`);
    for (const f of list.slice(0, room)) {
      try {
        const dataUrl = await toJpegDataUrl(f);
        setPhotos((prev) => [...prev, { id: newKey(), dataUrl, status: "wait" }]);
      } catch {
        toast.error(`${f.name} 사진을 열 수 없어요.`);
      }
    }
  };

  const removePhoto = (id: string) => {
    started.current.delete(id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };
  const retry = (id: string) => setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status: "wait", error: undefined } : p)));
  const resume = () => {
    setBlocked(null);
    setPhotos((prev) => prev.map((p) => (p.status === "fail" ? { ...p, status: "wait", error: undefined } : p)));
  };

  const candidates = useMemo(() => mergePhotoCandidates(
    photos.map((p, i) => ({ photo: i + 1, matches: p.status === "done" ? p.matches ?? [] : [] })),
  ), [photos]);

  useEffect(() => {
    setChecked((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const c of candidates) if (!(c.key in next)) { next[c.key] = preChecked(c); changed = true; }
      return changed ? next : prev;
    });
  }, [candidates]);

  const selected = candidates.filter((c) => checked[c.key]);
  const running = photos.some((p) => p.status === "run" || (p.status === "wait" && !blocked));
  const doneCount = photos.filter((p) => p.status === "done").length;

  const close = (force = false) => {
    if (!force && (selected.length > 0 || running) && !window.confirm("아직 담지 않은 부품 후보가 있어요. 닫을까요?")) return;
    reset();
    onOpenChange(false);
  };

  const add = async () => {
    if (!selected.length) return;
    setAdding(true);
    let prices = new Map<string, number | null>();
    try {
      const rows = await fetchDiagramInventory(selected.map((c) => c.part_code));
      prices = new Map(selected.map((c) => [c.part_code, salesPriceOf(c.part_code, rows)]));
    } catch { /* 가격은 직접 입력 */ }
    const items: EstimateItem[] = selected.map((c) => ({
      key: newKey(),
      item_type: "부품",
      part_code: c.part_code,
      part_name: c.part_name || "",
      quantity: Math.max(1, qty[c.key] ?? 1),
      unit_price: prices.get(c.part_code) ?? 0,
      diagram_id: c.diagram_id,
      diagram_title: c.title,
    }));
    onAdd(items);
    const noPrice = items.filter((i) => !i.unit_price).length;
    toast.success(`${items.length}개 ${target}에 담았어요`, { description: noPrice ? `가격 미등록 ${noPrice}개는 단가를 직접 넣어 주세요.` : undefined });
    setAdding(false);
    close(true);
  };

  const shownModels = options.filter((m) => !q.trim() || m.toUpperCase().includes(q.trim().toUpperCase())).slice(0, 60);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-none w-screen h-[100dvh] sm:rounded-none p-0 gap-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
          <div className="mx-auto max-w-3xl space-y-4">
            <DialogHeader className="space-y-1 pr-8 text-left">
              <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> 수리 사진으로 부품 찾기</DialogTitle>
              <DialogDescription className="text-xs">
                사진 여러 장을 한 번에 올리면 사진마다 부품 도면과 비교해 후보를 보여 줘요. 체크한 부품만 {target}에 담겨요.
              </DialogDescription>
            </DialogHeader>

            {/* 1. 기종 */}
            <section className="rounded-xl border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">1. 기종</span>
                {model ? <Badge variant="outline" className="border-primary/50 text-primary">{model}</Badge> : <span className="text-xs text-muted-foreground">골라 주세요</span>}
                {model && model === autoChip && <span className="text-[11px] text-muted-foreground">수리 기계 기준</span>}
                <Button size="sm" variant="ghost" className="h-7 ml-auto text-xs" onClick={() => setPickModel((v) => !v)}>
                  {pickModel ? "접기" : model ? "바꾸기" : "고르기"}
                </Button>
              </div>
              {(pickModel || (!model && !isLoading)) && (
                <div className="space-y-2">
                  <Input placeholder="기종 검색 (예: YH7140)" value={q} onChange={(e) => setQ(e.target.value)} />
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {shownModels.map((m) => (
                      <button key={m} type="button" onClick={() => chooseModel(m)}
                        className={`text-xs px-2.5 py-1 rounded-full border ${model === m ? "border-primary text-primary bg-primary/10" : "text-muted-foreground"}`}>{m}</button>
                    ))}
                    {shownModels.length === 0 && <p className="text-xs text-muted-foreground">해당 기종의 부품 도면이 없어요.</p>}
                  </div>
                </div>
              )}
              {isLoading && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> 도면 목록 불러오는 중…</p>}
            </section>

            {/* 2. 사진 */}
            <section className="rounded-xl border bg-card p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">2. 수리 사진</span>
                <span className="text-xs text-muted-foreground">{photos.length}/{MAX_REPAIR_PHOTOS}장{doneCount > 0 && ` · 분석 ${doneCount}장 끝`}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" disabled={photos.length >= MAX_REPAIR_PHOTOS} onClick={() => cam.current?.click()}><Camera className="h-4 w-4" /> 촬영</Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" disabled={photos.length >= MAX_REPAIR_PHOTOS} onClick={() => gal.current?.click()}><ImagePlus className="h-4 w-4" /> 갤러리 (여러 장)</Button>
              </div>
              <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={gal} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
              <p className="text-[11px] text-muted-foreground">
                부품 상자·라벨의 부품번호가 보이게 찍으면 가장 정확해요. 사진 1장당 AI를 1~2번 써요.
              </p>

              {blocked && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">남은 사진 분석을 멈췄어요: {blocked}</div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={resume}>다시 시도</Button>
                </div>
              )}

              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {photos.map((p, i) => (
                    <div key={p.id} className="relative rounded-lg border overflow-hidden bg-muted/30">
                      <img src={p.dataUrl} alt={`수리 사진 ${i + 1}`} className="w-full aspect-[4/3] object-cover" />
                      <span className="absolute top-1 left-1 rounded bg-background/80 px-1.5 text-xs font-semibold">{i + 1}</span>
                      <button type="button" aria-label={`사진 ${i + 1} 빼기`} onClick={() => removePhoto(p.id)}
                        className="absolute top-1 right-1 rounded-full bg-background/80 p-1"><X className="h-3.5 w-3.5" /></button>
                      <div className="p-1.5 space-y-0.5 text-[11px]">
                        {p.status === "wait" && <p className="text-muted-foreground">{model ? "대기 중" : "기종을 골라 주세요"}</p>}
                        {p.status === "run" && <p className="flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" /> 도면과 비교 중…</p>}
                        {p.status === "done" && (
                          <>
                            <p className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" /> 후보 {p.matches?.length ?? 0}개</p>
                            {p.description && <p className="text-muted-foreground line-clamp-2">{p.description}</p>}
                          </>
                        )}
                        {p.status === "fail" && (
                          <div className="flex items-center gap-1">
                            <p className="text-destructive line-clamp-2 flex-1">{p.error}</p>
                            <Button size="sm" variant="ghost" className="h-6 px-1.5" aria-label={`사진 ${i + 1} 다시 분석`} onClick={() => retry(p.id)}><RotateCcw className="h-3 w-3" /></Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. 후보 */}
            {(candidates.length > 0 || doneCount > 0) && (
              <section className="rounded-xl border bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">3. 부품 후보</span>
                  <span className="text-xs text-muted-foreground">{candidates.length}개 · {selected.length}개 체크</span>
                </div>
                {candidates.length === 0 && <p className="text-xs text-muted-foreground">딱 맞는 부품을 못 찾았어요. 「부품 도면 보면서 담기」로 직접 골라 주세요.</p>}
                <ul className="space-y-1.5">
                  {candidates.map((c) => (
                    <li key={c.key} className={`rounded-lg border p-2.5 flex items-start gap-2.5 ${checked[c.key] ? "border-primary/60 bg-primary/5" : ""}`}>
                      <Checkbox className="mt-0.5" checked={!!checked[c.key]} aria-label={`${c.part_code} 담기`}
                        onCheckedChange={(v) => setChecked((prev) => ({ ...prev, [c.key]: !!v }))} />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {c.callout_no && <span className="text-xs rounded bg-primary/15 text-primary px-1.5">{c.callout_no}</span>}
                          <span className="font-mono text-sm">{c.part_code}</span>
                          <Badge variant="outline" className={confClass[c.confidence] ?? ""}>{c.confidence}</Badge>
                          {c.fromLabel && <Badge variant="outline" className="gap-1 text-primary border-primary/40"><Tag className="h-3 w-3" />라벨</Badge>}
                        </div>
                        <p className="text-sm truncate">{c.part_name || "이름 없음"}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          사진 {c.photos.join(", ")}{c.title ? ` · ${c.title}` : ""}
                        </p>
                        {c.reason && <p className="text-[11px] text-muted-foreground">{c.reason}</p>}
                      </div>
                      <Input type="number" min={1} inputMode="numeric" aria-label={`${c.part_code} 수량`}
                        className="w-16 h-8 text-center" value={qty[c.key] ?? 1}
                        onChange={(e) => setQty((prev) => ({ ...prev, [c.key]: Math.max(1, Number(e.target.value) || 1) }))} />
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">AI 추천이라 틀릴 수 있어요. 모양·번호를 확인하고 맞는 것만 체크해 주세요.</p>
              </section>
            )}
          </div>
        </div>

        <div className="border-t bg-card p-3 flex items-center gap-2">
          <Button variant="outline" onClick={() => close()}>닫기</Button>
          <Button className="flex-1 gap-1.5" disabled={selected.length === 0 || adding} onClick={add}>
            {adding && <Loader2 className="h-4 w-4 animate-spin" />}
            체크한 {selected.length}개 {target}에 담기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
