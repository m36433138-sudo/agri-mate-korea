import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDiagrams, useDiagramImageUrl, useDiagramPartSearch, useDiagramThumbUrls, DIAGRAM_BUCKET, type Diagram } from "@/hooks/useDiagrams";
import DiagramViewer from "@/components/diagrams/DiagramViewer";
import DiagramThumbnail from "@/components/diagrams/DiagramThumbnail";
import { Map, Plus, Camera, ImagePlus, Trash2, Loader2, Tag, FileUp, Search, X, Sparkles } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { brandOf, categoryOf, modelsOf, DIAGRAM_BRANDS, DIAGRAM_CATEGORIES, type DiagramCategory } from "@/lib/diagramModelGroup";
import { searchDiagrams } from "@/lib/diagramSearch";
import LabelPhotoDialog from "@/components/diagrams/LabelPhotoDialog";
import PhotoPartFinderDialog from "@/components/diagrams/PhotoPartFinderDialog";
import PdfDiagramImportDialog from "@/components/diagrams/PdfDiagramImportDialog";
import PartOrderCartDialog from "@/components/diagrams/PartOrderCartDialog";
import { useCart } from "@/lib/partOrderCart";
import { ShoppingCart } from "lucide-react";

async function compressImage(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const MAX = 2400;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), "image/jpeg", 0.85)
  );
}

function FastThumb({ thumb, diagram }: { thumb: string; diagram: Diagram }) {
  const [bad, setBad] = useState(false);
  if (bad) return <SlowThumb diagram={diagram} />;
  return (
    <div className="aspect-square w-full overflow-hidden bg-[hsl(var(--diagram-paper))] p-1.5">
      <img src={thumb} alt={diagram.title} loading="lazy" decoding="async" onError={() => setBad(true)} className="h-full w-full object-contain" />
    </div>
  );
}

function SlowThumb({ diagram }: { diagram: Diagram }) {
  const { data: url } = useDiagramImageUrl(diagram.image_path);
  return url ? <DiagramThumbnail key={url} src={url} title={diagram.title} /> : <Skeleton className="w-full aspect-square" />;
}

function DiagramCard({ diagram, match, thumb, onClick, onDelete }: {
  diagram: Diagram;
  thumb?: string | null;
  match?: { codes: string[]; count: number };
  onClick: () => void;
  onDelete: () => void;
}) {
  const { data: url } = useDiagramImageUrl(diagram.kind === "photo" ? diagram.image_path : null);
  return (
    <div className="diagram-card rounded-lg sm:rounded-xl overflow-hidden bg-card/60 sm:bg-card sm:border hover:border-primary/60 transition-colors cursor-pointer group relative">
      <Button variant="ghost" onClick={onClick} aria-label={`${diagram.title} 열기`}
        className="block h-auto w-full rounded-none p-0 text-left whitespace-normal hover:bg-transparent">
        {diagram.kind !== "photo" ? (
          thumb ? <FastThumb thumb={thumb} diagram={diagram} /> : thumb === null ? <SlowThumb diagram={diagram} /> : <Skeleton className="w-full aspect-square" />
        ) : url ? (
          <img src={url} alt={diagram.title} loading="lazy" className="w-full object-cover aspect-[4/3]" />
        ) : (
          <Skeleton className={`w-full ${diagram.kind === "photo" ? "aspect-[4/3]" : "aspect-square"}`} />
        )}
        <div className="px-1.5 py-1 sm:p-3">
          <p className="font-medium sm:font-semibold line-clamp-2 sm:min-h-10 text-[11px] leading-tight sm:text-sm" title={diagram.title}>{diagram.title}</p>
          {diagram.model_name && (
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{diagram.model_name}</p>
          )}
          {match && match.codes.length > 0 && (
            <p className="text-[10px] sm:text-xs text-primary truncate" title={match.codes.join(", ")}>
              부품번호 {match.codes[0]}
              {match.count > 1 ? ` 외 ${match.count - 1}건` : ""}
            </p>
          )}
        </div>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 bg-background/70 backdrop-blur opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`"${diagram.title}" 도면을 삭제할까요?`)) onDelete();
        }}
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

