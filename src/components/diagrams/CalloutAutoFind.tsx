import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { DiagramHotspot } from "@/hooks/useDiagrams";
import { findCalloutsForDiagram, OCR_AUTO_NOTE } from "@/lib/calloutOcr";
import { Loader2, ScanSearch, Undo2 } from "lucide-react";

/** 도면 그림을 캔버스로 (서명 URL을 blob으로 받아 그리므로 캔버스가 막히지 않는다). 너무 크면 줄인다. */
async function loadCanvas(url: string): Promise<HTMLCanvasElement> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`도면 그림을 받지 못했어요 (${res.status})`);
  const bmp = await createImageBitmap(await res.blob());
  const scale = Math.min(1, 3200 / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

/**
 * 영역 편집에서: 그림 번호를 OCR로 찾아 부품표 번호와 맞춰 자동 표시(notes='ocr-auto')하고,
 * 마음에 안 들면 이 도면의 자동 표시만 한 번에 지운다. 손으로 만든 영역은 건드리지 않는다.
 */
export default function CalloutAutoFind({ diagramId, imageUrl, hotspots }: { diagramId: string; imageUrl: string | null | undefined; hotspots: DiagramHotspot[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoCount = hotspots.filter((h) => h.notes === OCR_AUTO_NOTE).length;
  const refresh = () => qc.invalidateQueries({ queryKey: ["diagram-hotspots", diagramId] });

  const run = async () => {
    if (!imageUrl) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setStep("도면 그림 준비 중…");
    try {
      const canvas = await loadCanvas(imageUrl);
      setStep("글자 읽기 도구 준비 중… (처음 한 번은 조금 걸려요)");
      const r = await findCalloutsForDiagram(canvas, hotspots as unknown as Parameters<typeof findCalloutsForDiagram>[1], { signal: ac.signal, onStep: setStep });
      canvas.width = canvas.height = 0;
      if (ac.signal.aborted) return;
      if (!r.spots.length) {
        toast({ title: "새로 찾은 번호가 없어요", description: r.reason ?? "그림 번호가 이미 다 표시돼 있거나 읽을 수 없는 그림이에요" });
        return;
      }
      const { error } = await (supabase as any).from("diagram_hotspots").insert(r.spots.map((s) => ({ ...s, diagram_id: diagramId, target_diagram_id: null })));
      if (error) throw error;
      const nos = new Set(r.spots.map((s) => s.callout_no)).size;
      toast({ title: `그림 번호 ${r.spots.length}곳 표시`, description: `부품표 번호 ${r.refs}개 중 ${nos}개를 그림에서 찾았어요. 틀린 곳은 상자를 눌러 고치거나 「자동 표시 지우기」로 되돌리세요.` });
    } catch (e) {
      toast({ title: "번호 자동 찾기 실패", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      abortRef.current = null;
      setStep(null);
      refresh();
    }
  };

  const undo = async () => {
    if (!confirm(`이 도면에 자동으로 표시된 번호 ${autoCount}곳을 지울까요? 손으로 만든 영역은 그대로 둡니다.`)) return;
    const { error } = await (supabase as any).from("diagram_hotspots").delete().eq("diagram_id", diagramId).eq("notes", OCR_AUTO_NOTE);
    if (error) toast({ title: "지우기 실패", description: error.message, variant: "destructive" });
    else toast({ title: `자동 표시 ${autoCount}곳을 지웠어요` });
    refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2">
      <Button size="sm" variant="secondary" className="gap-1.5" disabled={!imageUrl || !!step} onClick={run}>
        {step ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />} 번호 자동 찾기
      </Button>
      {step && (
        <>
          <span className="text-xs text-muted-foreground">{step}</span>
          <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}>멈추기</Button>
        </>
      )}
      {!step && autoCount > 0 && (
        <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={undo}>
          <Undo2 className="h-4 w-4" /> 자동 표시 지우기 ({autoCount})
        </Button>
      )}
      {!step && (
        <span className="text-[11px] text-muted-foreground basis-full sm:basis-auto">
          그림 속 번호를 읽어 부품표 번호와 맞춥니다. 부품표에 없는 숫자는 쓰지 않아요.
        </span>
      )}
    </div>
  );
}
