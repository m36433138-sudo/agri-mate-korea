import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [custSearch, setCustSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { toast } = useToast();
  const isEdit = !!row;

  useEffect(() => {
    if (open) {
      setForm(rowToForm(row || undefined));
      setCustSearch(row?.손님성함 || "");
      setSelectedCustomerId(null);
    }
  }, [open, row]);

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

          {/* 고객 검색 */}
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
                  if (m) setForm(prev => ({ ...prev, machine: m.model_name, model: m.serial_number || prev.model }));
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
          <div className="col-span-2">
            <Label>내역</Label>
            <Textarea value={form.detail} onChange={e => set("detail", e.target.value)} rows={3} />
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
