import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/components/partReceipts/receiptData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Segmented, SearchField } from "@/components/page/PageParts";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { StaffPicker } from "@/components/StaffPicker";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { inventorySearchFilter } from "@/lib/partSearch";
import {
  HOLD_PHOTO_BUCKET, HOLD_STATUS_LABEL, addHoldItem, createHold, holdOwner, usePartHolds, signHoldPhotos, validateHold,
  type HoldStatus, type PartHold, type PartHoldItem,
} from "@/lib/partHolds";
import { Camera, CheckCircle2, Loader2, MapPin, Minus, MoreHorizontal, PackageOpen, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";

const BRANCHES = ["장흥", "강진"] as const;

/**
 * 부품관리 「빼놓은 부품」: 바로 쓰려고 빼놓은 물품을 누구 것인지·어디 뒀는지(사진)와 함께 보고 닫는다.
 * 재고 수량은 바꾸지 않는다 — 실제 차감은 수리 등록·부품 판매에서.
 */
export default function PartHolds() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<HoldStatus>("held");
  const [branch, setBranch] = useState<"전체" | (typeof BRANCHES)[number]>("전체");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const { data: holds = [], isLoading } = usePartHolds(status);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return holds.filter((h) => (branch === "전체" || h.branch === branch) && (!t || [
      h.purpose, h.customer_name, h.customers?.name, h.assignee, h.spot, ...h.part_hold_items.flatMap((i) => [i.part_code, i.part_name]),
    ].some((v) => (v ?? "").toLowerCase().includes(t))));
  }, [holds, branch, q]);

  const paths = useMemo(() => shown.flatMap((h) => h.photo_paths), [shown]);
  const { data: urls } = useQuery({
    queryKey: ["part-hold-photos", paths.join("|")],
    enabled: paths.length > 0,
    staleTime: 30 * 60_000,
    queryFn: () => signHoldPhotos(paths),
  });

  const close = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: HoldStatus }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await db.from("part_holds").update({
        status: to, closed_at: to === "held" ? null : new Date().toISOString(), closed_by: to === "held" ? null : u.user?.id,
      }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["part-holds"] });
      toast({ title: v.to === "used" ? "사용함으로 옮겼어요" : v.to === "returned" ? "창고에 다시 넣음으로 옮겼어요" : "다시 빼놓음으로 돌렸어요" });
    },
    onError: (e: Error) => toast({ title: "바꾸지 못했어요", description: e.message, variant: "destructive" }),
  });

  const remove = async (h: PartHold) => {
    if (!confirm("이 기록을 지울까요? (재고는 바뀌지 않아요)")) return;
    const { error } = await db.from("part_holds").delete().eq("id", h.id);
    if (error) { toast({ title: "지우지 못했어요", description: "만든 사람이나 관리자만 지울 수 있어요.", variant: "destructive" }); return; }
    if (h.photo_paths.length) await supabase.storage.from(HOLD_PHOTO_BUCKET).remove(h.photo_paths);
    qc.invalidateQueries({ queryKey: ["part-holds"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="상태" value={status} onChange={(v) => setStatus(v as HoldStatus)}
          options={(["held", "used", "returned"] as HoldStatus[]).map((s) => ({ value: s, label: HOLD_STATUS_LABEL[s] }))} />
        <Segmented label="지점" value={branch} onChange={(v) => setBranch(v as typeof branch)} options={(["전체", ...BRANCHES] as const).map((b) => ({ value: b, label: b }))} />
        <SearchField value={q} onChange={setQ} placeholder="고객·담당·부품으로 찾기" className="flex-1 min-w-[200px] max-w-md" />
        <Button className="ml-auto gap-1.5 rounded-full" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> 부품 빼놓기</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2 py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중…</p>
      ) : shown.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-14 rounded-3xl border border-dashed space-y-2">
          <PackageOpen className="h-8 w-8 mx-auto opacity-40" />
          <p>{status === "held" ? "지금 빼놓은 부품이 없어요. 「부품 빼놓기」로 기록해 두세요." : "기록이 없어요."}</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((h) => {
            const total = h.part_hold_items.reduce((s, i) => s + i.quantity, 0);
            return (
              <li key={h.id} className="rounded-3xl border border-border/70 bg-card card-shadow p-4 space-y-3 min-w-0">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold break-words">{holdOwner(h)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {h.branch} · {h.created_at.slice(0, 10)}{h.purpose ? ` · ${h.purpose}` : ""}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                    h.status === "held" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : h.status === "used" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                    {HOLD_STATUS_LABEL[h.status]}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1 -mt-1 text-muted-foreground" aria-label="더 보기"><MoreHorizontal className="h-5 w-5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {h.status !== "used" && <DropdownMenuItem onSelect={() => close.mutate({ id: h.id, to: "used" })}><CheckCircle2 className="h-4 w-4 mr-2" /> 사용함</DropdownMenuItem>}
                      {h.status !== "returned" && <DropdownMenuItem onSelect={() => close.mutate({ id: h.id, to: "returned" })}><RotateCcw className="h-4 w-4 mr-2" /> 창고에 다시 넣음</DropdownMenuItem>}
                      {h.status !== "held" && <DropdownMenuItem onSelect={() => close.mutate({ id: h.id, to: "held" })}><PackageOpen className="h-4 w-4 mr-2" /> 다시 빼놓음으로</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => remove(h)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> 기록 지우기</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {h.photo_paths.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {h.photo_paths.map((p) => {
                      const u = urls?.get(p);
                      return (
                        <button key={p} type="button" onClick={() => u && setZoom(u)} className="h-24 w-24 shrink-0 rounded-xl overflow-hidden border bg-muted">
                          {u ? <img src={u} alt="빼놓은 자리 사진" className="h-full w-full object-cover" loading="lazy" /> : <Camera className="h-5 w-5 m-auto text-muted-foreground" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {h.spot && <p className="text-sm flex items-start gap-1.5"><MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span className="break-words">{h.spot}</span></p>}

                <ul className="rounded-2xl bg-muted/50 divide-y divide-border/60">
                  {h.part_hold_items.map((i) => (
                    <li key={i.id ?? i.part_code} className="flex items-baseline gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1"><span className="break-words">{i.part_name || i.part_code}</span><span className="block font-mono text-[11px] text-muted-foreground">{i.part_code}</span></span>
                      <span className="font-bold tabular-nums shrink-0">{i.quantity}개</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">{h.part_hold_items.length}종 · {total}개</p>

                {h.status === "held" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="rounded-full gap-1.5" disabled={close.isPending} onClick={() => close.mutate({ id: h.id, to: "used" })}><CheckCircle2 className="h-4 w-4" /> 사용함</Button>
                    <Button variant="ghost" className="rounded-full gap-1.5" disabled={close.isPending} onClick={() => close.mutate({ id: h.id, to: "returned" })}><RotateCcw className="h-4 w-4" /> 다시 넣음</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <PartHoldDialog open={open} onOpenChange={setOpen} />
      <Dialog open={!!zoom} onOpenChange={(v) => !v && setZoom(null)}>
        <DialogContent className="max-w-3xl p-2 sm:p-3">
          <DialogTitle className="sr-only">빼놓은 자리 사진</DialogTitle>
          {zoom && <img src={zoom} alt="빼놓은 자리" className="w-full max-h-[80vh] object-contain rounded-2xl bg-muted" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type InvHit = { id: string; part_code: string; part_name: string; quantity: number | null; location_main: string | null; location_sub: string | null };

function PartHoldDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [branch, setBranch] = useState<(typeof BRANCHES)[number]>("장흥");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [assignee, setAssignee] = useState("");
  const [purpose, setPurpose] = useState("");
  const [spot, setSpot] = useState("");
  const [items, setItems] = useState<PartHoldItem[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [manual, setManual] = useState({ code: "", name: "" });
  const camera = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCustomerName(""); setCustomerId(null); setAssignee(""); setPurpose(""); setSpot("");
    setItems([]); setPhotos([]); setSearch(""); setManual({ code: "", name: "" });
  }, [open]);
  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 250); return () => clearTimeout(t); }, [search]);

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["part-hold-inventory", branch, debounced],
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory")
        .select("id, part_code, part_name, quantity, location_main, location_sub")
        .eq("branch", branch).or(inventorySearchFilter(debounced)).order("part_code").limit(20);
      if (error) throw error;
      return (data ?? []) as InvHit[];
    },
  });

  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const problem = validateHold({ items, customerName, assignee, purpose });
  const save = useMutation({
    mutationFn: () => createHold({ branch, purpose, customer_id: customerId, customer_name: customerName, assignee, spot, items, photos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["part-holds"] });
      toast({ title: "빼놓은 부품을 기록했어요", description: `${items.length}종 · ${customerName || assignee || purpose}` });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "저장하지 못했어요", description: e.message, variant: "destructive" }),
  });

  const setQty = (code: string, q: number) => setItems((l) => l.map((i) => (i.part_code === code ? { ...i, quantity: Math.max(1, q) } : i)));

  return (
    <Dialog open={open} onOpenChange={(v) => !save.isPending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto overflow-x-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackageOpen className="h-5 w-5 text-primary" /> 부품 빼놓기</DialogTitle>
          <DialogDescription>바로 쓰려고 빼놓은 물품을 누구 것인지, 어디 뒀는지와 함께 남겨요. 재고 수량은 수리 등록·부품 판매 때 빠져요.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 min-w-0">
          <Segmented label="지점" value={branch} onChange={(v) => setBranch(v as typeof branch)} options={BRANCHES.map((b) => ({ value: b, label: b }))} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 min-w-0">
              <Label>누구 것 (고객)</Label>
              <CustomerSearchInput value={customerName} onChange={(n) => { setCustomerName(n); setCustomerId(null); }}
                onSelect={(c) => { setCustomerName(c.name); setCustomerId(c.id); }} placeholder="고객 검색 또는 이름" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label>담당</Label>
              <StaffPicker value={assignee} onChange={setAssignee} multiple placeholder="가져갈 기사" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>용도 · 메모</Label>
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="예: YT5113A 엔진오일 교환, 내일 방문수리" />
          </div>

          <div className="space-y-2">
            <Label>빼놓은 부품</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder={`${branch} 재고에서 부품번호·이름 검색`} />
            </div>
            {debounced.length >= 2 && (
              <div className="rounded-xl border max-h-52 overflow-y-auto divide-y">
                {isFetching && !hits.length ? <p className="p-3 text-xs text-muted-foreground">찾는 중…</p>
                  : hits.length === 0 ? <p className="p-3 text-xs text-muted-foreground">재고에 없어요. 아래에 직접 적어 담을 수 있어요.</p>
                  : hits.map((h) => (
                    <button key={h.id} type="button" className="w-full text-left px-3 py-2 hover:bg-muted/60"
                      onClick={() => { setItems((l) => addHoldItem(l, { part_code: h.part_code, part_name: h.part_name, quantity: 1 })); setSearch(""); }}>
                      <span className="text-sm font-medium">{h.part_name}</span>
                      <span className="block text-[11px] text-muted-foreground font-mono">{h.part_code} · 재고 {h.quantity ?? 0}{h.location_main ? ` · ${h.location_main}${h.location_sub ? ` / ${h.location_sub}` : ""}` : ""}</span>
                    </button>
                  ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <Input value={manual.code} onChange={(e) => setManual({ ...manual, code: e.target.value })} placeholder="부품번호 직접" className="min-w-0" />
              <Input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="품명" className="min-w-0" />
              <Button type="button" variant="outline" className="shrink-0" disabled={!manual.code.trim()}
                onClick={() => { setItems((l) => addHoldItem(l, { part_code: manual.code.trim(), part_name: manual.name.trim(), quantity: 1 })); setManual({ code: "", name: "" }); }}>담기</Button>
            </div>
            {items.length > 0 && (
              <ul className="rounded-2xl border divide-y">
                {items.map((i) => (
                  <li key={i.part_code} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm"><span className="break-words">{i.part_name || i.part_code}</span><span className="block font-mono text-[11px] text-muted-foreground">{i.part_code}</span></span>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(i.part_code, i.quantity - 1)} aria-label="하나 빼기"><Minus className="h-3.5 w-3.5" /></Button>
                    <Input value={i.quantity} inputMode="numeric" className="h-8 w-14 text-center" onChange={(e) => setQty(i.part_code, parseInt(e.target.value.replace(/\D/g, "")) || 1)} />
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(i.part_code, i.quantity + 1)} aria-label="하나 더"><Plus className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setItems((l) => l.filter((x) => x.part_code !== i.part_code))} aria-label="빼기"><X className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label>어디 뒀는지</Label>
            <Input value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="예: 정비동 입구 선반 2칸, 김영일 작업대 옆 박스" />
            <div className="flex flex-wrap gap-2">
              {previews.map((u, k) => (
                <div key={u} className="relative h-20 w-20 rounded-xl overflow-hidden border">
                  <img src={u} alt="빼놓은 자리 사진" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== k))} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="사진 빼기"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {photos.length < 6 && (
                <Button type="button" variant="outline" className="h-20 w-20 rounded-xl flex-col gap-1" onClick={() => camera.current?.click()}>
                  <Camera className="h-5 w-5" /><span className="text-[11px]">사진 찍기</span>
                </Button>
              )}
              <input ref={camera} type="file" accept="image/*" capture="environment" multiple className="hidden"
                onChange={(e) => { const f = Array.from(e.target.files ?? []); setPhotos((p) => [...p, ...f].slice(0, 6)); e.target.value = ""; }} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 items-center">
          {problem && <p className="text-xs text-muted-foreground mr-auto">{problem}</p>}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>취소</Button>
          <Button onClick={() => save.mutate()} disabled={!!problem || save.isPending} className="gap-1.5">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
