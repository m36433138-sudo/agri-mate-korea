import { useState, useEffect, useRef } from "react";
import { SheetRow, OperationStatus } from "@/types/operations";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, Trash2 } from "lucide-react";

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
    f.technician, f.request, f.entryDate, f.repairStart, f.repairDone,
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [custSearch, setCustSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { data: technicians = [] } = useTechnicians();
  const { toast } = useToast();
  const isEdit = !!row;

  useEffect(() => {
    if (open) {
      setForm(rowToForm(row || undefined));
      setFormBranch(row?._branch as "장흥" | "강진" ?? branch);
      setCustSearch(row?.손님성명 || "");
      setSelectedCustomerId(null);
    }
  }, [open, row, branch]);

  // 고객 목록
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "all-for-form"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, phone, address").order("name");
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 선택된 고객의 보유 기계
  const { data: customerMachines = [] } = useQuery({
    queryKey: ["machines", "by-customer", selectedCustomerId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("machines")
        .select("id, model_name, serial_number")
        .eq("customer_id", selectedCustomerId)
        .order("model_name");
      return data ?? [];
    },
    enabled: !!selectedCustomerId,
  });

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
    (c.phone || "").includes(custSearch)
  ).slice(0, 20);

  const set = (key: keyof FormData, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleCustomerSelect = (c: { id: string; name: string; phone: string; address: string }) => {
    setForm(prev => ({ ...prev, name: c.name, phone: c.phone || prev.phone, address: c.address || prev.address }));
    setCustSearch(c.name);
    setSelectedCustomerId(c.id);
    setCustOpen(false);
  };

  const handleMachineSelect = (m: { model_name: string; serial_number: string }) => {
    setForm(prev => ({ ...prev, machine: m.model_name, model: m.serial_number }));
  };

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
      const sheetName = (row._branch === "강진") ? "강진(입출수)" : "장흥(입출수)";
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
                <Button
                  key={b}
                  type="button"
                  size="sm"
                  variant={formBranch === b ? "default" : "outline"}
                  onClick={() => setFormBranch(b)}
                  className="flex-1"
                >
                  {b}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>진행상태</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* 고객 검색 (이름 입력 → 자동완성) */}
          <div>
            <Label>손님 성함 *</Label>
            <Popover open={custOpen} onOpenChange={setCustOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-9">
                  <span className="truncate">{form.name || "고객 검색..."}</span>
                  <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[260px] p-0" align="start">
                <Command>
                  <div className="p-2">
                    <Input
                      placeholder="이름 또는 전화번호..."
                      value={custSearch}
                      onChange={e => { setCustSearch(e.target.value); set("name", e.target.value); }}
                      autoFocus
                    />
                  </div>
                  <CommandList>
                    <CommandEmpty>검색 결과 없음</CommandEmpty>
                    <CommandGroup>
                      {filteredCustomers.map(c => (
                        <CommandItem key={c.id} onSelect={() => handleCustomerSelect(c)} className="cursor-pointer">
                          <span className="font-medium">{c.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>전화번호</Label>
            <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>

          {/* 보유 기계 드롭다운 */}
          <div>
            <Label>기계</Label>
            {customerMachines.length > 0 ? (
              <Select
                value={form.machine}
                onValueChange={v => {
                  const m = customerMachines.find((m: any) => m.model_name === v);
                  if (m) handleMachineSelect(m);
                }}
              >
                <SelectTrigger><SelectValue placeholder="기계 선택" /></SelectTrigger>
                <SelectContent>
                  {customerMachines.map((m: any) => (
                    <SelectItem key={m.id} value={m.model_name}>
                      {m.model_name}
                      {m.serial_number ? <span className="text-xs text-muted-foreground ml-1">({m.serial_number})</span> : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.machine} onChange={e => set("machine", e.target.value)} placeholder="기계명 입력" />
            )}
          </div>

          <div>
            <Label>품목 / 제조번호</Label>
            <Input value={form.model} onChange={e => set("model", e.target.value)} />
          </div>
          <div className="col-span-2">
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
            <Input type="date" value={form.entryDate} onChange={e => set("entryDate", e.target.value)} />
          </div>
          <div>
            <Label>수리시작일</Label>
            <Input type="date" value={form.repairStart} onChange={e => set("repairStart", e.target.value)} />
          </div>
          <div>
            <Label>수리완료일</Label>
            <Input type="date" value={form.repairDone} onChange={e => set("repairDone", e.target.value)} />
          </div>
          <div>
            <Label>출고일</Label>
            <Input type="date" value={form.exitDate} onChange={e => set("exitDate", e.target.value)} />
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
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || deleting}
              className="sm:mr-auto"
            >
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
