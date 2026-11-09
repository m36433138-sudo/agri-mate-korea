import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, ImagePlus, Loader2, Check } from "lucide-react";

type Match = { read: string; part_code: string; part_name: string | null; source: string };

async function toJpeg(file: File, max = 1600): Promise<Blob> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("이미지 변환 실패"))), "image/jpeg", 0.85));
}
const toDataUrl = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(b); });

export default function LabelPhotoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [manual, setManual] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setBlob(null); setPreview(null); setCodes(null); setMatches([]); setManual(""); };

  const pick = async (f?: File) => {
    if (!f) return;
    reset();
    const b = await toJpeg(f);
    setBlob(b);
    const dataUrl = await toDataUrl(b);
    setPreview(dataUrl);
    setReading(true);
    try {
      const { data, error } = await supabase.functions.invoke("read-part-label", { body: { image: dataUrl } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCodes(data.codes ?? []);
      setMatches(data.matches ?? []);
    } catch (e: any) {
      toast({ title: "라벨 판독 실패", description: e.message, variant: "destructive" });
      setCodes([]);
    } finally { setReading(false); }
  };

  const save = async (part_code: string, part_name: string | null) => {
    if (!blob) return;
    setSaving(true);
    try {
      const path = `${part_code}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: up } = await supabase.storage.from("part-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (up) throw up;
      const { error } = await (supabase as any).from("part_tips").insert({
        part_code, part_name, content: "라벨 사진 (자동 인식 등록)", photo_paths: [path],
      });
      if (error) { await supabase.storage.from("part-photos").remove([path]); throw error; }
      qc.invalidateQueries({ queryKey: ["diagram-part-photos", part_code] });
      qc.invalidateQueries({ queryKey: ["part-tips"] });
      toast({ title: `${part_code}에 사진을 연결했습니다.` });
      reset(); onOpenChange(false);
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>부품 사진 등록 (라벨 자동 인식)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {preview ? (
            <img src={preview} alt="" className="w-full max-h-56 object-contain rounded-lg border bg-muted/30" />
          ) : (
            <p className="text-xs text-muted-foreground">부품 라벨(스티커·포장·각인)이 잘 보이게 찍어 주세요. 부품번호를 읽어 해당 부품에 사진을 연결합니다.</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" disabled={reading || saving} onClick={() => cam.current?.click()}><Camera className="h-4 w-4" /> 촬영</Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" disabled={reading || saving} onClick={() => gal.current?.click()}><ImagePlus className="h-4 w-4" /> 갤러리</Button>
          </div>
          <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={gal} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

          {reading && <p className="text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> 라벨을 읽는 중…</p>}

          {codes && !reading && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">읽은 번호: {codes.length ? codes.join(", ") : "없음"}</p>
              {matches.map((m) => (
                <button key={m.part_code} type="button" disabled={saving} onClick={() => save(m.part_code, m.part_name)}
                  className="w-full text-left border rounded-lg p-2.5 hover:border-primary flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm">{m.part_code}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.part_name || "—"}</p>
                  </div>
                  <Badge variant="outline">{m.source}</Badge>
                  <Check className="h-4 w-4 text-primary" />
                </button>
              ))}
              {matches.length === 0 && <p className="text-sm text-muted-foreground">도면·재고에서 일치하는 부품번호를 찾지 못했습니다. 직접 입력해 연결할 수 있습니다.</p>}
              <div className="flex gap-2">
                <Input placeholder="부품번호 직접 입력" value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} />
                <Button disabled={!manual.trim() || saving} onClick={() => save(manual.trim(), null)}>연결</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
