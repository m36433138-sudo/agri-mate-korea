import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormDialogTopBar, formDialogBodyClass, formDialogContentClass } from "@/components/forms/FormDialogTopBar";
import { Segmented } from "@/components/page/PageParts";
import { CheckCircle2, FileText, MapPin, MoreHorizontal, PackageCheck, PackageOpen, Truck, XCircle } from "lucide-react";
import { yanmarSalesPrice } from "@/lib/partPricing";
import { defaultLocation } from "@/lib/partReceipts";
import { LocationPhotos } from "./LocationPhotos";
import { RECEIPT_BUCKET, db, loadStockFor, type PartReceipt, type PartReceiptItem } from "./receiptData";

const won = (n: number | null | undefined) => (n == null ? "-" : `${Math.round(n).toLocaleString("ko-KR")}원`);

/** 부품관리 → 「부품 입고」 탭: 지출에서 올린 명세서가 여기 「입고 대기」로 쌓이고, 창고에서 확인하면 재고가 는다 */
export default function PartReceiving() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [view, setView] = useState<"open" | "done">("open");
  const [opened, setOpened] = useState<PartReceipt | null>(null);

  const { data: receipts = [], isLoading } = useQuery<PartReceipt[]>({
    queryKey: ["part-receipts", view],
    queryFn: async () => {
      const statuses = view === "open" ? ["pending", "partial"] : ["done", "cancelled"];
      const { data, error } = await db.from("part_receipts")
        .select("*, part_receipt_items(id, status, quantity)")
        .in("status", statuses)
        .order("doc_date", { ascending: false }).order("created_at", { ascending: false })
        .limit(view === "open" ? 200 : 60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const openFile = async (r: PartReceipt) => {
    if (!r.file_path) return;
    const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(r.file_path, 600);
    if (error || !data) { toast({ title: "원본을 열 수 없어요", description: "지출 조회 권한이 있어야 볼 수 있어요.", variant: "destructive" }); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const cancel = async (r: PartReceipt) => {
    if ((r.part_receipt_items ?? []).some((i) => i.status !== "pending")) {
      toast({ title: "이미 일부 입고한 문서는 취소할 수 없어요", variant: "destructive" });
      return;
    }
    if (!confirm(`${r.vendor_name ?? ""} ${r.doc_number ?? ""} 입고 대기를 취소할까요? (지출 기록은 그대로 남아요)`)) return;
    const { error } = await db.from("part_receipts").update({ status: "cancelled" }).eq("id", r.id);
    if (error) { toast({ title: "취소하지 못했어요", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["part-receipts"] });
  };

  const pendingLines = receipts.reduce((s, r) => s + (r.part_receipt_items ?? []).filter((i) => i.status === "pending").length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Segmented<"open" | "done"> label="입고 상태" value={view} onChange={setView}
          options={[{ value: "open", label: `입고 대기${view === "open" && pendingLines ? ` ${pendingLines}줄` : ""}` }, { value: "done", label: "끝난 입고" }]} />
        <p className="text-xs text-muted-foreground">지출 관리에 거래명세서를 올리면 여기 쌓여요. 창고에서 확인하고 「입고 완료」해야 재고가 늘어요.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-3xl" />)}</div>
      ) : receipts.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card/60 py-14 text-center">
          <PackageOpen className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">{view === "open" ? "입고할 명세서가 없어요" : "끝난 입고가 없어요"}</p>
          {view === "open" && <p className="text-xs text-muted-foreground/70 mt-1">지출 관리 → 「영수증 올리기」로 얀마·거래처 명세서를 올려 주세요.</p>}
        </div>
      ) : (
        <ul className="grid gap-2.5 lg:grid-cols-2">
          {receipts.map((r) => {
            const items = r.part_receipt_items ?? [];
            const done = items.filter((i) => i.status !== "pending").length;
            const qty = items.reduce((s, i) => s + i.quantity, 0);
            return (
              <li key={r.id} className="rounded-3xl border border-border/70 bg-card card-shadow p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${r.source === "yanmar" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-primary/10 text-primary"}`}>
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[16px] font-bold truncate">{r.vendor_name ?? "거래처 미상"}</p>
                      <Badge variant="outline" className="rounded-full">{r.branch}</Badge>
                      {r.status === "partial" && <Badge className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15">일부 입고</Badge>}
                      {r.status === "cancelled" && <Badge variant="secondary" className="rounded-full">취소</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.doc_number ? `${r.doc_number} · ` : ""}{r.doc_date} · {items.length}줄 {qty}개{r.total_amount ? ` · ${won(r.total_amount)}` : ""}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full -mr-1 -mt-1 text-muted-foreground" aria-label="더 보기"><MoreHorizontal className="h-5 w-5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {r.file_path && <DropdownMenuItem onSelect={() => openFile(r)}><FileText className="h-4 w-4 mr-2" />명세서 원본</DropdownMenuItem>}
                      {r.status === "pending" && <DropdownMenuItem onSelect={() => cancel(r)} className="text-destructive focus:text-destructive"><XCircle className="h-4 w-4 mr-2" />입고 대기 취소</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{done}/{items.length}줄 확인</span>
                </div>
                <Button
                  variant={r.status === "done" || r.status === "cancelled" ? "outline" : "default"}
                  className="h-11 rounded-full"
                  onClick={() => setOpened(r)}
                >
                  {r.status === "done" || r.status === "cancelled" ? "내역 보기" : <><PackageCheck className="h-4 w-4 mr-1.5" />입고하기</>}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {opened && <ReceiveDialog receipt={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}

type Draft = { selected: boolean; qty: string; location: string; partCode: string; partName: string; salesPrice: string };

function ReceiveDialog({ receipt, onClose }: { receipt: PartReceipt; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const readOnly = receipt.status === "done" || receipt.status === "cancelled";

  const { data, isLoading } = useQuery({
    queryKey: ["part-receipt-items", receipt.id],
    queryFn: async () => {
      const { data: items, error } = await db.from("part_receipt_items").select("*").eq("receipt_id", receipt.id).order("line_no");
      if (error) throw error;
      const list = (items ?? []) as PartReceiptItem[];
      const codes = list.map((i) => i.part_code);
      const stock = await loadStockFor(codes);
      let supply: { part_code: string; part_name: string | null; supply_price: number | null }[] = [];
      if (receipt.source === "yanmar" && codes.length) {
        const { data: sp } = await db.from("yanmar_supply_prices").select("part_code, part_name, supply_price").in("part_code", [...new Set(codes)]);
        supply = sp ?? [];
      }
      return { items: list, stock, supply };
    },
  });

  // 처음 열 때 각 줄 기본값: 고른 상태, 수량 = 명세서 수량, 위치 = 명세서 → 기존 재고, 새 부품 매출가 = 다른 지점 → 공급가표
  useEffect(() => {
    if (!data) return;
    const next: Record<string, Draft> = {};
    for (const it of data.items) {
      if (it.status !== "pending") continue;
      const other = data.stock.find((s) => s.part_code === it.part_code && s.sales_price != null);
      const sp = data.supply.find((s) => s.part_code === it.part_code);
      next[it.id] = {
        selected: true,
        qty: String(it.quantity),
        location: defaultLocation(receipt.branch, it.part_code, it.location, data.stock) ?? "",
        partCode: it.part_code,
        partName: it.part_name || data.stock.find((s) => s.part_code === it.part_code)?.part_name || sp?.part_name || "",
        salesPrice: other?.sales_price != null ? String(other.sales_price) : receipt.source === "yanmar" ? String(yanmarSalesPrice(sp?.supply_price ?? null) ?? "") : "",
      };
    }
    setDrafts(next);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (id: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const pending = (data?.items ?? []).filter((i) => i.status === "pending");
  const chosen = pending.filter((i) => drafts[i.id]?.selected);
  const allOn = pending.length > 0 && chosen.length === pending.length;
  const inBranch = (code: string) => data?.stock.find((s) => s.part_code === code && s.branch === receipt.branch);

  const save = async () => {
    if (!chosen.length) return;
    setSaving(true);
    try {
      // 일반 부품은 입고하면서 번호·이름을 고칠 수 있다 → 먼저 줄에 반영
      for (const it of chosen) {
        const d = drafts[it.id];
        const code = d.partCode.trim();
        if (!code) throw new Error(`${it.line_no}번 줄 부품번호를 넣어 주세요`);
        if (code !== it.part_code || d.partName.trim() !== it.part_name) {
          const { error } = await db.from("part_receipt_items").update({ part_code: code, part_name: d.partName.trim() }).eq("id", it.id);
          if (error) throw error;
        }
      }
      const { data: res, error } = await db.rpc("receive_part_receipt", {
        _receipt_id: receipt.id,
        _items: chosen.map((it) => {
          const d = drafts[it.id];
          return {
            id: it.id,
            received_qty: Math.max(0, Math.round(Number(d.qty) || 0)),
            location: d.location.trim() || null,
            part_name: d.partName.trim() || null,
            sales_price: d.salesPrice.trim() ? Math.round(Number(d.salesPrice)) : null,
          };
        }),
      });
      if (error) throw error;
      toast({
        title: res?.left ? `${res.received}줄 입고했어요 · 남은 ${res.left}줄` : "입고를 모두 끝냈어요",
        description: [res?.new_parts ? `새 부품 ${res.new_parts}개 등록` : "", res?.missing ? `안 온 줄 ${res.missing}개` : ""].filter(Boolean).join(" · ") || `${receipt.branch} 재고에 반영됐어요`,
      });
      qc.invalidateQueries({ queryKey: ["part-receipts"] });
      qc.invalidateQueries({ queryKey: ["part-receipt-items", receipt.id] });
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      qc.invalidateQueries({ queryKey: ["inventory-search"] });
      if (!res?.left) onClose();
    } catch (e: any) {
      toast({ title: "입고하지 못했어요", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent
        hideClose
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className={`sm:max-w-3xl max-h-[92vh] flex flex-col ${formDialogContentClass}`}
      >
        <FormDialogTopBar
          title={<span className="truncate">{receipt.vendor_name ?? "입고"} {receipt.doc_number ?? ""}</span>}
          onClose={onClose}
          onSave={save}
          saving={saving}
          saveDisabled={readOnly || chosen.length === 0}
          saveLabel={readOnly ? "끝남" : `입고 완료 ${chosen.length}`}
          extra={
            <p className="text-xs text-muted-foreground text-center sm:text-left pt-1">
              {receipt.branch} · {receipt.doc_date} · {pending.length ? `확인할 줄 ${pending.length}개` : "모두 확인함"}
            </p>
          }
        />

        <div className={`flex-1 min-h-0 overflow-y-auto pb-3 space-y-2.5 ${formDialogBodyClass}`}>
          {isLoading || !data ? (
            <div className="space-y-2 pt-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
          ) : (
            <>
              {pending.length > 0 && (
                <label className="flex items-center gap-2 pt-2 text-sm font-medium cursor-pointer w-fit">
                  <Checkbox checked={allOn} onCheckedChange={(c) => setDrafts((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, { ...v, selected: !!c }])))} />
                  모두 고르기 · 실제로 온 수량과 위치를 확인해 주세요 (안 온 줄은 수량 0)
                </label>
              )}
              {data.items.map((it) => {
                const d = drafts[it.id];
                const stock = inBranch(d?.partCode || it.part_code);
                const isNew = !stock;
                if (it.status !== "pending") {
                  return (
                    <div key={it.id} className="rounded-2xl border bg-muted/40 px-4 py-3 flex items-center gap-3 text-sm">
                      {it.status === "received" ? <CheckCircle2 className="h-5 w-5 text-up shrink-0" /> : <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-semibold truncate">{it.part_code}</p>
                        <p className="text-xs text-muted-foreground truncate">{it.part_name}</p>
                      </div>
                      {it.received_location && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-bold px-2 py-0.5"><MapPin className="h-3 w-3" />{it.received_location}</span>}
                      <span className="font-bold tabular-nums">{it.status === "received" ? `${it.received_qty}개 입고` : "안 옴"}</span>
                    </div>
                  );
                }
                if (!d) return null;
                return (
                  <div key={it.id} className={`rounded-2xl border p-3.5 space-y-3 transition-colors ${d.selected ? "border-primary/50 bg-card" : "bg-muted/30 opacity-70"}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox className="mt-1" checked={d.selected} onCheckedChange={(c) => set(it.id, { selected: !!c })} aria-label={`${it.line_no}번 줄 고르기`} />
                      <div className="min-w-0 flex-1">
                        {receipt.source === "general" ? (
                          <Input value={d.partCode} onChange={(e) => set(it.id, { partCode: e.target.value })} className="h-9 font-mono font-semibold" aria-label="부품번호" />
                        ) : (
                          <p className="font-mono font-bold text-[15px] break-all">{it.part_code}{it.alt_part_code && <span className="text-xs font-normal text-muted-foreground"> ({it.alt_part_code})</span>}</p>
                        )}
                        <Input value={d.partName} onChange={(e) => set(it.id, { partName: e.target.value })} placeholder="품명" className="h-9 mt-1.5" aria-label="품명" />
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {it.line_no}번 · 명세서 {it.quantity}개 × {won(it.unit_price)}
                          {stock ? <> · 지금 {receipt.branch} 재고 <b className="text-foreground">{stock.quantity ?? 0}개</b>{stock.location_main ? ` · 위치 ${stock.location_main}` : ""}</> : <span className="text-primary font-medium"> · {receipt.branch}에 없는 새 부품</span>}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-[6.5rem_1fr] gap-2 pl-7">
                      <label className="text-xs text-muted-foreground">
                        온 수량
                        <Input type="number" inputMode="numeric" min={0} value={d.qty} onChange={(e) => set(it.id, { qty: e.target.value })}
                          className={`h-11 mt-1 text-lg font-bold text-center tabular-nums ${Number(d.qty) !== it.quantity ? "border-amber-500 text-amber-700 dark:text-amber-400" : "text-foreground"}`} />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        적재 위치
                        <div className="relative mt-1">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                          <Input value={d.location} onChange={(e) => set(it.id, { location: e.target.value.toUpperCase() })} placeholder="예: U19-8"
                            className="h-11 pl-9 text-lg font-extrabold text-primary uppercase" />
                        </div>
                      </label>
                    </div>
                    {isNew && (
                      <label className="block pl-7 text-xs text-muted-foreground">
                        매출가 (새 부품){receipt.source === "yanmar" ? " · 다른 지점 가격 → 공급가표로 채웠어요" : ""}
                        <Input type="number" inputMode="numeric" value={d.salesPrice} onChange={(e) => set(it.id, { salesPrice: e.target.value })} placeholder="원" className="h-10 mt-1 tabular-nums text-foreground" />
                      </label>
                    )}
                    <div className="pl-7">
                      <LocationPhotos partCode={d.partCode || it.part_code} branch={receipt.branch} location={d.location} compact />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
