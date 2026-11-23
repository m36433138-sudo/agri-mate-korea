import { useMemo, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DIAGRAM_BUCKET } from "@/hooks/useDiagrams";
import { DIAGRAM_BRANDS, canonicalModelName } from "@/lib/diagramModelGroup";
import { createDigitReader, findCallouts, calloutHotspots } from "@/lib/calloutOcr";
import { extractPageTable, diagnosePdf, YANMAR_CODE_RE, LOOSE_CODE_RE, type PageText, type PdfPageReport } from "@/lib/pdfDiagramExtract";
import { FileUp, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** 이전 이름 유지 (다른 화면에서 씀) */
export const PART_CODE_RE = YANMAR_CODE_RE;

/** 글자 위치를 화면 좌표(회전 반영)로: 90° 돌린 얀마 책도 상자가 제자리에 */
async function pageText(page: any): Promise<{ items: PageText[]; vw: number; vh: number }> {
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const items: PageText[] = [];
  for (const i of tc.items as any[]) {
    if (!("str" in i) || !i.str.trim()) continue;
    const m = pdfjs.Util.transform(vp.transform, i.transform);
    const h = Math.hypot(m[2], m[3]) || i.height || 6;
    items.push({ str: i.str, x: m[4], y: m[5] - h, w: i.width || i.str.length * h * 0.55, h });
  }
  return { items, vw: vp.width, vh: vp.height };
}

export default function PdfDiagramImportDialog({ open, onOpenChange, modelNames = [] }: { open: boolean; onOpenChange: (v: boolean) => void; modelNames?: (string | null)[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState("");
  const [machineType, setMachineType] = useState("");
  const [maker, setMaker] = useState("얀마");
  const [loose, setLoose] = useState(false);
  const [keepImages, setKeepImages] = useState(true);
  const [ocr, setOcr] = useState(true);
  // 이미 있는 기종 이름 (쓰는 방식만 다른 같은 책이 따로 생기지 않게 추천)
  const existingModels = useMemo(() => [...new Set(modelNames.filter((m): m is string => !!m?.trim()))].sort(), [modelNames]);
  const modelName = canonicalModelName(model);
  const sameAs = existingModels.includes(modelName) && modelName !== model.trim()
    ? modelName
    : existingModels.find((m) => m !== model.trim() && canonicalModelName(m) === modelName);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<ReturnType<typeof diagnosePdf> | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, diagrams: 0, parts: 0, callouts: 0, note: "" });

  const analyze = async (f: File) => {
    setAnalyzing(true);
    setReport(null);
    try {
      const pdf = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
      const pages: PdfPageReport[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const { items } = await pageText(page);
        const strs = items.map((i) => i.str.trim().toUpperCase());
        pages.push({
          page: n,
          textCount: items.length,
          yanmarCodes: strs.filter((s) => YANMAR_CODE_RE.test(s)).length,
          looseCodes: strs.filter((s) => LOOSE_CODE_RE.test(s)).length,
        });
        page.cleanup();
      }
      const r = diagnosePdf(pages);
      setReport(r);
      if (r.kind === "format") setLoose(true);
      if (maker !== "얀마") setLoose(true);
    } catch (e: any) {
      setReport({ kind: "scan", message: `PDF를 열 수 없습니다: ${e.message}` });
    } finally {
      setAnalyzing(false);
    }
  };

  const run = async () => {
    if (!file || !modelName) return;
    const saveModel = sameAs ?? modelName;
    setBusy(true);
    let diagrams = 0, parts = 0, imageOnly = 0, callouts = 0;
    let reader: Awaited<ReturnType<typeof createDigitReader>> | null = null;
    try {
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      setProgress({ done: 0, total: pdf.numPages, diagrams: 0, parts: 0, callouts: 0, note: "" });
      const base = file.name.replace(/\.pdf$/i, "");
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const { items, vw, vh } = await pageText(page);
        const table = extractPageTable(items, vw, vh, { loose: loose || maker !== "얀마" });
        const hotspots: Record<string, unknown>[] = table.hotspots;
        const hasTable = hotspots.length >= 2;
        if (hasTable || (keepImages && items.length < 5)) {
          const figIdx = items.findIndex((i) => /^Fig\.?\s*\d+/i.test(i.str.trim()));
          const title = figIdx >= 0
            ? [items[figIdx].str, items[figIdx + 1]?.str].filter(Boolean).join(" ").trim().slice(0, 120)
            : `${base} p.${n}`;
          const vp1 = page.getViewport({ scale: 1 });
          const rvp = page.getViewport({ scale: 2400 / vp1.width });
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(rvp.width);
          canvas.height = Math.round(rvp.height);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: rvp }).promise;
          // 그림 번호가 글자가 아니라 그림으로 박힌 쪽: OCR로 찾아 부품표 번호와 맞춘다 (notes='ocr-auto')
          if (ocr && hasTable && table.textCallouts === 0 && table.refs.size > 0) {
            try {
              setProgress((p) => ({ ...p, note: reader ? `${n}쪽 그림 번호 읽는 중…` : "글자 읽기 도구 준비 중…" }));
              reader ??= await createDigitReader();
              const s = canvas.width / vw;
              const found = await findCallouts(reader, canvas, {
                region: { x0: 0, y0: 0, x1: table.tableLeft * s, y1: canvas.height },
                digitH: table.textHeight * s * 0.95,
                valid: new Set(table.refs.keys()),
              });
              const spots = calloutHotspots(found, table.refs, canvas.width, canvas.height);
              hotspots.push(...spots);
              callouts += spots.length;
            } catch (e) {
              console.warn("그림 번호 OCR 실패, 부품표만 등록", e);
            }
          }
          const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("이미지 변환 실패"))), "image/jpeg", 0.85));
          canvas.width = canvas.height = 0;
          const path = `pdf-import/${Date.now()}-${n}-${Math.random().toString(36).slice(2, 6)}.jpg`;
          const { error: upErr } = await supabase.storage.from(DIAGRAM_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
          if (upErr) throw upErr;
          const { data: d, error: dErr } = await (supabase as any).from("diagrams").insert({
            title: `${title} (${saveModel})`, model_name: saveModel, machine_type: machineType.trim() || null,
            manufacturer: maker, image_path: path, kind: "diagram", sort_order: n,
            notes: hasTable ? `${file.name} ${n}쪽 자동 등록` : `${file.name} ${n}쪽 · 글자 없는 쪽(스캔) — 번호는 영역 편집으로 지정`,
          }).select("id").single();
          if (dErr) { await supabase.storage.from(DIAGRAM_BUCKET).remove([path]); throw dErr; }
          if (hasTable) {
            const { error: hErr } = await (supabase as any).from("diagram_hotspots").insert(hotspots.map((h) => ({ ...h, diagram_id: d.id })));
            if (hErr) throw hErr;
            parts += hotspots.length;
          } else imageOnly++;
          diagrams++;
        }
        page.cleanup();
        setProgress({ done: n, total: pdf.numPages, diagrams, parts, callouts, note: "" });
      }
      toast({
        title: "PDF 도면 등록 완료",
        description: `「${saveModel}」 도면 ${diagrams}장, 부품 영역 ${parts}개${callouts ? ` (그림 번호 자동 표시 ${callouts}곳 포함)` : ""}${imageOnly ? ` · 글자 없는 쪽 ${imageOnly}장은 그림만` : ""}`,
      });
      onOpenChange(false);
      setFile(null);
      setReport(null);
    } catch (e: any) {
      toast({ title: "PDF 등록 실패", description: `${e.message} (지금까지 도면 ${diagrams}장 등록됨)`, variant: "destructive" });
    } finally {
      await reader?.terminate().catch(() => {});
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["diagrams"] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>PDF 도면 자동 등록</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">부품표가 있는 쪽을 찾아 부품번호·부품명을 읽고, 그림 속 번호도 (글자가 아니면 OCR로) 찾아 눌러지게 등록합니다. 파일을 고르면 먼저 읽을 수 있는지 확인합니다.</p>
          <Input type="file" accept="application/pdf" disabled={busy} onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f) analyze(f); }} />
          {analyzing && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> PDF 확인 중…</p>}
          {report && (
            <div className={`text-xs rounded-lg px-3 py-2 flex gap-2 ${report.kind === "ok" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
              {report.kind === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
              <span>{report.message}</span>
            </div>
          )}
          <div className="space-y-1">
            <Input placeholder="기종 (필수, 예: YT488, YH6140 / YH7140)" value={model} disabled={busy} list="pdf-import-models" onChange={(e) => setModel(e.target.value)} />
            <datalist id="pdf-import-models">{existingModels.map((m) => <option key={m} value={m} />)}</datalist>
            {model.trim() && (sameAs || modelName !== model.trim()) && (
              <p className="text-xs text-muted-foreground">
                「{sameAs ?? modelName}」{sameAs ? " (이미 있는 기종)" : ""}으로 등록돼요.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">한 책이 여러 기종 공용이면 한 이름에 모두 적어요 (예: YH6140 / YH7140). 기종 버튼에는 각각 나옵니다.</p>
          </div>
          <Input placeholder="종류 (선택, 예: 트랙터·로타리)" value={machineType} disabled={busy} onChange={(e) => setMachineType(e.target.value)} />
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">제조사</p>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="제조사">
              {DIAGRAM_BRANDS.map((b) => (
                <button key={b} type="button" role="radio" aria-checked={maker === b} disabled={busy} onClick={() => { setMaker(b); if (b !== "얀마") setLoose(true); }}
                  className={`text-xs px-2.5 py-1 rounded-full border ${maker === b ? "border-primary text-primary bg-primary/10" : "text-muted-foreground"}`}>{b}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={loose} disabled={busy} onCheckedChange={(v) => setLoose(!!v)} /> 타사 번호 형식도 읽기 (하이픈 없는 번호 등)</label>
          <label className="flex items-start gap-2 text-sm"><Checkbox className="mt-0.5" checked={ocr} disabled={busy} onCheckedChange={(v) => setOcr(!!v)} /><span>그림 번호 자동 찾기 (OCR)<span className="block text-[11px] text-muted-foreground">그림 번호가 글자가 아닌 책에서 숫자를 읽어 부품표와 맞춰요. 한 쪽에 1~3초 더 걸려요.</span></span></label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={keepImages} disabled={busy} onCheckedChange={(v) => setKeepImages(!!v)} /> 글자 없는 쪽(스캔)도 그림으로 등록</label>
          {busy && (
            <div className="space-y-1">
              <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
              <p className="text-xs text-muted-foreground">{progress.done}/{progress.total}쪽 · 도면 {progress.diagrams}장 · 부품 영역 {progress.parts}개{progress.callouts ? ` · 그림 번호 ${progress.callouts}곳` : ""}{progress.note ? ` · ${progress.note}` : ""}</p>
            </div>
          )}
          <Button className="w-full gap-1.5" disabled={!file || !modelName || busy || analyzing} onClick={run}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} 읽어서 등록
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
