import { useState, useEffect } from "react";
import { SheetRow, OperationStatus } from "@/types/operations";
import { supabase } from "@/integrations/supabase/client";
import { useTechnicians } from "@/hooks/useTechnicians";
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

const STATUSES: OperationStatus[] = ["입고대기", "수리중", "출고대기", "보류"];

interface FormData {
  status: string;
  name: string;
  machine: string;
  model: string;
  phone: string;
  address: string;
  location: string;
  technician: string;
  request: string;
  entryDate: string;
  repairStart: string;
  repairDone: string;
  exitDate: string;
  contact: string;
  contactNote: string;
  note: string;
  writer: string;
}

function rowToForm(row?: SheetRow): FormData {
  if (!row) return {
    status: "입고대기", name: "", machine: "", model: "", phone: "", address: "",
    location: "", technician: "", request: "", entryDate: "", repairStart: "",
    repairDone: "", exitDate: "", contact: "", contactNote: "", note: "", writer: "",
  };
  return {
    status: row.status_label || "입고대기",
    name: row.손님성명, machine: row.기계, model: row.품목, phone: row.전화번호,
    address: row.주소, location: row.위치, technician: row.수리기사,
    request: row.손님요구사항, entryDate: row.입고일, repairStart: row.수리시작일,
    repairDone: row.수리완료일, exitDate: row.출고일, contact: row.연락여부,
    contactNote: row.연락사항, note: row.비고, writer: row.입력자 || "",
  };
}

function formToValues(f: FormData): string[] {
  return [
    f.status, f.name, f.machine, f.model, f.phone, f.address, f.location,
    f.technician, f.request, "", f.entryDate, f.repairStart, f.repairDone,
    f.exitDate, f.contact, f.contactNote, "", f.note,
  ];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  row?: SheetRow | null;
  branch: "장흥" | "강진";
}

export function RowFormModal({ open, onClose, onSuccess, row, branch }: Props) {
  const [form, setForm] = useState<FormData>(rowToForm(row || undefined));
  const [formBranch, setFormBranch] = useState<"장흥" | "강진">(branch);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: technicians = [] } = useTechnicians();
  const { toast } = useToast();
  const isEdit = !!row;

  useEffect(() => {
    if (open) {
      setForm(rowToForm(row || undefined));
      setFormBranch(row?._branch as "장흥" | "강진" ?? branch);
      setSelectedCustomerId(null);
      setConfirmDelete(false);
    }
  }, [open, row, branch]);

  const set = (key: keyof FormData, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "이름을 입력하세요", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const sheetName = formBranch === "강진" ? "강진(입출수)" : "장흥(입출수)";
      const values = formToValues(form);

      if (isEdit && row) {
        await supabase.functions.invoke("google-sheets", {
          body: { action: "updateRow", sheetName, rowIndex: row._rowIndex, values },
        });
        toast({ title: "수정 완료" });
      } else {
        await supabase.functions.invoke("google-sheets", {
          body: { action: "addRow", sheetName, values },
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
    if (!row) return;
    setDeleting(true);
    try {
      const sheetName = row._branch === "강진" ? "강진(입출수)" : "장흥(입출수)";
      await supabase.functions.invoke("google-sheets", {
        body: { action: "clearRow", sheetName, rowIndex: row._rowIndex },
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
          <DialogTitle>{isEdit ? "작업 수정" : "새 작업 추가"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {/* 지점 선택 */}
          <div className="col-span-2">
            <Label>지점</Label>
            <div className="flex gap-2 mt-1">
              {(["장흥", "강진"] as const).map(b => (
                <Button key={b} type="button" size="sm"
                  variant={formBranch === b ? "default" : "outline"}
                  onClick={() => setFormBranch(b)} className="flex-1"
                >{b}</Button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <Label>진행상태</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
          <div>
            <Label>주소</Label>
            <Input value={form.address} onChange={e => set("address", e.target.value)} />
          </div>
          <div>
            <Label>위치</Label>
            <Input value={form.location} onChange={e => set("location", e.target.value)} />
          </div>
          <div>
            <Label>수리기사</Label>
            <Select value={form.technician || "_none"} onValueChange={v => set("technician", v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="기사 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">선택 안함</SelectItem>
                {technicians.map(t => (
                  <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                ))}
                {form.technician && !technicians.find(t => t.name === form.technician) && form.technician !== "" && (
                  <SelectItem value={form.technician}>{form.technician} (기존)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>연락여부</Label>
            <Input value={form.contact} onChange={e => set("contact", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>손님 요구사항</Label>
            <Textarea value={form.request} onChange={e => set("request", e.target.value)} rows={2} />
          </div>
          <div>
            <Label>입고일</Label>
            <Input value={form.entryDate} onChange={e => set("entryDate", e.target.value)} placeholder="2026-01-01" />
          </div>
          <div>
            <Label>수리시작일</Label>
            <Input value={form.repairStart} onChange={e => set("repairStart", e.target.value)} placeholder="2026-01-01" />
          </div>
          <div>
            <Label>수리완료일</Label>
            <Input value={form.repairDone} onChange={e => set("repairDone", e.target.value)} placeholder="2026-01-01" />
          </div>
          <div>
            <Label>출고일</Label>
            <Input value={form.exitDate} onChange={e => set("exitDate", e.target.value)} placeholder="2026-01-01" />
          </div>
          <div className="col-span-2">
            <Label>연락사항 / 견적</Label>
            <Input value={form.contactNote} onChange={e => set("contactNote", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>비고</Label>
            <Input value={form.note} onChange={e => set("note", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>입력자</Label>
            <Input value={form.writer} onChange={e => set("writer", e.target.value)} placeholder="이름을 입력하세요" />
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
