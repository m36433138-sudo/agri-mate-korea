import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Plus, Scissors, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { useToast } from "@/hooks/use-toast";

const db = supabase as any;
const BUCKET = "blade-photos";
const SHEET_TAB = "연마 칼날";
const STATUSES = ["맡김", "연마중", "연마완료", "찾아감", "폐기처분"];
const APP_URL = "https://cs.gwangmun.com";

type Blade = {
  id: string; customer_name: string; customer_id: string | null; branch: string;
  quantity: number; status: string; notes: string | null; photo_paths: string[]; sheet_synced: boolean;
  sheet_row_index: number | null; created_at: string; urls?: string[];
};

async function compress(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("이미지를 읽을 수 없습니다.")); i.src = url;
    });
    const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("압축 실패")), "image/jpeg", 0.82));
  } finally { URL.revokeObjectURL(url); }
}

async function sheet(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("google-sheets", { body });
  if (error || data?.error) throw new Error(data?.error || error?.message || "시트 연동 실패");
  return data;
}

export function BladeSharpeningPanel({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<Blade[]>({
    queryKey: ["blade-sharpenings"],
    queryFn: async () => {
      const { data, error } = await db.from("blade_sharpenings").select("*").order("created_at", { ascending: false }).limit(compact ? 10 : 200);
      if (error) throw error;
      const paths = (data as Blade[]).flatMap(b => b.photo_paths);
      const map = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
        signed?.forEach(s => s.signedUrl && s.path && map.set(s.path, s.signedUrl));
      }
      return (data as Blade[]).map(b => ({ ...b, urls: b.photo_paths.map(p => map.get(p) || "") }));
    },
  });

  // 시트 링크로 들어온 경우 해당 사진 바로 열기
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("blade");
    const hit = id && items.find(i => i.id === id);
    if (hit && hit.urls?.[0]) setViewer(hit.urls[0]);
  }, [items]);

  const changeStatus = useMutation({
    mutationFn: async ({ b, status }: { b: Blade; status: string }) => {
      const { error } = await db.from("blade_sharpenings").update({ status }).eq("id", b.id);
      if (error) throw error;
      if (b.sheet_row_index) {
        try { await sheet({ action: "updateCell", sheetName: SHEET_TAB, rowIndex: b.sheet_row_index, col: "E", value: status }); }
        catch (e: any) {
          await db.from("blade_sharpenings").update({ sheet_synced: false }).eq("id", b.id);
          toast({ title: "앱에는 저장, 시트 반영 실패", description: e.message, variant: "destructive" });
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blade-sharpenings"] }),
  });

  const retrySync = useMutation({
    mutationFn: async (b: Blade) => {
      if (b.sheet_row_index) {
        await sheet({ action: "updateCell", sheetName: SHEET_TAB, rowIndex: b.sheet_row_index, col: "E", value: b.status });
        await db.from("blade_sharpenings").update({ sheet_synced: true }).eq("id", b.id);
      } else {
        const link = `=HYPERLINK("${APP_URL}/blades?blade=${b.id}","사진 ${b.photo_paths.length}장")`;
        const res = await sheet({ action: "addRow", sheetName: SHEET_TAB, values: [b.customer_name, b.branch, String(b.quantity), link, b.status, b.notes || ""] });
        const m = (res?.result?.updates?.updatedRange as string | undefined)?.match(/!(?:[A-Z]+)(\d+)/);
        await db.from("blade_sharpenings").update({ sheet_synced: true, sheet_row_index: m ? Number(m[1]) : null }).eq("id", b.id);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blade-sharpenings"] }); toast({ title: "시트에 다시 반영했습니다" }); },
    onError: (e: any) => toast({ title: "시트 반영 실패", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (b: Blade) => {
      if (b.photo_paths.length) await supabase.storage.from(BUCKET).remove(b.photo_paths);
      const { error } = await db.from("blade_sharpenings").delete().eq("id", b.id);
      if (error) throw error;
      if (b.sheet_row_index) { try { await sheet({ action: "clearRow", sheetName: SHEET_TAB, rowIndex: b.sheet_row_index }); } catch { /* ignore */ } }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blade-sharpenings"] }); toast({ title: "삭제했습니다" }); },
  });

  return (
    <Card className="bg-card mb-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><Scissors className="h-4 w-4" /> 예취 칼날 연마</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Camera className="h-4 w-4 mr-1" /> 사진 올리기</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">불러오는 중…</p>}
        {!isLoading && items.length === 0 && <p className="text-sm text-muted-foreground">등록된 칼날이 없습니다.</p>}
        {items.map(b => (
          <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
            <div className="flex gap-1 shrink-0">
              {b.urls?.slice(0, 2).map((u, i) => u && (
                <button key={i} onClick={() => setViewer(u)}><img src={u} alt="칼날" className="h-14 w-14 rounded object-cover" /></button>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{b.customer_name} <span className="text-xs text-muted-foreground">· {b.branch} · {b.quantity}개</span></p>
              <p className="text-xs text-muted-foreground truncate">{new Date(b.created_at).toLocaleDateString("ko-KR")}{b.notes ? ` · ${b.notes}` : ""}</p>
              <div className="flex items-center gap-2 mt-1">
                {b.sheet_synced
                  ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400">시트 반영됨</span>
                  : <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-400">시트 미반영</span>}
                {!b.sheet_synced && (
                  <button className="text-[11px] text-primary underline disabled:opacity-50" disabled={retrySync.isPending}
                    onClick={() => retrySync.mutate(b)}>{retrySync.isPending && retrySync.variables?.id === b.id ? "재시도 중…" : "다시 시도"}</button>
                )}
              </div>
            </div>
            <Select value={b.status} onValueChange={s => changeStatus.mutate({ b, status: s })}>
              <SelectTrigger className="h-8 w-[104px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            {!compact && (
              <Button size="icon" variant="ghost" onClick={() => confirm("삭제할까요?") && remove.mutate(b)}><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        ))}
      </CardContent>
      <AddBladeDialog open={open} onClose={() => setOpen(false)} />
      <Dialog open={!!viewer} onOpenChange={v => !v && setViewer(null)}>
        <DialogContent className="max-w-3xl">{viewer && <img src={viewer} alt="칼날 사진" className="w-full rounded" />}</DialogContent>
      </Dialog>
    </Card>
  );
}

function AddBladeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [branch, setBranch] = useState("장흥");
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setName(""); setCustomerId(null); setQty("1"); setNotes(""); setFiles([]); } }, [open]);

  const save = async () => {
    if (!name.trim()) return toast({ title: "고객 이름을 입력하세요", variant: "destructive" });
    if (!files.length) return toast({ title: "사진을 한 장 이상 찍어주세요", variant: "destructive" });
    setSaving(true);
    const uploaded: string[] = [];
    try {
      for (const f of files) {
        const blob = await compress(f);
        const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        uploaded.push(path);
      }
      const qtyText = qty.trim() || "1";
      const { data: row, error } = await db.from("blade_sharpenings").insert({
        customer_name: name.trim(), customer_id: customerId, branch, status: "맡김",
        quantity: Math.max(1, Math.round(parseFloat(qtyText) || 1)),
        notes: [qtyText !== String(parseInt(qtyText)) ? `수량 ${qtyText}` : "", notes].filter(Boolean).join(" · ") || null,
        photo_paths: uploaded,
      }).select().single();
      if (error) throw error;

      try {
        const link = `=HYPERLINK("${APP_URL}/blades?blade=${row.id}","사진 ${uploaded.length}장")`;
        const res = await sheet({ action: "addRow", sheetName: SHEET_TAB, values: [name.trim(), branch, qtyText, link, "맡김", notes] });
        const m = (res?.result?.updates?.updatedRange as string | undefined)?.match(/!(?:[A-Z]+)(\d+)/);
        await db.from("blade_sharpenings").update({ sheet_synced: true, sheet_row_index: m ? Number(m[1]) : null }).eq("id", row.id);
        toast({ title: "등록 완료", description: "시트에도 추가했습니다." });
      } catch (e: any) {
        toast({ title: "앱에는 저장됨, 시트 추가 실패", description: e.message, variant: "destructive" });
      }
      qc.invalidateQueries({ queryKey: ["blade-sharpenings"] });
      onClose();
    } catch (e: any) {
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
      toast({ title: "오류", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>예취 칼날 등록</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>사진</Label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden
              onChange={e => { setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ""; }} />
            <div className="flex flex-wrap gap-2 mt-1">
              {files.map((f, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(f)} alt="" className="h-20 w-20 rounded object-cover" />
                  <button className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground h-5 w-5 text-xs"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <Button type="button" variant="outline" className="h-20 w-20 flex-col" onClick={() => fileRef.current?.click()}>
                <Plus className="h-5 w-5" /><span className="text-xs">촬영</span>
              </Button>
            </div>
          </div>
          <div>
            <Label>고객 이름 *</Label>
            <CustomerSearchInput value={name} onChange={v => { setName(v); setCustomerId(null); }} onSelect={c => { setName(c.name); setCustomerId(c.id); }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>지점</Label>
              <div className="flex gap-1 mt-1">
                {["장흥", "강진"].map(b => (
                  <Button key={b} type="button" size="sm" className="flex-1" variant={branch === b ? "default" : "outline"} onClick={() => setBranch(b)}>{b}</Button>
                ))}
              </div>
            </div>
            <div><Label>수량</Label><Input placeholder="예: 2, 3.5봉, 1set" value={qty} onChange={e => setQty(e.target.value)} /></div>
          </div>
          <div><Label>비고</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={save} disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />저장 중</> : "등록"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
