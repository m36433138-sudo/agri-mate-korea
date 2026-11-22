import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useListFilter } from "@/hooks/useListFilter";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Plus, Upload, Trash2, FileSpreadsheet, Zap, MoreHorizontal, Tractor } from "lucide-react";
import { PageHeader, SearchField, ShowMore, Segmented } from "@/components/page/PageParts";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MachineWithCustomer } from "@/types/database";
import { validateMachineTypeClassification } from "@/lib/machineValidation";
import { fetchAllRows } from "@/lib/pagination";

const MANUFACTURERS = ["얀마", "구보다", "LS", "TYM", "대동", "존디어", "펜트", "도이치바", "기타"];
const CLASSIFICATIONS = ["농업용트랙터", "콤바인", "이앙기", "기타"];

export default function MachinesList() {
  const [typeTab, setTypeTab] = useState("전체");
  const [statusTab, setStatusTab] = useState("전체");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [shown, setShown] = useState(100);
  const navigate = useNavigate();
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
      return fetchAllRows<MachineWithCustomer>(async (from, to) => {
        const { data, error } = await supabase
        .from("machines")
        .select("*, customers(name)")
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to);
        return { data: data as MachineWithCustomer[] | null, error };
      });
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
    return machines?.filter((m) => normalizeClassification((m as any).classification) === typeTab);
  }, [machines, typeTab]);

  const { search, setSearch, filtered } = useListFilter<MachineWithCustomer>({
    data: typeFilteredData,
    searchFields: ["model_name", "serial_number", "customers.name", "manufacturer"],
    tabFilters: { status: statusTab },
  });
  useEffect(() => setShown(100), [search, typeTab, statusTab]);

  const classLabel = (c: any) => (c ? (c === "농업용트랙터" ? "트랙터" : c) : "");
  const inStockCount = machines?.filter((m) => m.status === "재고중").length ?? 0;
  const askDelete = (m: any) => { if (confirm("이 기계를 삭제하시겠습니까?")) deleteMutation.mutate(m.id); };
  const visible = (filtered ?? []).slice(0, shown);
  const RowMenu = ({ m }: { m: any }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground" aria-label="더 보기" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem asChild><Link to={`/machines/${m.id}`}>상세 보기</Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => askDelete(m)} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> 삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const Ecu = ({ m }: { m: any }) => m.ecu_mapped ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-600 to-violet-600 text-white whitespace-nowrap">
      <Zap className="h-2.5 w-2.5" />ECU{m.ecu_hp ? ` ${m.ecu_hp}HP` : ""}
    </span>
  ) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="기계관리"
        sub={isLoading ? "불러오는 중…" : <>전체 {(machines?.length ?? 0).toLocaleString("ko-KR")}대 · 재고 {inStockCount.toLocaleString("ko-KR")}대{filtered && filtered.length !== machines?.length && <> · 찾은 기계 {filtered.length.toLocaleString("ko-KR")}대</>}</>}
        actions={
          <>
            <Button variant="outline" className="h-11 rounded-full bg-card" onClick={() => setBulkOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" /> 일괄 등록
            </Button>
            <Button className="h-11 rounded-full px-5" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> 기계 등록
            </Button>
          </>
        }
      />

      <div className="flex flex-col xl:flex-row xl:items-center gap-2">
        <SearchField value={search} onChange={setSearch} placeholder="모델명, 제조번호로 찾기" className="xl:max-w-md" />
        <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 xl:mx-0 xl:px-0">
          <Segmented
            label="기종"
            value={typeTab}
            onChange={setTypeTab}
            options={[
              { value: "전체", label: "전체 기종" },
              { value: "농업용트랙터", label: "트랙터" },
              { value: "콤바인", label: "콤바인" },
              { value: "이앙기", label: "이앙기" },
              { value: "기타", label: "기타" },
            ]}
          />
          <Segmented
            label="상태"
            value={statusTab}
            onChange={setStatusTab}
            options={[
              { value: "전체", label: "전체" },
              { value: "재고중", label: "재고중" },
              { value: "판매완료", label: "판매완료" },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
      ) : filtered?.length === 0 ? (
        <div className="rounded-3xl border border-border/70 bg-card py-16 text-center text-muted-foreground text-sm">
          {search || typeTab !== "전체" || statusTab !== "전체" ? "조건에 맞는 기계가 없어요." : "등록된 기계가 없습니다. 새로운 기계를 등록하여 관리를 시작하세요."}
        </div>
      ) : (
        <>
          {/* PC: 표 */}
          <div className="hidden lg:block rounded-3xl border border-border/70 bg-card card-shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[13px]">
                  <th className="text-left font-medium px-5 py-3">모델 · 제조번호</th>
                  <th className="text-left font-medium px-3 py-3">기종</th>
                  <th className="text-left font-medium px-3 py-3">구분 · 상태</th>
                  <th className="text-left font-medium px-3 py-3">고객</th>
                  <th className="text-left font-medium px-3 py-3">입고 · 판매</th>
                  <th className="text-right font-medium px-3 py-3">매입가</th>
                  <th className="px-3 py-3 w-[56px]"><span className="sr-only">메뉴</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m: any) => (
                  <tr
                    key={m.id}
                    className="border-b border-border/60 last:border-0 hover:bg-foreground/[0.03] transition-colors cursor-pointer"
                    onClick={() => navigate(`/machines/${m.id}`)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{m.model_name}</span>
                        <Ecu m={m} />
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{m.manufacturer ? `${m.manufacturer} · ` : ""}{m.serial_number}</div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{classLabel(m.classification) || "-"}</td>
                    <td className="px-3 py-3"><div className="flex items-center gap-1.5"><TypeBadge type={m.machine_type} /><StatusBadge status={m.status} /></div></td>
                    <td className="px-3 py-3">
                      {m.customers?.name ? (
                        <Link to={`/customers/${m.customer_id}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary">{m.customers.name}</Link>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatDate(m.entry_date)}
                      {m.sale_date && <span className="block text-xs">판매 {formatDate(m.sale_date)}</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold whitespace-nowrap">{m.purchase_price ? formatPrice(m.purchase_price) : ""}</td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}><RowMenu m={m} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 휴대폰 · 태블릿: 카드 */}
          <ul className="lg:hidden grid gap-2 md:grid-cols-2">
            {visible.map((m: any) => (
              <li key={m.id} className="rounded-3xl border border-border/70 bg-card p-4 active:bg-foreground/[0.03]" onClick={() => navigate(`/machines/${m.id}`)}>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Tractor className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[16px] font-bold truncate">{m.model_name}</p>
                      <Ecu m={m} />
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{m.manufacturer ? `${m.manufacturer} · ` : ""}{m.serial_number}</p>
                  </div>
                  <div className="-mr-2 -mt-1" onClick={(e) => e.stopPropagation()}><RowMenu m={m} /></div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  <TypeBadge type={m.machine_type} />
                  <StatusBadge status={m.status} />
                  {classLabel(m.classification) && <span className="text-xs text-muted-foreground">{classLabel(m.classification)}</span>}
                </div>
                <div className="flex items-center justify-between mt-3 text-sm">
                  <span className="text-muted-foreground truncate">{m.customers?.name ?? "고객 없음"} · {formatDate(m.entry_date)}</span>
                  {m.purchase_price ? <span className="font-bold tabular-nums shrink-0">{formatPrice(m.purchase_price)}</span> : null}
                </div>
              </li>
            ))}
          </ul>
          <ShowMore shown={shown} total={filtered?.length ?? 0} onMore={() => setShown((n) => n + 100)} />
        </>
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
