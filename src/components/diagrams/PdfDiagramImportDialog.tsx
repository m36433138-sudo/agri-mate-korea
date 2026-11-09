import { useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DIAGRAM_BUCKET } from "@/hooks/useDiagrams";
import { FileUp, Loader2 } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** 얀마 부품번호 형식: 1A8060-00600, 129107-44590, 26106-060162 (+ -YNK 등 접미사) */
export const PART_CODE_RE = /^[0-9A-Z]{5,6}-[0-9A-Z]{5,6}(-[0-9A-Z]{1,3})?$/;

type TextItem = { str: string; x: number; y: number; w: number; h: number };

export function extractHotspots(items: TextItem[], vw: number, vh: number) {
  const out: { part_code: string; part_name: string | null; x: number; y: number; w: number; h: number }[] = [];
  for (const it of items) {
    const code = it.str.trim().toUpperCase();
    if (!PART_CODE_RE.test(code)) continue;
    const name = items
      .filter((o) => o !== it && Math.abs(o.y - it.y) < Math.max(3, it.h * 0.6) && o.x > it.x + it.w - 1 && o.str.trim() && !PART_CODE_RE.test(o.str.trim().toUpperCase()))
      .sort((a, b) => a.x - b.x)[0];
    const pad = 0.3;
    out.push({
      part_code: code,
      part_name: name?.str.trim() || null,
      x: Math.max(0, (it.x / vw) * 100 - pad),
      y: Math.max(0, ((vh - it.y - it.h) / vh) * 100 - pad),
      w: Math.min(100, (it.w / vw) * 100 + pad * 2),
      h: Math.min(100, (it.h / vh) * 100 + pad * 2),
    });
  }
  return out;
}

export default function PdfDiagramImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState("");
  const [machineType, setMachineType] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, diagrams: 0, parts: 0 });

  const run = async () => {
    if (!file || !model.trim()) return;
    setBusy(true);
    let diagrams = 0, parts = 0;
    try {
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      setProgress({ done: 0, total: pdf.numPages, diagrams: 0, parts: 0 });
      const base = file.name.replace(/\.pdf$/i, "");
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const items: TextItem[] = (tc.items as any[])
          .filter((i) => "str" in i && i.str.trim())
          .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height || Math.abs(i.transform[3]) }));
        const hotspots = extractHotspots(items, vp.width, vp.height);
        if (hotspots.length >= 2) {
          const figIdx = items.findIndex((i) => /^Fig\.?\s*\d+/i.test(i.str.trim()));
          const title = figIdx >= 0
            ? [items[figIdx].str, items[figIdx + 1]?.str].filter(Boolean).join(" ").trim().slice(0, 120)
            : `${base} p.${n}`;
          const scale = 2400 / vp.width;
          const rvp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(rvp.width);
          canvas.height = Math.round(rvp.height);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: rvp }).promise;
          const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("이미지 변환 실패"))), "image/jpeg", 0.85));
          const path = `pdf-import/${Date.now()}-${n}-${Math.random().toString(36).slice(2, 6)}.jpg`;
          const { error: upErr } = await supabase.storage.from(DIAGRAM_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
          if (upErr) throw upErr;
          const { data: d, error: dErr } = await (supabase as any).from("diagrams").insert({
            title: `${title} (${model.trim()})`, model_name: model.trim(), machine_type: machineType.trim() || null,
            image_path: path, kind: "diagram", sort_order: n, notes: `${file.name} ${n}쪽 자동 등록`,
          }).select("id").single();
          if (dErr) { await supabase.storage.from(DIAGRAM_BUCKET).remove([path]); throw dErr; }
          const { error: hErr } = await (supabase as any).from("diagram_hotspots").insert(hotspots.map((h) => ({ ...h, diagram_id: d.id })));
          if (hErr) throw hErr;
          diagrams++; parts += hotspots.length;
        }
        page.cleanup();
        setProgress({ done: n, total: pdf.numPages, diagrams, parts });
      }
      toast({ title: "PDF 도면 등록 완료", description: `도면 ${diagrams}장, 부품번호 ${parts}개를 읽었습니다.` });
      onOpenChange(false);
      setFile(null);
    } catch (e: any) {
      toast({ title: "PDF 등록 실패", description: `${e.message} (지금까지 도면 ${diagrams}장 등록됨)`, variant: "destructive" });
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["diagrams"] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>PDF 도면 자동 등록</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">부품 목록이 있는 페이지를 찾아 부품번호를 자동으로 읽고, 누를 수 있는 영역으로 등록합니다. 스캔본(글자가 그림인 PDF)은 읽을 수 없습니다.</p>
          <Input type="file" accept="application/pdf" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Input placeholder="기종 (필수, 예: YT488)" value={model} disabled={busy} onChange={(e) => setModel(e.target.value)} />
          <Input placeholder="종류 (선택, 예: 트랙터)" value={machineType} disabled={busy} onChange={(e) => setMachineType(e.target.value)} />
          {busy && (
            <div className="space-y-1">
              <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
              <p className="text-xs text-muted-foreground">{progress.done}/{progress.total}쪽 · 도면 {progress.diagrams}장 · 부품번호 {progress.parts}개</p>
            </div>
          )}
          <Button className="w-full gap-1.5" disabled={!file || !model.trim() || busy} onClick={run}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} 읽어서 등록
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
