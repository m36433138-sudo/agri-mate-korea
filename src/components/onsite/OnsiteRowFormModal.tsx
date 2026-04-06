import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { MachineSearchInput } from "@/components/MachineSearchInput";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";

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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toast } = useToast();
  const isEdit = !!row;

  useEffect(() => {
    if (open) {
      setForm(rowToForm(row || undefined));
      setSelectedCustomerId(null);
      setConfirmDelete(false);
    }
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

  const handleDelete = async () => {
    if (!row?._rowIndex) return;
    setDeleting(true);
    try {
      await supabase.functions.invoke("google-sheets", {
        body: { action: "clearRow", sheetName: "방문수리", rowIndex: row._rowIndex },
      });
      toast({ title: "삭제 완료" });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "삭제 오류", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
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
            <CustomerSearchInput
              value={form.name}
              onChange={v => set("name", v)}
              onSelect={c => {
                set("name", c.name);
                set("phone", c.phone || "");
                set("address", c.address || "");
                setSelectedCustomerId(c.id);
              }}
            />
          </div>
          <div>
            <Label>전화번호</Label>
            <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>
          <div>
            <Label>기계</Label>
            <MachineSearchInput
              value={form.machine}
              customerId={selectedCustomerId}
              onChange={v => set("machine", v)}
              onSelect={m => {
                set("machine", m.model_name);
                set("model", m.serial_number || "");
              }}
            />
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
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEdit && !confirmDelete && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}
              disabled={saving || deleting} className="sm:mr-auto">
              <Trash2 className="h-4 w-4 mr-1" /> 삭제
            </Button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2 sm:mr-auto">
              <span className="text-sm text-destructive font-medium">정말 삭제하시겠습니까?</span>
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? "삭제 중..." : "확인"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>취소</Button>
            </div>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving || deleting}>취소</Button>
          <Button onClick={handleSave} disabled={saving || deleting}>
            {saving ? "저장 중..." : isEdit ? "수정" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
