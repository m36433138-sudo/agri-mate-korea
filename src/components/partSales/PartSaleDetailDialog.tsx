import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/formatters";
import { ExternalLink, Printer, Trash2 } from "lucide-react";
import type { PartSaleRow } from "./types";
import { buyerOf, PAYMENT_MODE_LABELS } from "./types";
import { printPartSale } from "./printPartSale";

export function PartSaleDetailDialog({ sale, onClose, canManage }: {
  sale: PartSaleRow | null; onClose: () => void; canManage: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("delete_part_sale", { _sale_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      ["part-sales", "customer-part-sales", "finance", "customer-receivables", "inventory"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }));
      toast({ title: "판매를 취소했어요", description: "재고를 되돌리고 연결된 미수금도 지웠어요." });
      setConfirm(false);
      onClose();
    },
    onError: (e: any) => toast({ title: "취소하지 못했어요", description: e.message, variant: "destructive" }),
  });

  if (!sale) return null;
  const items = sale.part_sale_items ?? [];
  const receivable = Number(sale.total_amount) - Number(sale.paid_amount);

  return (
    <>
      <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              부품 판매 · {sale.sale_date}
              <Badge variant="outline">{sale.branch}</Badge>
              <Badge className={sale.payment_mode === "paid" ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}>
                {PAYMENT_MODE_LABELS[sale.payment_mode]}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">구매자</span>
              {sale.customer_id ? (
                <Link to={`/customers/${sale.customer_id}`} className="font-semibold hover:text-primary flex items-center gap-1">
                  {buyerOf(sale)} <ExternalLink className="h-3 w-3 opacity-60" />
                </Link>
              ) : (
                <span className="font-semibold">{buyerOf(sale)} <span className="text-xs text-muted-foreground">(미등록 손님)</span></span>
              )}
              {(sale.customers?.phone ?? sale.buyer_phone) && (
                <span className="text-muted-foreground">{sale.customers?.phone ?? sale.buyer_phone}</span>
              )}
            </div>

            <div className="rounded-xl border border-border/60 divide-y divide-border/40">
              {items.map((it) => (
                <div key={it.id} className="px-3 py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="truncate">
                      <span className="font-mono text-xs text-muted-foreground mr-1.5">{it.part_code}</span>
                      {it.part_name}
                    </p>
                  </div>
                  <span className="text-muted-foreground tabular-nums shrink-0">{it.quantity} × {formatPrice(it.unit_price)}</span>
                  <span className="w-24 text-right font-semibold tabular-nums shrink-0">{formatPrice(it.quantity * it.unit_price)}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-muted/40 p-4 space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">소계</span><span className="tabular-nums">{formatPrice(sale.subtotal)}</span></div>
              {Number(sale.discount) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">할인</span><span className="tabular-nums">-{formatPrice(sale.discount)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base"><span>합계</span><span className="tabular-nums">{formatPrice(sale.total_amount)}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">받은 금액{sale.payment_method ? ` (${sale.payment_method})` : ""}</span>
                <span className="tabular-nums">{formatPrice(sale.paid_amount)}</span>
              </div>
              {receivable > 0 && (
                <div className="flex justify-between text-destructive font-semibold">
                  <span>판매 당시 미수금</span><span className="tabular-nums">{formatPrice(receivable)}</span>
                </div>
              )}
            </div>
            {receivable > 0 && (
              <p className="text-xs text-muted-foreground">
                입금 처리는 <Link to="/receivables" className="text-primary hover:underline">미수금 관리</Link>에서 해주세요.
              </p>
            )}
            {sale.notes && <p className="text-muted-foreground">메모: {sale.notes}</p>}
          </div>

          <DialogFooter className="gap-2">
            {canManage && (
              <Button variant="ghost" className="text-destructive mr-auto" onClick={() => setConfirm(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> 판매 취소
              </Button>
            )}
            <Button variant="outline" onClick={() => {
              if (!printPartSale(sale)) toast({ title: "팝업이 막혀 있어요", description: "브라우저에서 팝업을 허용해주세요.", variant: "destructive" });
            }}>
              <Printer className="h-4 w-4 mr-1" /> 거래명세서 인쇄
            </Button>
            <Button onClick={onClose}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 판매를 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              판매한 부품 수량이 {sale.branch} 재고로 돌아가고, 이 판매로 생긴 미수금과 그 입금 기록도 함께 지워져요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>그대로 두기</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate(sale.id)} disabled={del.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              판매 취소
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
