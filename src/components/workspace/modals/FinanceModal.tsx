import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { useFinance } from "@/hooks/useFinance";
import { useDocuments } from "@/hooks/useDocuments";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import type { FinanceRecord, FinanceRecordType, FinanceSourceType } from "@/types/workspace";
import {
  FINANCE_TYPE_LABELS, SOURCE_TYPE_LABELS, PAYMENT_METHODS, outstandingOf,
} from "@/types/workspace";

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: FinanceRecord;
  defaultDocumentId?: string;
  defaultCustomerId?: string;
}

const fmt = (n: number) => `₩${Number(n).toLocaleString("ko-KR")}`;

export function FinanceModal({ open, onClose, initialData, defaultDocumentId, defaultCustomerId }: Props) {
  const { userId } = useUserRole();
  const { addFinance, updateFinance, markPaid, addPayment, deletePayment, finance } = useFinance();
  const { documents } = useDocuments();
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    record_type: "receivable" as string,
    source_type: "manual" as string,
    customer_id: "",
    document_id: defaultDocumentId ?? "",
    amount: "",
    due_date: "",
    paid_date: "",
    is_paid: false,
    notes: "",
  });

  // 부분 입금 입력 폼
  const [pay, setPay] = useState({
    amount: "",
    paid_date: today,
    method: "계좌이체",
    notes: "",
  });

  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    if (initialData) {
      setForm({
        record_type: initialData.record_type,
        source_type: initialData.source_type ?? "manual",
        customer_id: initialData.customer_id ?? "",
        document_id: initialData.document_id ?? "",
        amount: initialData.amount?.toString() ?? "",
        due_date: initialData.due_date ?? "",
        paid_date: initialData.paid_date ?? "",
        is_paid: initialData.is_paid,
        notes: initialData.notes ?? "",
      });
      setCustomerName(initialData.customers?.name ?? "");
    } else {
      setForm({
        record_type: "receivable",
        source_type: "manual",
        customer_id: defaultCustomerId ?? "",
        document_id: defaultDocumentId ?? "",
        amount: "",
        due_date: "",
        paid_date: "",
        is_paid: false,
        notes: "",
      });
      setCustomerName("");
    }
    setPay({ amount: "", paid_date: today, method: "계좌이체", notes: "" });
  }, [initialData, open, defaultDocumentId, defaultCustomerId]);

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isReceivable = form.record_type === "receivable";
  // 목록 쿼리에서 최신 상태를 읽어 입금 후 잔액·내역이 즉시 갱신되게 함
  const live = initialData ? finance.find((f) => f.id === initialData.id) ?? initialData : undefined;
  const currentPaid = Number(live?.paid_amount ?? 0);
  const balance = live ? outstandingOf(live) : 0;
  const payments = (live?.finance_payments ?? [])
    .slice()
    .sort((a, b) => (b.paid_date > a.paid_date ? 1 : -1));

  const handleSubmit = async () => {
    if (!form.amount || !userId) return;

    const payload = {
      created_by: initialData?.created_by ?? userId,
      record_type: form.record_type as FinanceRecordType,
      source_type: form.source_type as FinanceSourceType,
      customer_id: form.customer_id || null,
      document_id: form.document_id || null,
      amount: Number(form.amount.toString().replace(/,/g, "")),
      due_date: form.due_date || null,
      paid_date: form.paid_date || null,
      is_paid: form.is_paid,
      notes: form.notes || null,
    };

    try {
      if (initialData) {
        await updateFinance.mutateAsync({ id: initialData.id, ...payload });
        toast({ title: "미수금 기록이 수정됐어요." });
      } else {
        await addFinance.mutateAsync({ ...payload, paid_amount: 0, source_id: null } as any);
        toast({ title: "미수금이 저장됐어요." });
      }
      onClose();
    } catch {
      toast({ title: "저장 실패", variant: "destructive" });
    }
  };

  const handleMarkPaid = async () => {
    if (!live) return;
    try {
      await markPaid.mutateAsync({ id: live.id, paid_date: today, amount: Number(live.amount) });
      toast({ title: "입금 처리됐어요." });
      onClose();
    } catch {
      toast({ title: "처리 실패", variant: "destructive" });
    }
  };

  const handleAddPayment = async () => {
    if (!live || !userId || !pay.amount) return;
    const amt = Number(pay.amount.replace(/,/g, ""));
    if (!amt || amt <= 0) return;
    try {
      await addPayment.mutateAsync({
        finance_id: live.id,
        amount: amt,
        paid_date: pay.paid_date || today,
        method: pay.method || null,
        notes: pay.notes || null,
        created_by: userId,
        totalAmount: Number(live.amount),
        currentPaid,
      });
      toast({ title: "입금이 기록됐어요." });
      setPay({ amount: "", paid_date: today, method: "계좌이체", notes: "" });
    } catch {
      toast({ title: "입금 기록 실패", variant: "destructive" });
    }
  };

  const handleDeletePayment = async (p: (typeof payments)[number]) => {
    try {
      await deletePayment.mutateAsync(p);
      toast({ title: "입금 기록이 삭제됐어요." });
    } catch {
      toast({ title: "삭제 실패", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "미수금 수정" : "미수금 등록"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>유형</Label>
              <Select value={form.record_type} onValueChange={(v) => set("record_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FINANCE_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>원천</Label>
              <Select value={form.source_type} onValueChange={(v) => set("source_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>고객</Label>
            <CustomerSearchInput
              value={customerName}
              onChange={(name) => {
                setCustomerName(name);
                // 직접 입력으로 이름이 바뀌면 연결된 고객 해제
                if (initialData?.customers?.name !== name) setForm((f) => ({ ...f, customer_id: "" }));
              }}
              onSelect={(c) => setForm((f) => ({ ...f, customer_id: c.id }))}
              placeholder="고객 검색 (선택사항)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>금액 (원) *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="예: 5000000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>만기일</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => set("due_date", e.target.value)}
              />
            </div>
          </div>

          {documents.length > 0 && (
            <div className="space-y-1.5">
              <Label>연결 문서</Label>
              <Select
                value={form.document_id}
                onValueChange={(v) => set("document_id", v === "_none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="문서 선택 (선택사항)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">없음</SelectItem>
                  {documents.slice(0, 30).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>비고</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="추가 내용"
              rows={2}
            />
          </div>

          {/* ── 입금 내역 (수정 시 · 미수금 건만) ── */}
          {live && isReceivable && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">입금 내역</Label>
                <div className="text-sm">
                  <span className="text-muted-foreground">잔액 </span>
                  <span className={balance > 0 ? "font-semibold text-destructive" : "font-semibold text-green-500"}>
                    {fmt(balance)}
                  </span>
                  {live.is_paid && <span className="ml-2 text-xs text-green-500">완납</span>}
                </div>
              </div>

              {payments.length > 0 && (
                <div className="space-y-1.5">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-medium">{fmt(p.amount)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.paid_date}
                          {p.method ? ` · ${p.method}` : ""}
                          {p.notes ? ` · ${p.notes}` : ""}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeletePayment(p)}
                        disabled={deletePayment.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {!live.is_paid && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="입금액 (원)"
                      value={pay.amount}
                      onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))}
                    />
                    <Input
                      type="date"
                      value={pay.paid_date}
                      onChange={(e) => setPay((p) => ({ ...p, paid_date: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={pay.method} onValueChange={(v) => setPay((p) => ({ ...p, method: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="메모 (선택)"
                      value={pay.notes}
                      onChange={(e) => setPay((p) => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={handleAddPayment}
                    disabled={!pay.amount || addPayment.isPending}
                  >
                    <Plus className="h-4 w-4 mr-1" /> 입금 기록 추가
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {initialData && isReceivable && !initialData.is_paid && (
              <Button
                variant="outline"
                type="button"
                onClick={handleMarkPaid}
                disabled={markPaid.isPending}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                ✓ 전액 입금 처리
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.amount || addFinance.isPending || updateFinance.isPending}
            >
              {initialData ? "수정" : "저장"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
