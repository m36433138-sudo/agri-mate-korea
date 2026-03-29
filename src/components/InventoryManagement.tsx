import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useListFilter } from "@/hooks/useListFilter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, FileSpreadsheet, Trash2, Download, Pencil, Package, MapPin, AlertTriangle, CloudDownload } from "lucide-react";
import * as XLSX from "xlsx";

type InventoryItem = {
  id: string;
  branch: string;
  part_code: string;
  part_name: string;
  alt_part_code: string | null;
  quantity: number | null;
  purchase_price: number | null;
  sales_price: number | null;
  location_main: string | null;
  location_sub: string | null;
  min_stock: number | null;
};

export default function InventoryManagement() {
  const [branch, setBranch] = useState<"장흥" | "강진">("장흥");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  useRealtimeSync("inventory", [["inventory"]]);

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["inventory", branch],
    queryFn: async () => {
      const allRows: InventoryItem[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("inventory")
          .select("*")
          .eq("branch", branch)
          .order("part_code")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allRows.push(...(data as InventoryItem[]));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      return allRows;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "재고가 삭제되었습니다." });
      setDeleteId(null);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const { search, setSearch, filtered } = useListFilter<InventoryItem>({
    data: inventory,
    searchFields: ["part_code", "part_name"],
  });

  const totalItems = inventory?.length ?? 0;
  const totalQty = inventory?.reduce((s, i) => s + (i.quantity ?? 0), 0) ?? 0;

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["부품코드", "부품명", "수량", "매입가", "매출가", "위치(메인)", "위치(서브)"],
      ["22217-160000", "엔진오일 필터", 10, 8500, 12000, "부품창고", "A-1-3"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "재고");
    XLSX.writeFile(wb, `재고_템플릿_${branch}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Branch toggle + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={branch === "장흥" ? "default" : "outline"}
            size="sm"
            onClick={() => setBranch("장흥")}
          >
            장흥
          </Button>
          <Button
            variant={branch === "강진" ? "default" : "outline"}
            size="sm"
            onClick={() => setBranch("강진")}
          >
            강진
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              const { data, error } = await supabase.functions.invoke("google-sheets", {
                body: { action: "syncInventory", branch },
              });
              if (error) throw new Error(error.message);
              if (data?.error) throw new Error(data.error);
              qc.invalidateQueries({ queryKey: ["inventory"] });
              toast({ title: `${branch} 재고 동기화 완료`, description: `${data?.synced ?? 0}건 동기화됨` });
            } catch (e: any) {
              toast({ title: "동기화 실패", description: e.message, variant: "destructive" });
            }
          }}>
            <CloudDownload className="h-4 w-4 mr-1" /> 시트 동기화
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> 엑셀 등록
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 재고 등록
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-card border-0">
          <CardContent className="p-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">품목 수</p>
              <p className="text-lg font-bold">{totalItems}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card border-0">
          <CardContent className="p-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">총 수량</p>
              <p className="text-lg font-bold">{totalQty}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="부품코드 또는 부품명 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered?.length === 0 ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center text-muted-foreground">
            {branch} 지점에 등록된 재고가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card border-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">부품코드</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">부품명</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">설계변경코드</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">수량</th>
                  <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">적정재고</th>
                  <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">매출가</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">위치</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((item) => {
                  const isLow = (item.quantity ?? 0) <= (item.min_stock ?? 1);
                  return (
                  <tr
                    key={item.id}
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                      isLow ? "bg-destructive/5" : ""
                    }`}
                  >
                    <td className="p-3 font-mono text-xs">{item.part_code}</td>
                    <td className="p-3 font-medium">{item.part_name}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground hidden lg:table-cell">{item.alt_part_code || "-"}</td>
                    <td className="p-3 text-right">
                      {isLow ? (
                        <Badge variant="destructive" className="text-xs">{item.quantity ?? 0}</Badge>
                      ) : (
                        <span className="font-medium">{item.quantity ?? 0}</span>
                      )}
                    </td>
                    <td className="p-3 text-right text-muted-foreground hidden sm:table-cell">
                      {item.min_stock ?? 1}
                    </td>
                    <td className="p-3 text-right text-muted-foreground hidden sm:table-cell">
                      {item.sales_price?.toLocaleString() ?? "-"}
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                      {[item.location_main, item.location_sub].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditItem(item)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(item.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AddInventoryDialog open={addOpen} onOpenChange={setAddOpen} branch={branch} />
      {editItem && (
        <EditInventoryDialog item={editItem} onOpenChange={(v) => !v && setEditItem(null)} />
      )}
      <BulkInventoryDialog open={bulkOpen} onOpenChange={setBulkOpen} branch={branch} onDownloadTemplate={downloadTemplate} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>재고 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 재고 항목을 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddInventoryDialog({ open, onOpenChange, branch }: { open: boolean; onOpenChange: (v: boolean) => void; branch: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    part_code: "", part_name: "", quantity: "0", min_stock: "1",
    purchase_price: "", sales_price: "", location_main: "", location_sub: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inventory").insert({
        branch,
        part_code: form.part_code,
        part_name: form.part_name,
        quantity: parseInt(form.quantity) || 0,
        min_stock: parseInt(form.min_stock) || 1,
        purchase_price: form.purchase_price ? parseInt(form.purchase_price) : null,
        sales_price: form.sales_price ? parseInt(form.sales_price) : null,
        location_main: form.location_main || null,
        location_sub: form.location_sub || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "재고가 등록되었습니다." });
      onOpenChange(false);
      setForm({ part_code: "", part_name: "", quantity: "0", min_stock: "1", purchase_price: "", sales_price: "", location_main: "", location_sub: "" });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>재고 등록 ({branch})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>부품코드 *</Label>
            <Input value={form.part_code} onChange={(e) => setForm((f) => ({ ...f, part_code: e.target.value }))} placeholder="22217-160000" />
          </div>
          <div>
            <Label>부품명 *</Label>
            <Input value={form.part_name} onChange={(e) => setForm((f) => ({ ...f, part_name: e.target.value }))} placeholder="엔진오일 필터" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>수량</Label>
              <Input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div>
              <Label>적정재고량</Label>
              <Input type="number" value={form.min_stock} onChange={(e) => setForm((f) => ({ ...f, min_stock: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>매입가</Label>
              <Input type="number" value={form.purchase_price} onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))} />
            </div>
            <div>
              <Label>매출가</Label>
              <Input type="number" value={form.sales_price} onChange={(e) => setForm((f) => ({ ...f, sales_price: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>위치(메인)</Label>
              <Input value={form.location_main} onChange={(e) => setForm((f) => ({ ...f, location_main: e.target.value }))} placeholder="부품창고" />
            </div>
            <div>
              <Label>위치(서브)</Label>
              <Input value={form.location_sub} onChange={(e) => setForm((f) => ({ ...f, location_sub: e.target.value }))} placeholder="A-1-3" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!(form.part_code && form.part_name) || mutation.isPending}>
            {mutation.isPending ? "등록 중..." : "등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditInventoryDialog({ item, onOpenChange }: { item: InventoryItem; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    quantity: String(item.quantity ?? 0),
    min_stock: String(item.min_stock ?? 1),
    purchase_price: String(item.purchase_price ?? ""),
    sales_price: String(item.sales_price ?? ""),
    location_main: item.location_main ?? "",
    location_sub: item.location_sub ?? "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inventory").update({
        quantity: parseInt(form.quantity) || 0,
        min_stock: parseInt(form.min_stock) || 1,
        purchase_price: form.purchase_price ? parseInt(form.purchase_price) : null,
        sales_price: form.sales_price ? parseInt(form.sales_price) : null,
        location_main: form.location_main || null,
        location_sub: form.location_sub || null,
      }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "재고가 수정되었습니다." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>재고 수정</DialogTitle>
          <p className="text-sm text-muted-foreground font-mono">{item.part_code} — {item.part_name}</p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>수량</Label>
              <Input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div>
              <Label>적정재고량</Label>
              <Input type="number" value={form.min_stock} onChange={(e) => setForm((f) => ({ ...f, min_stock: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>매입가</Label>
              <Input type="number" value={form.purchase_price} onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))} />
            </div>
            <div>
              <Label>매출가</Label>
              <Input type="number" value={form.sales_price} onChange={(e) => setForm((f) => ({ ...f, sales_price: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>위치(메인)</Label>
              <Input value={form.location_main} onChange={(e) => setForm((f) => ({ ...f, location_main: e.target.value }))} />
            </div>
            <div>
              <Label>위치(서브)</Label>
              <Input value={form.location_sub} onChange={(e) => setForm((f) => ({ ...f, location_sub: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "수정 중..." : "수정"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkInventoryDialog({
  open, onOpenChange, branch, onDownloadTemplate,
}: { open: boolean; onOpenChange: (v: boolean) => void; branch: string; onDownloadTemplate: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<any[]>([]);
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        const mapped = json.map((row) => {
          const raw = Object.values(row);
          return {
            part_code: String(raw[0] || ""),
            part_name: String(raw[1] || ""),
            quantity: parseInt(String(raw[2] || "0")) || 0,
            purchase_price: parseInt(String(raw[3] || "")) || null,
            sales_price: parseInt(String(raw[4] || "")) || null,
            location_main: String(raw[5] || "") || null,
            location_sub: String(raw[6] || "") || null,
          };
        });
        setRows(mapped);
        setStep("preview");
        toast({ title: `${mapped.length}건을 불러왔습니다.` });
      } catch {
        toast({ title: "엑셀 파일을 읽을 수 없습니다.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const validRows = rows.filter((r) => r.part_code && r.part_name);

  const mutation = useMutation({
    mutationFn: async () => {
      const inserts = validRows.map((r) => ({ branch, ...r }));
      const { error } = await supabase.from("inventory").upsert(inserts, { onConflict: "branch,part_code" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: `${validRows.length}건 등록 완료` });
      onOpenChange(false);
      setRows([]);
      setStep("upload");
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const handleClose = () => { onOpenChange(false); setRows([]); setStep("upload"); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>재고 엑셀 일괄등록 ({branch})</DialogTitle>
          <p className="text-sm text-muted-foreground">동일한 부품코드는 자동으로 업데이트됩니다.</p>
        </DialogHeader>
        {step === "upload" ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Button variant="outline" onClick={onDownloadTemplate}>
              <Download className="h-4 w-4 mr-1" /> 엑셀 템플릿 다운로드
            </Button>
            <p className="text-xs text-muted-foreground">열 순서: 부품코드, 부품명, 수량, 매입가, 매출가, 위치(메인), 위치(서브)</p>
            <label className="cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">엑셀 파일 선택</p>
                <p className="text-xs text-muted-foreground">.xlsx, .xls, .csv</p>
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelUpload} />
            </label>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-2 font-medium text-muted-foreground">부품코드</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">부품명</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">수량</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">매입가</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">매출가</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-b ${!r.part_code || !r.part_name ? "bg-destructive/10" : ""}`}>
                      <td className="p-2 font-mono text-xs">{r.part_code || <span className="text-destructive">누락</span>}</td>
                      <td className="p-2">{r.part_name || <span className="text-destructive">누락</span>}</td>
                      <td className="p-2 text-right">{r.quantity}</td>
                      <td className="p-2 text-right">{r.purchase_price?.toLocaleString() ?? "-"}</td>
                      <td className="p-2 text-right">{r.sales_price?.toLocaleString() ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
              <span className="text-sm text-muted-foreground mr-auto">유효: {validRows.length} / {rows.length}건</span>
              <Button variant="outline" onClick={() => setStep("upload")}>다시 선택</Button>
              <Button onClick={() => mutation.mutate()} disabled={validRows.length === 0 || mutation.isPending}>
                {mutation.isPending ? "등록 중..." : `${validRows.length}건 등록`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
