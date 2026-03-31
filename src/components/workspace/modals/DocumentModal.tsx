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
import { useDocuments } from "@/hooks/useDocuments";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import type { Document, DocType } from "@/types/workspace";
import { DOC_TYPE_LABELS, DOC_STATUS_OPTIONS } from "@/types/workspace";

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: Document;
  onCreateFinance?: (docId: string) => void;
}

export function DocumentModal({ open, onClose, initialData, onCreateFinance }: Props) {
  const { userId } = useUserRole();
  const { addDocument, updateDocument } = useDocuments();
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    doc_type: "quotation" as string,
    title: "",
    customer_id: "",
    machine_id: "",
    amount: "",
    issued_date: today,
    valid_until: "",
    status: "issued",
    notes: "",
    file_url: "",
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        doc_type: initialData.doc_type,
        title: initialData.title,
        customer_id: initialData.customer_id ?? "",
        machine_id: initialData.machine_id ?? "",
        amount: initialData.amount?.toString() ?? "",
        issued_date: initialData.issued_date,
        valid_until: initialData.valid_until ?? "",
        status: initialData.status,
        notes: initialData.notes ?? "",
        file_url: initialData.file_url ?? "",
      });
    } else {
      setForm({
        doc_type: "quotation",
        title: "",
        customer_id: "",
        machine_id: "",
        amount: "",
        issued_date: today,
        valid_until: "",
        status: "issued",
        notes: "",
        file_url: "",
      });
    }
  }, [initialData, open]);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // doc_type 변경 시 status 초기화
  const handleDocTypeChange = (v: string) => {
    const firstStatus = DOC_STATUS_OPTIONS[v as DocType]?.[0]?.value ?? "issued";
    setForm((f) => ({ ...f, doc_type: v, status: firstStatus }));
  };

  const statusOptions = DOC_STATUS_OPTIONS[form.doc_type as DocType] ?? [];

  const handleSubmit = async () => {
    if (!form.title.trim() || !userId) return;

    const payload = {
      created_by: initialData?.created_by ?? userId,
      doc_type: form.doc_type as DocType,
      title: form.title.trim(),
      customer_id: form.customer_id || null,
      machine_id: form.machine_id || null,
      amount: form.amount ? Number(form.amount.replace(/,/g, "")) : null,
      issued_date: form.issued_date,
      valid_until: form.valid_until || null,
      status: form.status,
      notes: form.notes || null,
      file_url: form.file_url || null,
    };

    try {
      if (initialData) {
        await updateDocument.mutateAsync({ id: initialData.id, ...payload });
        toast({ title: "문서가 수정됐어요." });
      } else {
        await addDocument.mutateAsync(payload);
        toast({ title: "문서가 저장됐어요." });
      }
      onClose();
    } catch {
      toast({ title: "저장 실패", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? "문서 수정" : "문서 작성"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>문서 유형 *</Label>
              <Select value={form.doc_type} onValueChange={handleDocTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>상태</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>제목 *</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="예: 홍길동 고객 트랙터 견적서"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>발행일</Label>
              <Input
                type="date"
                value={form.issued_date}
                onChange={(e) => set("issued_date", e.target.value)}
              />
            </div>

            {form.doc_type === "quotation" && (
              <div className="space-y-1.5">
                <Label>유효기한</Label>
                <Input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => set("valid_until", e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>금액 (원)</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="예: 15000000"
            />
          </div>

          <div className="space-y-1.5">
            <Label>비고</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="추가 내용"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>파일 링크</Label>
            <Input
              value={form.file_url}
              onChange={(e) => set("file_url", e.target.value)}
              placeholder="파일 URL 또는 드라이브 링크"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {initialData && onCreateFinance && (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  onClose();
                  onCreateFinance(initialData.id);
                }}
              >
                💰 미수금 등록
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.title.trim() || addDocument.isPending || updateDocument.isPending}
            >
              {initialData ? "수정" : "저장"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
