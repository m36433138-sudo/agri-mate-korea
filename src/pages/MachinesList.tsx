import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Plus, Search, Upload, Trash2, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MachinesList() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("전체");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: machines, isLoading } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = machines?.filter((m) => {
    const matchesSearch = m.model_name.includes(search) || m.serial_number.includes(search);
    const matchesTab = tab === "전체" || m.machine_type === tab;
    return matchesSearch && matchesTab;
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
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="전체">전체</TabsTrigger>
            <TabsTrigger value="새기계">새기계</TabsTrigger>
            <TabsTrigger value="중고기계">중고기계</TabsTrigger>
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
                  <th className="text-left p-3 font-medium text-muted-foreground">모델명</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">제조번호</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">구분</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">상태</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">입고일</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">매입가</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((m) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="p-3">
                      <Link to={`/machines/${m.id}`} className="font-medium text-foreground hover:text-primary">{m.model_name}</Link>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{m.serial_number}</td>
                    <td className="p-3"><TypeBadge type={m.machine_type} /></td>
                    <td className="p-3"><StatusBadge status={m.status} /></td>
                    <td className="p-3 text-muted-foreground">{formatDate(m.entry_date)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{formatPrice(m.purchase_price)}</td>
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
  const [form, setForm] = useState({ model_name: "", serial_number: "", machine_type: "새기계", entry_date: "", purchase_price: "", notes: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("machines").insert({
        model_name: form.model_name,
        serial_number: form.serial_number,
        machine_type: form.machine_type,
        entry_date: form.entry_date,
        purchase_price: parseInt(form.purchase_price),
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast({ title: "기계가 성공적으로 등록되었습니다." });
      onOpenChange(false);
      setForm({ model_name: "", serial_number: "", machine_type: "새기계", entry_date: "", purchase_price: "", notes: "" });
    },
    onError: (e: any) => {
      toast({ title: "오류 발생", description: e.message, variant: "destructive" });
    },
  });

  const valid = form.model_name && form.serial_number && form.entry_date && form.purchase_price;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>기계 등록</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>모델명 *</Label><Input value={form.model_name} onChange={e => setForm(f => ({...f, model_name: e.target.value}))} placeholder="예: YT5101 트랙터" /></div>
          <div><Label>제조번호 *</Label><Input value={form.serial_number} onChange={e => setForm(f => ({...f, serial_number: e.target.value}))} placeholder="예: YT5101-2023001" /></div>
          <div>
            <Label>구분 *</Label>
            <Select value={form.machine_type} onValueChange={v => setForm(f => ({...f, machine_type: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="새기계">새기계</SelectItem><SelectItem value="중고기계">중고기계</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>입고일 *</Label><Input type="date" value={form.entry_date} onChange={e => setForm(f => ({...f, entry_date: e.target.value}))} /></div>
          <div><Label>매입가 (원) *</Label><Input type="number" value={form.purchase_price} onChange={e => setForm(f => ({...f, purchase_price: e.target.value}))} placeholder="45000000" /></div>
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

type BulkMachineRow = {
  model_name: string;
  serial_number: string;
  machine_type: string;
  entry_date: string;
  purchase_price: string;
  notes: string;
};

const emptyMachineRow = (): BulkMachineRow => ({
  model_name: "", serial_number: "", machine_type: "새기계", entry_date: "", purchase_price: "", notes: "",
});

function BulkMachineDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<BulkMachineRow[]>([emptyMachineRow(), emptyMachineRow(), emptyMachineRow()]);

  const updateRow = (i: number, field: keyof BulkMachineRow, value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const addRow = () => setRows((prev) => [...prev, emptyMachineRow()]);

  const validRows = rows.filter((r) => r.model_name && r.serial_number && r.entry_date && r.purchase_price);

  const mutation = useMutation({
    mutationFn: async () => {
      const inserts = validRows.map((r) => ({
        model_name: r.model_name,
        serial_number: r.serial_number,
        machine_type: r.machine_type,
        entry_date: r.entry_date,
        purchase_price: parseInt(r.purchase_price),
        notes: r.notes || null,
      }));
      const { error } = await supabase.from("machines").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast({ title: `${validRows.length}대의 기계가 일괄 등록되었습니다.` });
      onOpenChange(false);
      setRows([emptyMachineRow(), emptyMachineRow(), emptyMachineRow()]);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>기계 일괄 등록</DialogTitle>
          <p className="text-sm text-muted-foreground">여러 기계를 한 번에 등록할 수 있습니다. 필수 항목(*)을 모두 입력해 주세요.</p>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_100px_120px_130px_auto] gap-2 items-end">
                {i === 0 && (
                  <>
                    <Label className="text-xs col-span-1">모델명 *</Label>
                    <Label className="text-xs col-span-1">제조번호 *</Label>
                    <Label className="text-xs col-span-1">구분 *</Label>
                    <Label className="text-xs col-span-1">입고일 *</Label>
                    <Label className="text-xs col-span-1">매입가 *</Label>
                    <div />
                  </>
                )}
                <Input value={row.model_name} onChange={(e) => updateRow(i, "model_name", e.target.value)} placeholder="모델명" className="h-9 text-sm" />
                <Input value={row.serial_number} onChange={(e) => updateRow(i, "serial_number", e.target.value)} placeholder="제조번호" className="h-9 text-sm" />
                <Select value={row.machine_type} onValueChange={(v) => updateRow(i, "machine_type", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="새기계">새기계</SelectItem>
                    <SelectItem value="중고기계">중고</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={row.entry_date} onChange={(e) => updateRow(i, "entry_date", e.target.value)} className="h-9 text-sm" />
                <Input type="number" value={row.purchase_price} onChange={(e) => updateRow(i, "purchase_price", e.target.value)} placeholder="매입가" className="h-9 text-sm" />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeRow(i)} disabled={rows.length <= 1}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="mt-3" onClick={addRow}>
            <Plus className="h-3.5 w-3.5 mr-1" /> 행 추가
          </Button>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <span className="text-sm text-muted-foreground mr-auto">유효한 행: {validRows.length} / {rows.length}</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={validRows.length === 0 || mutation.isPending}>
            {mutation.isPending ? "등록 중..." : `${validRows.length}대 일괄 등록`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
