import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Upload, Trash2, FileSpreadsheet, CloudDownload, Loader2, Users, UserMinus } from "lucide-react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import ExcelTable, { type ExcelColumn } from "@/components/ExcelTable";
import { useServerTable } from "@/hooks/useServerTable";
import type { Customer } from "@/types/database";

export default function CustomersList() {
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [cleanupConfirm, setCleanupConfirm] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  useRealtimeSync("customers", [["customers"]]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "고객이 삭제되었습니다." });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  // 불완전 고객 정리: 주소 없음 + 보유기계 0대 + 드라이브 링크 없음
  const handleCleanup = async () => {
    setCleaning(true);
    try {
      // 1) 주소가 없는 고객 후보 (페이지네이션)
      const candidates: Customer[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("customers")
          .select("id, name, address")
          .or("address.is.null,address.eq.")
          .range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        candidates.push(...(data as Customer[]));
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }

      const { data: machineRows, error: me } = await supabase
        .from("machines").select("customer_id").not("customer_id", "is", null);
      if (me) throw new Error(me.message);
      const ownedIds = new Set((machineRows ?? []).map((r: any) => r.customer_id));

      const { data: linkRows, error: le } = await supabase
        .from("customer_drive_links").select("customer_id");
      if (le) throw new Error(le.message);
      const linkedIds = new Set((linkRows ?? []).map((r: any) => r.customer_id));

      const incomplete = candidates.filter(c => !ownedIds.has(c.id) && !linkedIds.has(c.id));

      if (incomplete.length === 0) {
        toast({ title: "삭제할 고객이 없습니다.", description: "모든 고객이 유효합니다." });
        setCleanupConfirm(false);
        return;
      }

      let deleted = 0;
      for (const c of incomplete) {
        const { error } = await supabase.from("customers").delete().eq("id", c.id);
        if (!error) deleted++;
      }

      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: `${deleted}명의 불완전 고객이 삭제되었습니다.` });
    } catch (e: any) {
      toast({ title: "정리 실패", description: e.message, variant: "destructive" });
    } finally {
      setCleaning(false);
      setCleanupConfirm(false);
    }
  };

  const server = useServerTable<Customer>({
    table: "customers",
    select: "*",
    searchColumn: "search_vec",
    defaultSort: { column: "name", ascending: true },
    queryKey: ["customers"],
    columnSpecs: {
      name: { id: "name", dbColumn: "name", filterType: "text" },
      grade: { id: "grade", dbColumn: "grade", filterType: "select" },
      phone: { id: "phone", dbColumn: "phone", filterType: "text" },
      address: { id: "address", dbColumn: "address", filterType: "text" },
      branch: { id: "branch", dbColumn: "branch", filterType: "select" },
      notes: { id: "notes", dbColumn: "notes", filterType: "text" },
    },
  });

  const externalSelectOptions = useMemo(() => ({
    grade: ["VVIP", "VIP", "GOLD", "SILVER"],
    branch: ["장흥", "강진"],
  }), []);

  const handleSheetImport = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-sheets", {
        body: { action: "importCustomersAndMachines" },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast({
        title: "구글시트 가져오기 완료",
        description: `고객 ${data.customers.inserted}명 추가, 기계 ${data.machines.inserted}대 추가`,
      });
    } catch (e: any) {
      toast({ title: "가져오기 실패", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const columns = useMemo<ExcelColumn<Customer>[]>(() => [
    { accessorKey: "name", header: "고객명", size: 160, sticky: true,
      enableColumnFilter: true, filterType: "text",
      cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span> },
    { accessorKey: "grade", header: "등급", size: 110,
      enableColumnFilter: true, filterType: "select",
      filterOptions: ["VVIP", "VIP", "GOLD", "SILVER"],
      cell: ({ getValue }) => getValue() ? <CustomerGradeBadge grade={getValue() as string} /> : <span className="text-muted-foreground">-</span> },
    { accessorKey: "phone", header: "연락처", size: 150,
      enableColumnFilter: true, filterType: "text",
      cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{(getValue() as string) || "-"}</span> },
    { accessorKey: "address", header: "주소", size: 320,
      enableColumnFilter: true, filterType: "text",
      cell: ({ getValue }) => <span className="text-muted-foreground truncate">{(getValue() as string) || "-"}</span> },
    { accessorKey: "branch", header: "지점", size: 110,
      enableColumnFilter: true, filterType: "select",
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "-"}</span> },
    { accessorKey: "notes", header: "비고", size: 220,
      enableColumnFilter: true, filterType: "text",
      cell: ({ getValue }) => <span className="text-muted-foreground truncate">{(getValue() as string) || "-"}</span> },
    { id: "_actions", header: "", size: 56, disableSort: true,
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original as Customer); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) },
  ], []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold">
            {server.isLoading ? "..." : `전체 ${server.total.toLocaleString()}명`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleSheetImport} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CloudDownload className="h-4 w-4 mr-1" />}
            {importing ? "가져오는 중..." : "시트 가져오기"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> 일괄 등록
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCleanupConfirm(true)} disabled={cleaning}>
            <UserMinus className="h-4 w-4 mr-1" /> 불완전 고객 정리
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 고객 등록
          </Button>
        </div>
      </div>

      <ExcelTable
        data={server.rows}
        columns={columns}
        searchPlaceholder="이름·연락처·주소·비고 전체검색..."
        exportFileName="고객목록"
        emptyMessage="등록된 고객이 없습니다."
        onRowClick={(c) => navigate(`/customers/${(c as any).id}`)}
        serverMode
        totalCount={server.total}
        isLoading={server.isLoading}
        sorting={server.state.sorting}
        onSortingChange={server.setSorting}
        columnFilters={server.state.columnFilters}
        onColumnFiltersChange={server.setColumnFilters}
        globalFilter={server.state.globalFilter}
        onGlobalFilterChange={server.setGlobalFilter}
        pageIndex={server.state.pageIndex}
        pageSize={server.state.pageSize}
        onPageChange={server.setPageIndex}
        onPageSizeChange={server.setPageSize}
        externalSelectOptions={externalSelectOptions}
      />

      <AddCustomerDialog open={open} onOpenChange={setOpen} />
      <BulkCustomerDialog open={bulkOpen} onOpenChange={setBulkOpen} />

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>고객을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name}님의 정보가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 불완전 고객 일괄 정리 확인 */}
      <AlertDialog open={cleanupConfirm} onOpenChange={v => { if (!v) setCleanupConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>불완전 고객을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              전화번호와 주소가 모두 불완전하고 보유 기계가 없는 고객을 모두 삭제합니다.
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleaning}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanup}
              disabled={cleaning}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cleaning ? "정리 중..." : "정리하기"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const GRADE_CONFIG: Record<string, { label: string; style: string }> = {
  VVIP:   { label: "VVIP",   style: "bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-sm shadow-violet-200" },
  VIP:    { label: "VIP",    style: "bg-gradient-to-r from-amber-500 to-orange-400 text-white shadow-sm shadow-amber-200" },
  GOLD:   { label: "GOLD",   style: "bg-gradient-to-r from-yellow-400 to-amber-400 text-white shadow-sm shadow-yellow-200" },
  SILVER: { label: "SILVER", style: "bg-gradient-to-r from-slate-400 to-gray-400 text-white shadow-sm shadow-slate-200" },
};

