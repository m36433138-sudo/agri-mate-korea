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
import { ONSITE_TAB, buildOnsiteValues, onsiteLayout, type OnsiteLayout, type OnsiteRow } from "@/lib/onsiteSheet";

const STATUSES = ["출장", "50시간 A/S", "진행중", "완료", "보류"];
const BRANCHES = ["장흥", "강진"];
const MACHINE_TYPES = ["트랙터", "콤바인", "이앙기", "기타"];

interface FormData {
  status: string;
  name: string;
  machine: string;       // 기계 종류
  model: string;         // 품목 (모델명)
  serial_number: string; // 제조번호 (UI 전용)
  phone: string;
  address: string;
  detail: string;
  branch: string;
  technician: string;
}

function rowToForm(row?: OnsiteRow): FormData {
  if (!row) return {
    status: "", name: "", machine: "", model: "", serial_number: "",
    phone: "", address: "", detail: "", branch: "", technician: "",
  };
  return {
    status: row.진행사항,
    name: row.손님성함,
    machine: row.기계,
    model: row.품목,
    serial_number: "",
    phone: row.전화번호,
    address: row.주소,
    detail: row.내역,
    branch: row.지점,
    technician: row.출장기사,
  };
}

function formToFields(f: FormData) {
  const modelWithSerial = f.model + (f.serial_number ? ` (${f.serial_number})` : "");
  return {
    status: f.status, branch: f.branch, name: f.name, phone: f.phone, address: f.address,
    detail: f.detail, machine: f.machine, model: modelWithSerial, technician: f.technician,
  };
}

async function callSheet(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("google-sheets", { body: { ...body, sheetName: ONSITE_TAB } });
  if (error) {
    const ctx = (error as any).context;
    const msg = ctx?.json ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message);
  }
  if (data?.error) throw new Error(data.error);
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  row?: OnsiteRow | null;
  layout?: OnsiteLayout;
}

export function OnsiteRowFormModal({ open, onClose, onSuccess, row, layout }: Props) {
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
      const lay = layout ?? onsiteLayout(undefined);
      const values = buildOnsiteValues(lay, formToFields(form), isEdit ? row?._raw : []);

      if (isEdit && row?._rowIndex) {
        await callSheet({ action: "updateRow", rowIndex: row._rowIndex, values });
        toast({ title: "수정 완료" });
      } else {
        await callSheet({ action: "addRow", values });
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
      await callSheet({ action: "clearRow", rowIndex: row._rowIndex });
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

          {/* 진행사항 */}
          <div className="col-span-2">
            <Label>진행사항</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
              <SelectContent>
                {Array.from(new Set([...STATUSES, form.status].filter(Boolean))).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* 지점 */}
          <div>
            <Label>지점</Label>
            <Select value={form.branch} onValueChange={v => set("branch", v)}>
              <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
              <SelectContent>
                {Array.from(new Set([...BRANCHES, form.branch].filter(Boolean))).map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* 출장기사 */}
          <div>
            <Label>출장기사</Label>
            <Input value={form.technician} onChange={e => set("technician", e.target.value)} />
          </div>

          {/* 손님 성함 */}
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

          {/* 전화번호 */}
          <div>
            <Label>전화번호</Label>
            <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>

          {/* 기계 종류 — Select */}
          <div>
            <Label>기계</Label>
            <Select value={form.machine} onValueChange={v => set("machine", v)}>
              <SelectTrigger>
                <SelectValue placeholder="기계 선택" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Set([...MACHINE_TYPES, form.machine].filter(Boolean))).map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 품목 (모델명) — 검색 지원 */}
          <div>
            <Label>품목 (모델명)</Label>
            <MachineSearchInput
              value={form.model}
              customerId={selectedCustomerId}
              onChange={v => set("model", v)}
              onSelect={m => {
                set("model", m.model_name);
                set("serial_number", m.serial_number || "");
              }}
              placeholder="모델명 검색 또는 직접 입력"
            />
          </div>

          {/* 제조번호 */}
          <div className="col-span-2">
            <Label>제조번호</Label>
            <Input
              value={form.serial_number}
              onChange={e => set("serial_number", e.target.value)}
              placeholder="예: YR60DZ-123456"
              className="font-mono"
            />
          </div>

          {/* 주소 */}
          <div className="col-span-2">
            <Label>주소</Label>
            <Input value={form.address} onChange={e => set("address", e.target.value)} />
          </div>

          {/* 내역 */}
          <div className="col-span-2">
            <Label>요구사항 · 내역</Label>
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
