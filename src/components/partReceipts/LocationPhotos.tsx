import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { PHOTO_BUCKET, db } from "./receiptData";

type LocPhoto = { id: string; branch: string; part_code: string; location: string | null; photo_path: string; created_at: string; created_by: string | null; url: string };

/** 사진을 1600px JPEG로 줄인다 (창고 선반 사진이라 이 정도면 충분) */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("사진 변환 실패"))), "image/jpeg", 0.82));
}

export function useLocationPhotos(partCode: string | null | undefined, branch?: string) {
  return useQuery<LocPhoto[]>({
    queryKey: ["location-photos", partCode, branch ?? "all"],
    enabled: !!partCode,
    staleTime: 60_000,
    queryFn: async () => {
      let q = db.from("inventory_location_photos").select("*").eq("part_code", partCode).order("created_at", { ascending: false }).limit(12);
      if (branch) q = q.eq("branch", branch);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as Omit<LocPhoto, "url">[];
      if (!rows.length) return [];
      const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(rows.map((r) => r.photo_path), 3600);
      return rows.map((r, i) => ({ ...r, url: signed?.[i]?.signedUrl ?? "" })).filter((r) => r.url);
    },
  });
}

/**
 * 적재 위치 사진: 찍어서 올리면 같은 부품을 찾는 직원 모두가 본다.
 * compact = 입고 줄 안에서 쓰는 작은 모양 (사진 개수 + 찍기 버튼)
 */
export function LocationPhotos({
  partCode, branch, location, compact = false, canAdd = true,
}: { partCode: string; branch: string; location?: string | null; compact?: boolean; canAdd?: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<LocPhoto | null>(null);
  const { data: photos = [] } = useLocationPhotos(partCode, compact ? branch : undefined);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      for (const f of Array.from(files).slice(0, 4)) {
        const blob = await shrink(f);
        const safe = partCode.replace(/[^0-9A-Za-z-]/g, "_") || "part";
        const path = `locations/${branch}/${safe}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
        const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const { error } = await db.from("inventory_location_photos").insert({ branch, part_code: partCode, location: location || null, photo_path: path, created_by: u.user?.id });
        if (error) { await supabase.storage.from(PHOTO_BUCKET).remove([path]); throw error; }
      }
      qc.invalidateQueries({ queryKey: ["location-photos", partCode] });
      toast({ title: "위치 사진을 올렸어요", description: `${branch} · ${partCode}${location ? ` · ${location}` : ""}` });
    } catch (e: any) {
      toast({ title: "사진을 올리지 못했어요", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: LocPhoto) => {
    if (!confirm("이 위치 사진을 지울까요?")) return;
    const { error } = await db.from("inventory_location_photos").delete().eq("id", p.id);
    if (error) { toast({ title: "지우지 못했어요", description: "올린 사람이나 관리자만 지울 수 있어요.", variant: "destructive" }); return; }
    await supabase.storage.from(PHOTO_BUCKET).remove([p.photo_path]);
    setZoom(null);
    qc.invalidateQueries({ queryKey: ["location-photos", partCode] });
  };

  const picker = (
    <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hidden"
      onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
  );
  const zoomDialog = (
    <Dialog open={!!zoom} onOpenChange={(v) => !v && setZoom(null)}>
      <DialogContent className="max-w-3xl p-2 sm:p-3">
        <DialogTitle className="sr-only">위치 사진</DialogTitle>
        {zoom && (
          <div className="space-y-2">
            <img src={zoom.url} alt="적재 위치" className="w-full max-h-[75vh] object-contain rounded-2xl bg-muted" />
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-muted-foreground">{zoom.branch}{zoom.location ? ` · ${zoom.location}` : ""} · {zoom.created_at.slice(0, 10)}</span>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(zoom)}><Trash2 className="h-4 w-4 mr-1" />지우기</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {photos.slice(0, 3).map((p) => (
          <button key={p.id} type="button" onClick={() => setZoom(p)} className="h-10 w-10 rounded-lg overflow-hidden border bg-muted shrink-0">
            <img src={p.url} alt="위치 사진" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
        {canAdd && (
          <Button type="button" variant="outline" className="h-10 rounded-full px-3 gap-1.5 shrink-0" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <span className="text-xs">{photos.length ? "추가" : "위치 사진"}</span>
          </Button>
        )}
        {picker}
        {zoomDialog}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-xl p-3">아직 적재 위치 사진이 없어요. 찍어서 올리면 모두가 같이 봐요.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button key={p.id} type="button" onClick={() => setZoom(p)} className="relative aspect-square rounded-xl overflow-hidden border bg-muted">
              <img src={p.url} alt="적재 위치" className="h-full w-full object-cover" loading="lazy" />
              <span className="absolute bottom-1 left-1 right-1 truncate rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {p.branch}{p.location ? ` · ${p.location}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      {canAdd && (
        <Button type="button" variant="outline" className="rounded-full gap-1.5" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} 위치 사진 찍어 올리기 ({branch})
        </Button>
      )}
      {picker}
      {zoomDialog}
    </div>
  );
}