const PAGE_SIZE = 60;

/** 탭·기종·검색어를 이 창에서 기억해 다른 메뉴에 다녀와도 그대로 */
function useSessionState<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try { const raw = sessionStorage.getItem(key); return raw == null ? init : (JSON.parse(raw) as T); } catch { return init; }
  });
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* 저장 공간 없음 */ } }, [key, v]);
  return [v, setV] as const;
}

function scrollers(): (HTMLElement | Window)[] {
  const main = document.querySelector("main");
  return main ? [main, window] : [window];
}
function readScroll() {
  return scrollers().map((el) => (el === window ? window.scrollY : (el as HTMLElement).scrollTop));
}
function writeScroll(pos: number[]) {
  scrollers().forEach((el, i) => el.scrollTo({ top: pos[i] ?? 0 }));
}

export default function DiagramsPage() {
  const { toast } = useToast();
  const { diagrams, isLoading, addDiagram, deleteDiagram } = useDiagrams();
  // 열린 도면은 주소(?d=)에 남겨 핸드폰 뒤로가기로 닫히고, 목록은 그대로 둔 채 보던 자리로 돌아온다
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const diagramById = useMemo(() => new globalThis.Map(diagrams.map((d) => [d.id, d])), [diagrams]);
  const openIds = (params.get("d") ?? "").split(",").filter(Boolean);
  const stack = openIds.map((id) => diagramById.get(id)).filter(Boolean) as Diagram[];
  const selected = stack[stack.length - 1] ?? null;
  const initialPart = params.get("p");
  const checkedParam = params.get("check");
  const listScroll = useRef<number[] | null>(null);
  const [kindTab, setKindTab] = useSessionState<"photo" | "diagram">("diagrams.kind", "photo");
  const [modelFilter, setModelFilter] = useSessionState("diagrams.model", "전체");
  const [category, setCategory] = useSessionState<DiagramCategory | "전체">("diagrams.category", "전체");
  const [brand, setBrand] = useSessionState("diagrams.brand", "전체");
  // 등록된 제조사만 버튼으로 (얀마 먼저)
  const brands = useMemo(() => {
    const c = new globalThis.Map<string, number>();
    for (const d of diagrams) if (d.kind === kindTab) c.set(brandOf(d.manufacturer), (c.get(brandOf(d.manufacturer)) ?? 0) + 1);
    const order = (b: string) => { const i = (DIAGRAM_BRANDS as readonly string[]).indexOf(b); return i < 0 ? 99 : i; };
    return [...c.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0], "ko"));
  }, [diagrams, kindTab]);
  const inBrand = (d: Diagram) => brand === "전체" || brandOf(d.manufacturer) === brand;
  const [kind, setKind] = useState<"photo" | "diagram">("photo");
  // 분류(이앙기·콤바인·트랙터·부속장치)별 개수 — 지금 보고 있는 사진/도면 탭 기준
  const categoryCounts = useMemo(() => {
    const c = new globalThis.Map<string, number>();
    for (const d of diagrams) if (d.kind === kindTab && inBrand(d)) c.set(categoryOf(d.model_name, d.machine_type), (c.get(categoryOf(d.model_name, d.machine_type)) ?? 0) + 1);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagrams, kindTab, brand]);
  // 기종 버튼: 고른 분류 안의 기종만. YT490·5101·5113은 하나로 묶고, 공용 책(엔진·커터)은 해당 기종 버튼마다 보인다.
  const models = useMemo(() => [
    "전체",
    ...Array.from(new Set(
      diagrams
        .filter((d) => d.kind === kindTab && inBrand(d))
        .filter((d) => category === "전체" || categoryOf(d.model_name, d.machine_type) === category)
        .flatMap((d) => modelsOf(d.model_name))
        .filter(Boolean),
    )),
  ], [diagrams, category, kindTab, brand]);
  const pickCategory = (c: DiagramCategory | "전체") => { setCategory(c); setModelFilter("전체"); };
  const [term, setTerm] = useSessionState("diagrams.term", "");
  const { hits: partHits, pending: partPending } = useDiagramPartSearch(term);
  const thumbPaths = useMemo(
    () => (diagrams ?? []).filter((d: Diagram) => d.kind !== "photo" && d.image_path).map((d: Diagram) => d.image_path as string),
    [diagrams],
  );
  const { data: thumbs, isError: thumbsFailed } = useDiagramThumbUrls(thumbPaths);
  const results = useMemo(
    () => searchDiagrams(diagrams, term, partHits, { kind: kindTab, model: modelFilter, category, brand }),
    [diagrams, term, partHits, kindTab, modelFilter, category, brand],
  );
  // 도면이 수천 장이라 한 번에 다 그리면 핸드폰이 멈춘다 → 60장씩 보여주고 내려가면 더 그린다
  const [shown, setShown] = useSessionState("diagrams.shown", PAGE_SIZE);
  const filterKey = `${term}|${kindTab}|${modelFilter}|${category}|${brand}`;
  const prevFilter = useRef(filterKey);
  useEffect(() => {
    if (prevFilter.current !== filterKey) { prevFilter.current = filterKey; setShown(PAGE_SIZE); }
  }, [filterKey, setShown]);
  const moreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = moreRef.current;
    if (!el || shown >= results.length) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE_SIZE); },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, results.length]);

  const openDiagram = (d: Diagram, code?: string) => {
    listScroll.current = readScroll();
    const next = new URLSearchParams(params);
    next.set("d", d.id);
    if (code) next.set("p", code); else next.delete("p");
    next.delete("check");
    setParams(next);
  };
  const pushDiagram = (d: Diagram) => {
    const next = new URLSearchParams(params);
    next.set("d", [...openIds, d.id].join(","));
    next.delete("p");
    next.delete("check");
    setParams(next);
  };
  const closeDiagram = () => {
    // 앱 안에서 연 경우엔 진짜 뒤로가기(수리이력에서 왔으면 수리이력으로), 주소로 바로 들어온 경우엔 목록으로
    if (location.key !== "default") { navigate(-1); return; }
    const next = new URLSearchParams(params);
    const rest = openIds.slice(0, -1);
    if (rest.length) next.set("d", rest.join(",")); else next.delete("d");
    next.delete("p");
    next.delete("check");
    setParams(next, { replace: true });
  };
  const selectedId = selected?.id ?? null;
  useLayoutEffect(() => {
    if (selectedId) { writeScroll([0, 0]); return; }
    if (listScroll.current) {
      const pos = listScroll.current;
      // 목록이 다시 보이는 즉시, 그리고 한 박자 뒤(썸네일 자리 잡은 뒤) 한 번 더 맞춘다
      // 썸네일·카드가 다 그려질 때까지 키가 모자라 덜 내려갈 수 있어, 맞을 때까지 잠깐(최대 1.5초) 다시 맞춘다
      let tries = 0;
      let raf = 0;
      const fix = () => {
        writeScroll(pos);
        const now = readScroll();
        const ok = pos.every((v, i) => Math.abs((now[i] ?? 0) - v) < 4);
        if (!ok && tries++ < 90) raf = requestAnimationFrame(fix);
      };
      fix();
      const stop = () => { tries = 999; };
      window.addEventListener("wheel", stop, { once: true, passive: true });
      window.addEventListener("touchstart", stop, { once: true, passive: true });
      return () => { cancelAnimationFrame(raf); window.removeEventListener("wheel", stop); window.removeEventListener("touchstart", stop); };
    }
  }, [selectedId]);

  const { isAdmin } = useUserRole();
  const [labelOpen, setLabelOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const cartItems = useCart();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [modelName, setModelName] = useState("");
  const [maker, setMaker] = useState("얀마");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const pickFile = (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setSaving(true);
    try {
      const blob = await compressImage(file);
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(DIAGRAM_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      await addDiagram.mutateAsync({
        title: title.trim(),
        model_name: modelName.trim() || undefined,
        notes: notes.trim() || undefined,
        image_path: path,
        kind,
        manufacturer: maker.trim() || "얀마",
      });
      toast({ title: "도면이 등록되었습니다." });
      setUploadOpen(false);
      setTitle(""); setModelName(""); setNotes(""); setFile(null);
      setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    } catch (e: any) {
      toast({ title: "등록 실패", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const viewer = selected ? (
    <DiagramViewer
      key={selected.id}
      diagram={selected}
      allDiagrams={diagrams}
      initialPartCode={initialPart}
      checkedCodes={checkedParam ? checkedParam.split(",").filter(Boolean) : undefined}
      onBack={closeDiagram}
      onOpenDiagram={pushDiagram}
    />
  ) : openIds.length > 0 && isLoading ? (
    <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="w-full aspect-[4/3] rounded-xl" /></div>
  ) : null;

  return (
    <>
    {viewer}
    <div className={viewer ? "hidden" : undefined}>
      <PartOrderCartDialog open={cartOpen} onOpenChange={setCartOpen} />
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Map className="h-6 w-6 text-primary" /> 부품 도면
        </h1>
        <Button variant="outline" className="ml-auto gap-1.5" onClick={() => setCartOpen(true)}>
          <ShoppingCart className="h-4 w-4" /> 주문 목록{cartItems.length > 0 && <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-xs px-1.5">{cartItems.length}</span>}
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={() => setFinderOpen(true)}>
          <Sparkles className="h-4 w-4" /> 사진으로 찾기
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={() => setLabelOpen(true)}>
          <Tag className="h-4 w-4" /> 부품 사진(라벨)
        </Button>
        {isAdmin && (
          <Button variant="outline" className="gap-1.5" onClick={() => setPdfOpen(true)}>
            <FileUp className="h-4 w-4" /> PDF 자동 등록
          </Button>
        )}
        <Button className="gap-1.5" onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4" /> 도면 등록
        </Button>
      </div>

      <div className="relative mb-3">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="부품번호 · 기종 · 도면명으로 검색 (예: 129978-01331, YH1150, 예취부)"
          aria-label="도면 검색"
          className="pl-9 pr-9"
        />
        {term && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="검색어 지우기"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setTerm("")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {term.trim() && (
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
          {partPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          「{term.trim()}」 도면 {results.length}개
          {partPending ? " · 부품번호 검색 중" : ""}
        </p>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Tabs value={kindTab} onValueChange={(v) => setKindTab(v as "photo" | "diagram")}>
          <TabsList>
            <TabsTrigger value="photo">기계 사진</TabsTrigger>
            <TabsTrigger value="diagram">부품 도면</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {brands.length > 1 && (
        <div className="flex gap-1 mb-2 overflow-x-auto pb-0.5" role="tablist" aria-label="제조사">
          {[["전체", brands.reduce((a, [, n]) => a + n, 0)] as [string, number], ...brands].map(([b, n]) => (
            <button
              key={b}
              type="button"
              role="tab"
              aria-selected={brand === b}
              onClick={() => { setBrand(b); setModelFilter("전체"); }}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${brand === b ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
            >
              {b} <span className="text-[11px] opacity-70">{n.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-5 gap-1 mb-2 rounded-xl border bg-card p-1" role="tablist" aria-label="분류">
        {(["전체", ...DIAGRAM_CATEGORIES] as const).map((c) => {
          const n = c === "전체" ? [...categoryCounts.values()].reduce((a, b) => a + b, 0) : (categoryCounts.get(c) ?? 0);
          const on = category === c;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pickCategory(c)}
              className={`rounded-lg px-0.5 py-2 text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {c}
              <span className={`block text-[11px] font-normal ${on ? "opacity-90" : "opacity-70"}`}>{n.toLocaleString()}장</span>
            </button>
          );
        })}
      </div>

      <div className="mb-3">
        <div className="flex gap-1 flex-wrap">
          {models.length > 1 && models.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModelFilter(m)}
              className={`text-xs px-2.5 py-1 rounded-full border ${modelFilter === m ? "border-primary text-primary" : "text-muted-foreground"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}
        </div>
      ) : results.length === 0 && partPending ? (
        <p className="text-sm text-muted-foreground border rounded-xl p-8 text-center flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> 부품번호를 찾는 중…
        </p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-xl p-8 text-center">
          {term.trim()
            ? `「${term.trim()}」에 해당하는 도면이 없습니다. 부품번호는 하이픈을 빼고 적어도 찾습니다.`
            : category !== "전체"
              ? `${category} ${kindTab === "photo" ? "사진" : "도면"}은 아직 등록되지 않았습니다.`
            : kindTab === "photo"
              ? "등록된 기계 사진이 없습니다. 「도면 등록」에서 '기계 사진'을 골라 올려 주세요."
              : "등록된 도면이 없습니다. 「도면 등록」을 눌러 부품 배치도를 올려 주세요."}
        </p>
      ) : (
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-3">
          {results.slice(0, shown).map((r) => (
            <DiagramCard
              key={r.diagram.id}
              diagram={r.diagram}
              thumb={thumbs ? (thumbs.get(r.diagram.image_path ?? "") ?? null) : thumbsFailed ? null : undefined}
              match={r.partCount > 0 ? { codes: r.partCodes, count: r.partCount } : undefined}
              onClick={() => openDiagram(r.diagram, r.partCodes[0])}
              onDelete={() => deleteDiagram.mutate(r.diagram, {
                onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
              })}
            />
          ))}
          {shown < results.length && <div ref={moreRef} className="col-span-full h-10" aria-hidden />}
        </div>
      )}

      {/* 도면 등록 다이얼로그 */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>도면 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Tabs value={kind} onValueChange={(v) => setKind(v as "photo" | "diagram")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="photo">기계 사진</TabsTrigger>
                <TabsTrigger value="diagram">부품 도면</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input placeholder={kind === "photo" ? "사진 이름 (예: YH1150 좌측면)" : "도면 이름 (예: HV2200 헤머 벨트 배치도)"} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="기종 (선택, 예: HV2200)" value={modelName} onChange={(e) => setModelName(e.target.value)} />
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="제조사">
              {DIAGRAM_BRANDS.map((b) => (
                <button key={b} type="button" role="radio" aria-checked={maker === b} onClick={() => setMaker(b)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${maker === b ? "border-primary text-primary bg-primary/10" : "text-muted-foreground"}`}>{b}</button>
              ))}
            </div>
            <Textarea placeholder="메모 (선택)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

            {preview ? (
              <div className="relative">
                <img src={preview} alt="" className="w-full max-h-56 object-contain rounded-lg border bg-muted/30" />
                <button
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-1"
                  onClick={() => {
                    URL.revokeObjectURL(preview);
                    setPreview(null);
                    setFile(null);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => cameraRef.current?.click()}>
                  <Camera className="h-4 w-4" /> 촬영
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => galleryRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" /> 갤러리
                </Button>
              </div>
            )}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { pickFile(e.target.files); e.target.value = ""; }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { pickFile(e.target.files); e.target.value = ""; }}
            />

            <Button
              className="w-full"
              disabled={!file || !title.trim() || saving}
              onClick={handleUpload}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              등록
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <LabelPhotoDialog open={labelOpen} onOpenChange={setLabelOpen} />
      <PhotoPartFinderDialog open={finderOpen} onOpenChange={setFinderOpen} diagrams={diagrams} defaultModel={modelFilter} onOpen={openDiagram} />
      {isAdmin && <PdfDiagramImportDialog open={pdfOpen} onOpenChange={setPdfOpen} />}
    </div>
    </>
  );
}