export function CustomerGradeBadge({ grade }: { grade: string }) {
  const cfg = GRADE_CONFIG[grade];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${cfg.style}`}>
      {cfg.label}
    </span>
  );
}

function AddCustomerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").insert({
        name: form.name,
        phone: form.phone,
        address: form.address || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "고객이 등록되었습니다." });
      onOpenChange(false);
      setForm({ name: "", phone: "", address: "", notes: "" });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>고객 등록</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>고객명 *</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} /></div>
          <div><Label>연락처 *</Label><Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="010-0000-0000" /></div>
          <div><Label>주소</Label><Input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} /></div>
          <div><Label>비고</Label><Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!(form.name && form.phone) || mutation.isPending}>{mutation.isPending ? "등록 중..." : "등록"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BulkCustomerRow = { name: string; phone: string; address: string; notes: string };
const emptyCustomerRow = (): BulkCustomerRow => ({ name: "", phone: "", address: "", notes: "" });

function BulkCustomerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<BulkCustomerRow[]>([emptyCustomerRow(), emptyCustomerRow(), emptyCustomerRow()]);

  const updateRow = (i: number, field: keyof BulkCustomerRow, value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const addRow = () => setRows((prev) => [...prev, emptyCustomerRow()]);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        const mapped: BulkCustomerRow[] = json.map((row) => {
          const raw = Object.values(row);
          return {
            name: String(raw[0] || ""),
            phone: String(raw[1] || ""),
            address: String(raw[2] || ""),
            notes: String(raw[3] || ""),
          };
        });
        setRows((prev) => [...prev.filter(r => r.name || r.phone), ...mapped]);
        toast({ title: `엑셀에서 ${mapped.length}행을 불러왔습니다.` });
      } catch {
        toast({ title: "엑셀 파일을 읽을 수 없습니다.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const validRows = rows.filter((r) => r.name && r.phone);

  const mutation = useMutation({
    mutationFn: async () => {
      const inserts = validRows.map((r) => ({
        name: r.name,
        phone: r.phone,
        address: r.address || null,
        notes: r.notes || null,
      }));
      const { error } = await supabase.from("customers").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: `${validRows.length}명의 고객이 일괄 등록되었습니다.` });
      onOpenChange(false);
      setRows([emptyCustomerRow(), emptyCustomerRow(), emptyCustomerRow()]);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>고객 일괄 등록</DialogTitle>
          <p className="text-sm text-muted-foreground">여러 고객을 한 번에 등록할 수 있습니다. 엑셀 파일을 업로드하거나 직접 입력하세요.</p>
          <p className="text-xs text-muted-foreground">엑셀 열 순서: 고객명, 연락처, 주소, 비고</p>
        </DialogHeader>

        <div>
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm font-medium text-primary hover:underline">
            <FileSpreadsheet className="h-4 w-4" />
            엑셀 파일 불러오기
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelUpload} />
          </label>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                {i === 0 && (
                  <>
                    <Label className="text-xs">고객명 *</Label>
                    <Label className="text-xs">연락처 *</Label>
                    <Label className="text-xs">주소</Label>
                    <div />
                  </>
                )}
                <Input value={row.name} onChange={(e) => updateRow(i, "name", e.target.value)} placeholder="고객명" className="h-9 text-sm" />
                <Input value={row.phone} onChange={(e) => updateRow(i, "phone", e.target.value)} placeholder="010-0000-0000" className="h-9 text-sm" />
                <Input value={row.address} onChange={(e) => updateRow(i, "address", e.target.value)} placeholder="주소 (선택)" className="h-9 text-sm" />
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
            {mutation.isPending ? "등록 중..." : `${validRows.length}명 일괄 등록`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
