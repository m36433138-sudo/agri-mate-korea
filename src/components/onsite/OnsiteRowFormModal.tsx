import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STATUSES = ["진행중", "완료", "보류"];

interface OnsiteRow {
  진행사항: string;
  손님성함: string;
  기계: string;
  품목: string;
  전화번호: string;
  주소: string;
  내역: string;
  _rowIndex?: number;
}

interface FormData {
  status: string;
  name: string;
  machine: string;
  model: string;
  phone: string;
  address: string;
  detail: string;
}

function rowToForm(row?: OnsiteRow): FormData {
  if (!row) return { status: "", name: "", machine: "", model: "", phone: "", address: "", detail: "" };
  return {
    status: row.진행사항,
    name: row.손님성함,
    machine: row.기계,
    model: row.품목,
    phone: row.전화번호,
    address: row.주소,
    detail: row.내역,
  };
}

function formToValues(f: FormData): string[] {
  return [f.status, f.name, f.machine, f.model, f.phone, f.address, f.detail];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  row?: OnsiteRow | null;
}

export function OnsiteRowFormModal({ open, onClose, onSuccess, row }: Props) {
  const [form, setForm] = useState<FormData>(rowToForm(row || undefined));
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const isEdit = !!row;

  useEffect(() => {
    if (open) setForm(rowToForm(row || undefined));
  }, [open, row]);

  const set = (key: keyof FormData, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "이름을 입력하세요", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const values = formToValues(form);

      if (isEdit && row?._rowIndex) {
        await supabase.functions.invoke("google-sheets", {
          body: { action: "updateRow", sheetName: "방문수리", rowIndex: row._rowIndex, values },
        });
        toast({ title: "수정 완료" });
      } else {
        await supabase.functions.invoke("google-sheets", {
          body: { action: "addRow", sheetName: "방문수리", values },
        });
        toast({ title: "추가 완료" });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "방문수리 수정" : "방문수리 추가"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>진행사항</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>손님 성함 *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div>
            <Label>전화번호</Label>
            <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>
          <div>
            <Label>기계</Label>
            <Input value={form.machine} onChange={e => set("machine", e.target.value)} />
          </div>
          <div>
            <Label>품목</Label>
            <Input value={form.model} onChange={e => set("model", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>주소</Label>
            <Input value={form.address} onChange={e => set("address", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>내역</Label>
            <Textarea value={form.detail} onChange={e => set("detail", e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "저장 중..." : isEdit ? "수정" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
