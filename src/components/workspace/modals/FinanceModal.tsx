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
import { useFinance } from "@/hooks/useFinance";
import { useDocuments } from "@/hooks/useDocuments";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import type { FinanceRecord, FinanceRecordType } from "@/types/workspace";
import { FINANCE_TYPE_LABELS } from "@/types/workspace";

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: FinanceRecord;
  defaultDocumentId?: string;
}

export function FinanceModal({ open, onClose, initialData, defaultDocumentId }: Props) {
  const { userId } = useUserRole();
  const { addFinance, updateFinance, markPaid } = useFinance();
  const { documents } = useDocuments();
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    record_type: "receivable" as string,
    customer_id: "",
    document_id: defaultDocumentId ?? "",
    amount: "",
    due_date: "",
    paid_date: "",
    is_paid: false,
    notes: "",
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        record_type: initialData.record_type,
        customer_id: initialData.customer_id ?? "",
        document_id: initialData.document_id ?? "",
        amount: initialData.amount?.toString() ?? "",
        due_date: initialData.due_date ?? "",
        paid_date: initialData.paid_date ?? "",
        is_paid: initialData.is_paid,
        notes: initialData.notes ?? "",
      });
    } else {
      setForm({
        record_type: "receivable",
        customer_id: "",
        document_id: defaultDocumentId ?? "",
        amount: "",
        due_date: "",
        paid_date: "",
        is_paid: false,
        notes: "",
      });
    }
  }, [initialData, open, defaultDocumentId]);

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.amount || !userId) return;

    const payload = {
      created_by: initialData?.created_by ?? userId,
      record_type: form.record_type as FinanceRecordType,
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
        toast({ title: "재무 기록이 수정됐어요." });
      } else {
        await addFinance.mutateAsync(payload);
        toast({ title: "재무 기록이 저장됐어요." });
      }
      onClose();
    } catch {
      toast({ title: "저장 실패", variant: "destructive" });
    }
  };

  const handleMarkPaid = async () => {
    if (!initialData) return;
    try {
      await markPaid.mutateAsync({ id: initialData.id, paid_date: today });
      toast({ title: "입금 처리됐어요." });
      onClose();
    } catch {
      toast({ title: "처리 실패", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? "재무 수정" : "미수금 등록"}</DialogTitle>
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
              <Label>금액 (원) *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="예: 5000000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>만기일</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => set("due_date", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>입금일</Label>
              <Input
                type="date"
                value={form.paid_date}
                onChange={(e) => set("paid_date", e.target.value)}
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
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {initialData && !initialData.is_paid && (
              <Button
                variant="outline"
                type="button"
                onClick={handleMarkPaid}
                disabled={markPaid.isPending}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                ✓ 입금 처리
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
