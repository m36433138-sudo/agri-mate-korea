import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/page/PageParts";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { AlertTriangle, Building2, CheckCircle2, MapPin, PackagePlus } from "lucide-react";
import type { YanmarStatement } from "@/lib/yanmarStatement";
import { findYanmarVendor, guessBranch, type Branch } from "@/lib/partReceipts";
import { RECEIPT_BUCKET, createPartReceipt, db, ensureVendor, loadStockFor, loadVendors } from "./receiptData";

const won = (n: number | null | undefined) => (n == null ? "-" : `${Math.round(n).toLocaleString("ko-KR")}원`);

/**
 * 얀마 거래명세서를 올리면 보이는 확인 창.
 * 저장하면 ① 지출 1줄(부품 매입) ② 얀마 거래처(없으면 등록) ③ 부품 입고 대기가 함께 만들어진다.
 * 재고는 여기서 늘지 않는다 — 부품창고에서 「입고 완료」할 때 늘어난다.
 */
export default function YanmarStatementDialog({
  file, statement, onDone,
}: {
  file: File;
  statement: YanmarStatement;
  onDone: (saved: { month: string } | null) => void;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const codes = useMemo(() => statement.lines.map((l) => l.partCode), [statement]);

  const { data, isLoading } = useQuery({
    queryKey: ["yanmar-statement-check", statement.docNumber, codes.join(",")],
    queryFn: async () => {
      const [vendors, stock, dup] = await Promise.all([
        loadVendors(),
        loadStockFor(codes),
        statement.docNumber
          ? db.from("part_receipts").select("id, status").eq("source", "yanmar").eq("doc_number", statement.docNumber).neq("status", "cancelled").limit(1)
          : Promise.resolve({ data: [] }),
      ]);
      return { vendors, stock, duplicate: !!dup.data?.length };
    },
  });

  const guessed = useMemo(() => (data ? guessBranch(statement.lines, data.stock) : null), [data, statement]);
  useEffect(() => { if (guessed && !branch) setBranch(guessed); }, [guessed]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen: Branch = branch ?? "장흥";
  const yanmarVendor = data ? findYanmarVendor(data.vendors) : null;
  const nameOf = (code: string, hint: string) =>
    data?.stock.find((s) => s.part_code === code && s.branch === chosen)?.part_name
    || data?.stock.find((s) => s.part_code === code)?.part_name
    || hint;
  const knownCount = data ? statement.lines.filter((l) => data.stock.some((s) => s.part_code === l.partCode && s.branch === chosen)).length : 0;
  const total = statement.grandTotal ?? statement.lines.reduce((s, l) => s + l.total, 0);
  // 부품번호나 수량을 못 읽은 줄이 있으면 저장하지 않는다 (빈 번호로 재고가 생기지 않게)
  const unreadable = statement.lines.filter((l) => !l.partCode.trim() || l.quantity <= 0);
  const date = statement.date ?? new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

  const save = async () => {
    if (!data || unreadable.length) return;
    setSaving(true);
    let path: string | null = null;
    let receiptId: string | null = null;
    try {
      const { data: u } = await supabase.auth.getUser();
      path = `${u.user?.id ?? "anon"}/${date}-yanmar-${statement.docNumber ?? "doc"}-${Math.random().toString(36).slice(2, 8)}.pdf`;
      const up = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, { contentType: "application/pdf" });
      if (up.error) throw up.error;

      const vendor = await ensureVendor(data.vendors, { name: "얀마", business_number: null, yanmar: true });
      const group = crypto.randomUUID();
      receiptId = await createPartReceipt(
        {
          source: "yanmar", vendor_id: vendor?.id ?? null, vendor_name: vendor?.name ?? "얀마", business_number: vendor?.business_number ?? null,
          doc_number: statement.docNumber, doc_date: date, branch: chosen,
          supply_amount: statement.supplyTotal, vat_amount: statement.vatTotal, total_amount: total,
          expense_group: group, file_path: path, notes: statement.problems.length ? statement.problems.join(" / ") : null,
        },
        statement.lines.map((l) => ({
          line_no: l.lineNo, part_code: l.partCode, alt_part_code: l.altCode, part_name: nameOf(l.partCode, l.nameHint) ?? "",
          quantity: l.quantity, unit_price: l.unitPrice, amount: l.amount, location: l.location,
        })),
      );

      const { error } = await db.from("expenses").insert({
        expense_date: date, vendor: vendor?.name ?? "얀마", category: "부품 매입",
        description: `얀마 부품 매입 ${statement.docNumber ?? ""} (${statement.lines.length}품목)`.replace("  ", " "),
        amount: total, vat: statement.vatTotal, quantity: null, unit_price: null,
        branch: chosen, receipt_path: path, receipt_group: group, source: "yanmar",
        notes: "부품 입고 대기로 함께 등록됨",
      });
      if (error) throw error;

      toast({
        title: `얀마 명세서 ${statement.docNumber ?? ""} 등록`,
        description: `지출 ${won(total)} · ${chosen} 부품 입고 대기 ${statement.lines.length}줄`,
        action: <ToastAction altText="부품 입고로 가기" onClick={() => navigate("/parts?tab=receiving")}>입고하러 가기</ToastAction>,
      });
      onDone({ month: date.slice(0, 7) });
    } catch (e: any) {
      if (receiptId) await db.from("part_receipts").delete().eq("id", receiptId);
      if (path) await supabase.storage.from(RECEIPT_BUCKET).remove([path]);
      toast({ title: "저장하지 못했어요", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !saving) onDone(null); }}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" /> 얀마 거래명세서 {statement.docNumber}
          </DialogTitle>
          <DialogDescription>
            {date} · {statement.lines.length}품목 · 합계 <b className="text-foreground">{won(total)}</b>
            {statement.vatTotal != null && <> (부가세 {won(statement.vatTotal)})</>}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="space-y-2"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 -mx-6 px-6">
            {data.duplicate && (
              <p className="rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive px-4 py-3 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> 이미 올린 명세서예요. 같은 입고가 두 번 생기지 않도록 저장을 막았어요.
              </p>
            )}
            {unreadable.length > 0 && (
              <p className="rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive px-4 py-3 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {unreadable.map((l) => `${l.lineNo}번`).join(", ")} 줄의 부품번호나 수량을 읽지 못해 저장을 막았어요. 명세서 원본을 다시 받아 올리거나, 이 명세서는 「직접 입력」으로 등록해 주세요.
              </p>
            )}
            {statement.problems.length > 0 && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 px-4 py-3 text-sm space-y-1">
                <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> 명세서에서 확인할 점</p>
                {statement.problems.map((p) => <p key={p}>· {p}</p>)}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-2">
              <div className="rounded-2xl bg-muted/60 px-4 py-3 flex items-center gap-3">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">거래처</p>
                  <p className="font-semibold truncate">{yanmarVendor ? yanmarVendor.name : "얀마"} {!yanmarVendor && <span className="text-xs font-normal text-primary">· 새로 등록돼요</span>}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-muted/60 px-4 py-2.5">
                <p className="text-xs text-muted-foreground mb-1.5">
                  입고 지점 {guessed && <span className="text-primary">· 명세서 위치가 {guessed} 재고 위치와 맞아요</span>}
                </p>
                <Segmented<Branch> label="입고 지점" value={chosen} onChange={setBranch}
                  options={[{ value: "장흥", label: "장흥" }, { value: "강진", label: "강진" }]} />
              </div>
            </div>

            <div className="rounded-2xl border overflow-hidden">
              <div className="px-4 py-2.5 border-b text-xs text-muted-foreground flex justify-between">
                <span>품목 {statement.lines.length}줄 · {chosen} 재고에 있는 부품 {knownCount}개 · 새 부품 {statement.lines.length - knownCount}개</span>
                <span className="hidden sm:inline">위치는 입고할 때 고칠 수 있어요</span>
              </div>
              <ul className="divide-y">
                {statement.lines.map((l) => {
                  const known = data.stock.some((s) => s.part_code === l.partCode && s.branch === chosen);
                  return (
                    <li key={l.lineNo} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                      <span className="w-6 text-xs text-muted-foreground tabular-nums">{l.lineNo}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-semibold truncate">{l.partCode}{l.altCode && <span className="text-xs text-muted-foreground font-normal"> ({l.altCode})</span>}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {nameOf(l.partCode, l.nameHint) || "품명 없음"}{l.location && <span className="sm:hidden text-primary font-semibold"> · {l.location}</span>} {!known && <span className="text-primary font-medium">· 새 부품</span>}
                        </p>
                      </div>
                      {l.location && (
                        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-bold px-2 py-0.5">
                          <MapPin className="h-3 w-3" />{l.location}
                        </span>
                      )}
                      <span className="w-12 text-right font-bold tabular-nums">{l.quantity}개</span>
                      <span className="w-24 text-right tabular-nums hidden sm:block">{won(l.total)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
              저장하면 지출(부품 매입) 1줄과 「부품 입고 대기」가 만들어져요. 재고는 부품창고에서 수량을 확인하고 「입고 완료」를 눌러야 늘어나요.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onDone(null)} disabled={saving}>취소</Button>
          <Button onClick={save} disabled={!data || data.duplicate || saving || statement.lines.length === 0 || unreadable.length > 0}>
            {saving ? "저장 중…" : `지출 등록 + 입고 대기 (${statement.lines.length}줄)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
