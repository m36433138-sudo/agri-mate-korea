import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, ImagePlus, Loader2, Sparkles, Map as MapIcon } from "lucide-react";
import type { Diagram } from "@/hooks/useDiagrams";
import { diagramIdsForModel, photoModelOptions } from "@/lib/photoPartFinder";

type Area = { diagram_id: string; title: string; reason: string };
type Match = Area & { part_code: string; part_name: string | null; callout_no: string | null; confidence: string };
type Result = { description: string; areas: Area[]; matches: Match[] };

async function toJpegDataUrl(file: File, max = 1600): Promise<string> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

const confClass: Record<string, string> = {
  높음: "bg-emerald-950/60 text-emerald-400 border-emerald-800",
  보통: "bg-amber-950/60 text-amber-400 border-amber-800",
  낮음: "bg-muted text-muted-foreground",
};

export default function PhotoPartFinderDialog({
  open, onOpenChange, diagrams, defaultModel, onOpen,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  diagrams: Diagram[];
  defaultModel?: string;
  onOpen: (d: Diagram, code?: string) => void;
}) {
  const { toast } = useToast();
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const options = useMemo(() => photoModelOptions(diagrams), [diagrams]);
  const [model, setModel] = useState(defaultModel && defaultModel !== "전체" ? defaultModel : "");
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const byId = useMemo(() => new globalThis.Map(diagrams.map((d) => [d.id, d])), [diagrams]);
  const shown = options.filter((m) => !q.trim() || m.toUpperCase().includes(q.trim().toUpperCase())).slice(0, 40);

  const run = async (f?: File) => {
    if (!f || !model) return;
    setResult(null);
    const dataUrl = await toJpegDataUrl(f);
    setPreview(dataUrl);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("find-part-by-photo", {
        body: { image: dataUrl, model, diagram_ids: diagramIdsForModel(diagrams, model) },
      });
      if (error) {
        const ctx = (error as any).context;
        const msg = ctx?.json ? (await ctx.json().catch(() => null))?.error : null;
        throw new Error(msg || error.message);
      }
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      toast({ title: "사진 인식 실패", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const go = (id: string, code?: string) => {
    const d = byId.get(id);
    if (!d) return;
    onOpenChange(false);
    onOpen(d, code);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setResult(null); setPreview(null); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> 사진으로 부품 찾기</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">1. 모델 {model && <span className="text-primary">· {model}</span>}</p>
            <Input placeholder="모델 검색 (예: YH7140)" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {shown.map((m) => (
                <button key={m} type="button" onClick={() => { setModel(m); setResult(null); }}
                  className={`text-xs px-2.5 py-1 rounded-full border ${model === m ? "border-primary text-primary bg-primary/10" : "text-muted-foreground"}`}>
                  {m}
                </button>
              ))}
              {shown.length === 0 && <p className="text-xs text-muted-foreground">해당 모델의 부품 도면이 없어요.</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">2. 부품 사진</p>
            <p className="text-xs text-muted-foreground">부품 전체가 보이게 찍고, 기계에 달린 상태면 주변도 조금 나오게 찍어 주세요.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" disabled={!model || busy} onClick={() => cam.current?.click()}><Camera className="h-4 w-4" /> 촬영</Button>
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" disabled={!model || busy} onClick={() => gal.current?.click()}><ImagePlus className="h-4 w-4" /> 갤러리</Button>
            </div>
            <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { run(e.target.files?.[0]); e.target.value = ""; }} />
            <input ref={gal} type="file" accept="image/*" className="hidden" onChange={(e) => { run(e.target.files?.[0]); e.target.value = ""; }} />
          </div>

          {preview && <img src={preview} alt="찾을 부품 사진" className="w-full max-h-52 object-contain rounded-lg border bg-muted/30" />}
          {busy && <p className="text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> 도면과 비교하는 중… (20~40초)</p>}

          {result && !busy && (
            <div className="space-y-3">
              {result.description && <p className="text-xs text-muted-foreground">AI가 본 사진: {result.description}</p>}
              <div className="space-y-2">
                <p className="text-sm font-medium">부품 후보</p>
                {result.matches.length === 0 && <p className="text-xs text-muted-foreground">딱 맞는 부품을 못 찾았어요. 아래 도면을 열어 직접 확인해 주세요.</p>}
                {result.matches.map((m) => (
                  <button key={m.diagram_id + m.part_code} type="button" onClick={() => go(m.diagram_id, m.part_code)}
                    className="w-full text-left border rounded-lg p-2.5 hover:border-primary space-y-1">
                    <div className="flex items-center gap-2">
                      {m.callout_no && <span className="text-xs rounded bg-primary/15 text-primary px-1.5">{m.callout_no}</span>}
                      <span className="font-mono text-sm">{m.part_code}</span>
                      <span className="text-sm truncate flex-1">{m.part_name}</span>
                      <Badge variant="outline" className={confClass[m.confidence] ?? ""}>{m.confidence}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{m.title}</p>
                    {m.reason && <p className="text-xs text-muted-foreground">{m.reason}</p>}
                  </button>
                ))}
              </div>
              {result.areas.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">해당 부분 도면</p>
                  {result.areas.map((a) => (
                    <button key={a.diagram_id} type="button" onClick={() => go(a.diagram_id)}
                      className="w-full text-left border rounded-lg p-2 hover:border-primary flex items-start gap-2">
                      <MapIcon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <div className="min-w-0"><p className="text-sm truncate">{a.title}</p>{a.reason && <p className="text-xs text-muted-foreground">{a.reason}</p>}</div>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">AI 추천이라 틀릴 수 있어요. 도면을 열어 모양을 꼭 확인해 주세요.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
