import { useEffect, useState } from "react";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { StaffPicker } from "@/components/StaffPicker";
import { MachineSearchInput } from "@/components/MachineSearchInput";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VISIT_STATUSES, type OnsiteVisit, type VisitInput, type VisitStatus } from "@/lib/onsiteVisits";

const CATEGORIES = ["출장", "50시간 A/S", "점검", "배달·수거"];
const BRANCHES = ["장흥", "강진"];
const MACHINE_TYPES = ["트랙터", "콤바인", "이앙기", "기타"];
const PRIORITIES = ["급함", "이번 주", "한가할 때"];

type Form = {
  status: VisitStatus; category: string; branch: string; priority: string; requested: string; scheduled_on: string;
  customer_name: string; phone: string; address: string; detail: string; machine: string; model: string; serial: string; technician: string;
  customer_id: string | null;
};

const empty: Form = {
  status: "대기", category: "출장", branch: "", priority: "", requested: "", scheduled_on: "",
  customer_name: "", phone: "", address: "", detail: "", machine: "", model: "", serial: "", technician: "", customer_id: null,
};

function toForm(v?: OnsiteVisit | null, defaults?: Partial<Form>): Form {
  if (!v) return { ...empty, ...defaults };
  return {
    status: v.status, category: v.category ?? "", branch: v.branch ?? "", priority: v.priority ?? "", requested: v.requested ?? "",
    scheduled_on: v.scheduled_on ?? "", customer_name: v.customer_name, phone: v.phone ?? "", address: v.address ?? "", detail: v.detail ?? "",
    machine: v.machine ?? "", model: v.model ?? "", serial: "", technician: v.technician ?? "", customer_id: v.customer_id,
  };
}

const opt = (s: string) => (s.trim() ? s.trim() : null);
const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export function formToInput(f: Form, prev?: OnsiteVisit | null): VisitInput {
  const model = f.model.trim() + (f.serial.trim() ? ` (${f.serial.trim()})` : "");
  return {
    status: f.status,
    category: opt(f.category),
    branch: opt(f.branch),
    priority: opt(f.priority),
    requested: opt(f.requested),
    scheduled_on: f.scheduled_on || null,
    completed_on: f.status === "완료" ? prev?.completed_on ?? today() : null,
    customer_name: f.customer_name.trim(),
    phone: opt(f.phone),
    address: opt(f.address),
    detail: opt(f.detail),
    machine: opt(f.machine),
    model: opt(model),
    technician: opt(f.technician),
    customer_id: f.customer_id,
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  visit?: OnsiteVisit | null;
  defaults?: Partial<Form>;
  canDelete?: boolean;
  onSave: (input: VisitInput, prev: OnsiteVisit | null) => Promise<void>;
  onDelete?: (v: OnsiteVisit) => Promise<void>;
}

function Chips({ value, options, onChange, label }: { value: string; options: readonly string[]; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {Array.from(new Set([...options, value].filter(Boolean))).map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(value === o ? "" : o)}
          className={cn("h-9 px-3 rounded-full border text-sm", value === o ? "border-primary bg-primary/10 text-primary font-semibold" : "text-muted-foreground")}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function OnsiteRowFormModal({ open, onClose, visit, defaults, canDelete, onSave, onDelete }: Props) {
  const [form, setForm] = useState<Form>(toForm(visit, defaults));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEdit = !!visit;

  useEffect(() => {
    if (open) { setForm(toForm(visit, defaults)); setConfirmDelete(false); }
  }, [open, visit, defaults]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.customer_name.trim()) return;
    setSaving(true);
    try {
      await onSave(formToInput(form, visit), visit ?? null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!visit || !onDelete) return;
    setSaving(true);
    try { await onDelete(visit); onClose(); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "방문수리 수정" : "방문수리 추가"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>상태</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {VISIT_STATUSES.map((s) => (
                <button key={s} type="button" aria-pressed={form.status === s} onClick={() => set("status", s)}
                  className={cn("h-10 rounded-xl border text-sm font-medium", form.status === s ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>종류</Label>
            <Chips value={form.category} options={CATEGORIES} onChange={(v) => set("category", v)} label="종류" />
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label>손님 성함 *</Label>
            <CustomerSearchInput
              value={form.customer_name}
              onChange={(v) => set("customer_name", v)}
              onSelect={(c) => setForm((p) => ({ ...p, customer_name: c.name, phone: c.phone || p.phone, address: c.address || p.address, customer_id: c.id }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>전화번호</Label>
            <Input value={form.phone} inputMode="tel" onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>주소</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="예: 대구면 백사1길 72 (읍·면부터 적어도 돼요)" />
          </div>

          <div className="space-y-1.5">
            <Label>기계</Label>
            <Select value={form.machine} onValueChange={(v) => set("machine", v)}>
              <SelectTrigger><SelectValue placeholder="기계 선택" /></SelectTrigger>
              <SelectContent>{Array.from(new Set([...MACHINE_TYPES, form.machine].filter(Boolean))).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>품목 (모델명)</Label>
            <MachineSearchInput value={form.model} customerId={form.customer_id} onChange={(v) => set("model", v)}
              onSelect={(m) => setForm((p) => ({ ...p, model: m.model_name, serial: m.serial_number || "" }))} placeholder="모델명 검색 또는 직접 입력" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>요구사항 · 내역</Label>
            <Textarea value={form.detail} onChange={(e) => set("detail", e.target.value)} rows={3} />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label>우선순위</Label>
            <Chips value={form.priority} options={PRIORITIES} onChange={(v) => set("priority", v)} label="우선순위" />
          </div>
          <div className="space-y-1.5">
            <Label>가기로 한 날</Label>
            <div className="flex gap-1.5">
              <Input type="date" value={form.scheduled_on} onChange={(e) => set("scheduled_on", e.target.value)} className="min-w-0" />
              <Button type="button" variant="outline" className="shrink-0" onClick={() => set("scheduled_on", today())}>오늘</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>손님이 원한 때</Label>
            <Input value={form.requested} onChange={(e) => set("requested", e.target.value)} placeholder="예: 모내기 전, 11/25" />
          </div>
          <div className="space-y-1.5">
            <Label>지점</Label>
            <Chips value={form.branch} options={BRANCHES} onChange={(v) => set("branch", v)} label="지점" />
          </div>
          <div className="space-y-1.5">
            <Label>출장기사</Label>
            <StaffPicker multiple value={form.technician} onChange={(v) => set("technician", v)} placeholder="출장기사 선택" />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEdit && canDelete && onDelete && !confirmDelete && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} disabled={saving} className="sm:mr-auto text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> 삭제
            </Button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2 sm:mr-auto">
              <span className="text-sm text-destructive font-medium">정말 삭제할까요?</span>
              <Button size="sm" variant="destructive" onClick={remove} disabled={saving}>삭제</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>취소</Button>
            </div>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={save} disabled={saving || !form.customer_name.trim()}>{saving ? "저장 중..." : isEdit ? "저장" : "추가"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
