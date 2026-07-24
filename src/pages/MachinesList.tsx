import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useListFilter } from "@/hooks/useListFilter";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Plus, Search, Upload, Trash2, FileSpreadsheet, Zap } from "lucide-react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MachineWithCustomer } from "@/types/database";
import { validateMachineTypeClassification } from "@/lib/machineValidation";

const MANUFACTURERS = ["얀마", "구보다", "LS", "TYM", "대동", "존디어", "펜트", "도이치바", "기타"];
const CLASSIFICATIONS = ["농업용트랙터", "콤바인", "이앙기", "기타"];

export default function MachinesList() {
  const [typeTab, setTypeTab] = useState("전체");
  const [statusTab, setStatusTab] = useState("전체");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  useRealtimeSync("machines", [["machines"]]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("machines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast({ title: "기계가 삭제되었습니다." });
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  const { data: machines, isLoading } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("*, customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MachineWithCustomer[];
    },
  });

  const KNOWN_TYPES = ["농업용트랙터", "콤바인", "이앙기"];
  const normalizeClassification = (c: any) => {
    const s = String(c ?? "").replace(/\s+/g, "");
    if (s === "트랙터" || s === "농업용트랙터") return "농업용트랙터";
    if (s === "콤바인") return "콤바인";
    if (s === "이앙기") return "이앙기";
    return "기타";
  };
  const typeFilteredData = useMemo(() => {
    if (typeTab === "전체") return machines;
    return machines.filter((m) => normalizeClassification((m as any).classification) === typeTab);
  }, [machines, typeTab]);

  const { search, setSearch, filtered } = useListFilter<MachineWithCustomer>({
    data: typeFilteredData,
    searchFields: ["model_name", "serial_number"],
    tabFilters: { status: statusTab },
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">기계관리</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> 일괄 등록
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 기계 등록
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Tabs value={typeTab} onValueChange={setTypeTab}>
          <TabsList>
            <TabsTrigger value="전체">전체</TabsTrigger>
            <TabsTrigger value="농업용트랙터">트랙터</TabsTrigger>
            <TabsTrigger value="콤바인">콤바인</TabsTrigger>
            <TabsTrigger value="이앙기">이앙기</TabsTrigger>
            <TabsTrigger value="기타">기타</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <TabsList>
            <TabsTrigger value="전체">전체</TabsTrigger>
            <TabsTrigger value="재고중">재고중</TabsTrigger>
            <TabsTrigger value="판매완료">판매완료</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="모델명 또는 제조번호 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered?.length === 0 ? (
        <Card className="shadow-card border-0"><CardContent className="py-12 text-center text-muted-foreground">등록된 기계가 없습니다. 새로운 기계를 등록하여 관리를 시작하세요.</CardContent></Card>
      ) : (
        <Card className="shadow-card border-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">제조사</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">모델명</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">제조번호</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">기종</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">구분</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">상태</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">입고일</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">판매일</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">고객명</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">매입가</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((m: any) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="p-3 text-muted-foreground">{m.manufacturer || "-"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/machines/${m.id}`} className="font-medium text-foreground hover:text-primary">{m.model_name}</Link>
                        {(m as any).ecu_mapped && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-blue-600 to-violet-600 text-white whitespace-nowrap">
                            <Zap className="h-2.5 w-2.5" />ECU{(m as any).ecu_hp ? ` ${(m as any).ecu_hp}HP` : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{m.serial_number}</td>
                    <td className="p-3 text-muted-foreground">{(m as any).classification ? ((m as any).classification === "농업용트랙터" ? "트랙터" : (m as any).classification) : "-"}</td>
                    <td className="p-3"><TypeBadge type={m.machine_type} /></td>
                    <td className="p-3"><StatusBadge status={m.status} /></td>
                    <td className="p-3 text-muted-foreground">{formatDate(m.entry_date)}</td>
                    <td className="p-3 text-muted-foreground">{m.sale_date ? formatDate(m.sale_date) : "-"}</td>
                    <td className="p-3 text-muted-foreground">{m.customers?.name || "-"}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{formatPrice(m.purchase_price)}</td>
                    <td className="p-3">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); if (confirm("이 기계를 삭제하시겠습니까?")) deleteMutation.mutate(m.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AddMachineDialog open={open} onOpenChange={setOpen} />
      <BulkMachineDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  );
}

function AddMachineDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ model_name: "", serial_number: "", machine_type: "새기계", classification: "농업용트랙터", manufacturer: "얀마", entry_date: "", purchase_price: "", notes: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const check = validateMachineTypeClassification({ machine_type: form.machine_type, classification: form.classification });
      if (check.ok === false) throw new Error(check.message);
      const price = form.purchase_price ? parseInt(form.purchase_price) : null;
      const { error } = await supabase.from("machines").insert({
        model_name: form.model_name, serial_number: form.serial_number,
        machine_type: form.machine_type, classification: form.classification, manufacturer: form.manufacturer,
        entry_date: form.entry_date,
        purchase_price: price, notes: form.notes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast({ title: "기계가 성공적으로 등록되었습니다." });
      onOpenChange(false);
      setForm({ model_name: "", serial_number: "", machine_type: "새기계", classification: "농업용트랙터", manufacturer: "얀마", entry_date: "", purchase_price: "", notes: "" });
    },
    onError: (e: any) => toast({ title: "오류 발생", description: e.message, variant: "destructive" }),
  });

  const valid = form.model_name && form.serial_number && form.entry_date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>기계 등록</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>제조사 *</Label>
            <Select value={form.manufacturer} onValueChange={v => setForm(f => ({...f, manufacturer: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MANUFACTURERS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>기종 * <span className="text-xs text-muted-foreground">(트랙터/콤바인/이앙기)</span></Label>
            <Select value={form.classification} onValueChange={v => setForm(f => ({...f, classification: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CLASSIFICATIONS.map(c => <SelectItem key={c} value={c}>{c === "농업용트랙터" ? "트랙터" : c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>모델명 *</Label><Input value={form.model_name} onChange={e => setForm(f => ({...f, model_name: e.target.value}))} placeholder="예: YT5101" /></div>
          <div><Label>제조번호 *</Label><Input value={form.serial_number} onChange={e => setForm(f => ({...f, serial_number: e.target.value}))} placeholder="예: YT5101-2023001" /></div>
          <div>
            <Label>구분 * <span className="text-xs text-muted-foreground">(새기계/중고기계)</span></Label>
            <Select value={form.machine_type} onValueChange={v => setForm(f => ({...f, machine_type: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="새기계">새기계</SelectItem><SelectItem value="중고기계">중고기계</SelectItem><SelectItem value="타사기계">타사기계</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>입고일 *</Label><Input type="date" value={form.entry_date} onChange={e => setForm(f => ({...f, entry_date: e.target.value}))} /></div>
          <div><Label>매입가 (원)</Label><Input type="number" value={form.purchase_price} onChange={e => setForm(f => ({...f, purchase_price: e.target.value}))} placeholder="선택 사항" /></div>
          <div><Label>특이사항</Label><Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>{mutation.isPending ? "등록 중..." : "등록"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BulkMachineRow = { model_name: string; serial_number: string; classification: string; machine_type: string; entry_date: string; purchase_price: string; notes: string; customer_name: string; customer_phone: string };

const formatExcelDate = (v: any): string => {
  if (!v) return "";
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return String(v);
};

const normalizePhone = (v: string) => v.replace(/[^0-9]/g, "");

const emptyMachineRow = (): BulkMachineRow => ({ model_name: "", serial_number: "", classification: "농업용트랙터", machine_type: "새기계", entry_date: "", purchase_price: "", notes: "", customer_name: "", customer_phone: "" });

function BulkMachineDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<BulkMachineRow[]>([emptyMachineRow(), emptyMachineRow(), emptyMachineRow()]);

  const updateRow = (i: number, field: keyof BulkMachineRow, value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const addRow = () => setRows((prev) => [...prev, emptyMachineRow()]);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows2D = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        const mapped: BulkMachineRow[] = rows2D.slice(1).map((row: any[]) => {
          return {
            model_name: String(row[0] || ""), serial_number: String(row[1] || ""),
            classification: String(row[2] || "농업용트랙터"),
            machine_type: String(row[3] || "새기계"), entry_date: formatExcelDate(row[4]),
            purchase_price: String(row[5] || "").replace(/[^0-9]/g, ""),
            notes: String(row[6] || ""),
            customer_name: String(row[7] || ""),
            customer_phone: String(row[8] || ""),
          };
        });
        setRows((prev) => [...prev.filter(r => r.model_name || r.serial_number), ...mapped]);
        toast({ title: `엑셀에서 ${mapped.length}행을 불러왔습니다.` });
      } catch {
        toast({ title: "엑셀 파일을 읽을 수 없습니다.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const validRows = rows.filter((r) => r.model_name && r.serial_number && r.entry_date);

  const mutation = useMutation({
    mutationFn: async () => {
      // 0) Dedupe within batch + check existing serials in DB
      const serials = Array.from(new Set(validRows.map(r => r.serial_number.trim()).filter(Boolean)));
      const existingSerials = new Set<string>();
      // chunk to avoid URL limits
      for (let i = 0; i < serials.length; i += 200) {
        const chunk = serials.slice(i, i + 200);
        const { data, error } = await supabase.from("machines").select("serial_number").in("serial_number", chunk);
        if (error) throw error;
        (data || []).forEach((m: any) => existingSerials.add(m.serial_number));
      }
      const seen = new Set<string>();
      const dupInBatch: string[] = [];
      const dupInDb: string[] = [];
      const filteredRows = validRows.filter((r) => {
        const s = r.serial_number.trim();
        if (existingSerials.has(s)) { dupInDb.push(s); return false; }
        if (seen.has(s)) { dupInBatch.push(s); return false; }
        seen.add(s);
        return true;
      });

      // 1) Resolve/create customers by phone
      const phoneRows = filteredRows.filter(r => normalizePhone(r.customer_phone));
      const phones = Array.from(new Set(phoneRows.map(r => normalizePhone(r.customer_phone))));
      const phoneToId = new Map<string, string>();

      if (phones.length > 0) {
        const { data: existing, error: e1 } = await supabase
          .from("customers").select("id, phone").in("phone", phones);
        if (e1) throw e1;
        (existing || []).forEach((c: any) => phoneToId.set(normalizePhone(c.phone || ""), c.id));

        const toCreate = phoneRows
          .filter(r => !phoneToId.has(normalizePhone(r.customer_phone)))
          .reduce((acc: any[], r) => {
            const p = normalizePhone(r.customer_phone);
            if (acc.find(x => normalizePhone(x.phone) === p)) return acc;
            acc.push({ name: r.customer_name || "미상", phone: r.customer_phone });
            return acc;
          }, []);

        if (toCreate.length > 0) {
          const { data: created, error: e2 } = await supabase
            .from("customers").insert(toCreate).select("id, phone");
          if (e2) throw e2;
          (created || []).forEach((c: any) => phoneToId.set(normalizePhone(c.phone || ""), c.id));
        }
      }

      const inserts = filteredRows.map((r, idx) => {
        const check = validateMachineTypeClassification({ machine_type: r.machine_type, classification: r.classification });
        if (check.ok === false) throw new Error(`${idx + 1}행: ${check.message}`);
        const priceRaw = String(r.purchase_price).replace(/[^0-9]/g, "");
        const price = priceRaw ? parseInt(priceRaw, 10) : null;
        const phone = normalizePhone(r.customer_phone);
        const customer_id = phone ? phoneToId.get(phone) || null : null;
        return {
          model_name: r.model_name, serial_number: r.serial_number.trim(),
          classification: r.classification, machine_type: r.machine_type,
          entry_date: r.entry_date, purchase_price: price, notes: r.notes || null,
          customer_id,
          status: customer_id ? "판매완료" : "재고중",
        };
      });
      if (inserts.length > 0) {
        const { error } = await supabase.from("machines").insert(inserts as any);
        if (error) throw error;
      }
      return { inserted: inserts.length, dupInDb, dupInBatch };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      const skipped = res.dupInDb.length + res.dupInBatch.length;
      const skipMsg = skipped > 0
        ? ` (중복 제외 ${skipped}건${res.dupInDb.length ? ` · 기존 ${res.dupInDb.slice(0,3).join(", ")}${res.dupInDb.length>3?" 외":""}` : ""})`
        : "";
      toast({ title: `${res.inserted}대 등록 완료${skipMsg}` });
      if (res.inserted === 0) return;
      onOpenChange(false);
      setRows([emptyMachineRow(), emptyMachineRow(), emptyMachineRow()]);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>기계 일괄 등록</DialogTitle>
          <p className="text-sm text-muted-foreground">엑셀 열 순서: 모델명, 제조번호, 기종(트랙터/콤바인/이앙기), 구분(새기계/중고기계), 입고일, 매입가, 특이사항, 고객명, 고객전화번호<br />
            · 매입가는 선택 항목입니다. · 고객 전화번호가 있으면 기존 고객과 자동 연결되며, 없으면 새 고객으로 등록됩니다.</p>
        </DialogHeader>
        <div>
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm font-medium text-primary hover:underline">
            <FileSpreadsheet className="h-4 w-4" /> 엑셀 파일 불러오기
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelUpload} />
          </label>
        </div>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_100px_90px_115px_110px_1fr_120px_auto] gap-2 items-end">
                {i === 0 && (
                  <>
                    <Label className="text-xs">모델명 *</Label><Label className="text-xs">제조번호 *</Label>
                    <Label className="text-xs">기종 *</Label>
                    <Label className="text-xs">구분 *</Label><Label className="text-xs">입고일 *</Label>
                    <Label className="text-xs">매입가</Label>
                    <Label className="text-xs">고객명</Label>
                    <Label className="text-xs">고객전화</Label>
                    <div />
                  </>
                )}
                <Input value={row.model_name} onChange={(e) => updateRow(i, "model_name", e.target.value)} placeholder="모델명" className="h-9 text-sm" />
                <Input value={row.serial_number} onChange={(e) => updateRow(i, "serial_number", e.target.value)} placeholder="제조번호" className="h-9 text-sm" />
                <Select value={row.classification} onValueChange={(v) => updateRow(i, "classification", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{CLASSIFICATIONS.map(c => <SelectItem key={c} value={c}>{c === "농업용트랙터" ? "트랙터" : c}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={row.machine_type} onValueChange={(v) => updateRow(i, "machine_type", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="새기계">새기계</SelectItem><SelectItem value="중고기계">중고</SelectItem><SelectItem value="타사기계">타사기계</SelectItem></SelectContent>
                </Select>
                <Input type="date" value={row.entry_date} onChange={(e) => updateRow(i, "entry_date", e.target.value)} className="h-9 text-sm" />
                <Input type="number" value={row.purchase_price} onChange={(e) => updateRow(i, "purchase_price", e.target.value)} placeholder="선택" className="h-9 text-sm" />
                <Input value={row.customer_name} onChange={(e) => updateRow(i, "customer_name", e.target.value)} placeholder="고객명" className="h-9 text-sm" />
                <Input value={row.customer_phone} onChange={(e) => updateRow(i, "customer_phone", e.target.value)} placeholder="010-0000-0000" className="h-9 text-sm" />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeRow(i)} disabled={rows.length <= 1}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> 행 추가</Button>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <span className="text-sm text-muted-foreground mr-auto">유효: {validRows.length} / {rows.length}</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={validRows.length === 0 || mutation.isPending}>
            {mutation.isPending ? "등록 중..." : `${validRows.length}대 일괄 등록`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
