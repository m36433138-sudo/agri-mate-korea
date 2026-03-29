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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Search, FileSpreadsheet, Download, ArrowUpDown, History, RefreshCw, CloudDownload } from "lucide-react";
import * as XLSX from "xlsx";

type InventoryItem = {
  id: string;
  branch: string;
  part_code: string;
  part_name: string;
  quantity: number | null;
  purchase_price: number | null;
  sales_price: number | null;
  location_main: string | null;
  location_sub: string | null;
  min_stock: number | null;
};

type AdjustmentLog = {
  id: string;
  branch: string;
  part_code: string;
  part_name: string;
  previous_qty: number;
  new_qty: number;
  adjustment_qty: number;
  reason: string | null;
  adjusted_by: string | null;
  created_at: string;
};

export default function StockAdjustment() {
  const [branch, setBranch] = useState<"장흥" | "강진">("장흥");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [singleItem, setSingleItem] = useState<InventoryItem | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  useRealtimeSync("inventory", [["inventory"]]);

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["inventory", branch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("branch", branch)
        .order("part_code")
        .limit(10000);
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["inventory_adjustments", branch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_adjustments")
        .select("*")
        .eq("branch", branch)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AdjustmentLog[];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-sheets", {
        body: { action: "syncInventory", branch },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: `구글시트 동기화 완료`, description: `${data.synced}개 품목 동기화됨` });
    },
    onError: (e: any) => toast({ title: "동기화 오류", description: e.message, variant: "destructive" }),
  });

  const { search, setSearch, filtered } = useListFilter<InventoryItem>({
    data: inventory,
    searchFields: ["part_code", "part_name"],
  });

  return (
    <div className="space-y-4">
      {/* Branch + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant={branch === "장흥" ? "default" : "outline"} size="sm" onClick={() => setBranch("장흥")}>장흥</Button>
          <Button variant={branch === "강진" ? "default" : "outline"} size="sm" onClick={() => setBranch("강진")}>강진</Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <CloudDownload className="h-4 w-4 mr-1" />
            {syncMutation.isPending ? "동기화 중..." : "구글시트 동기화"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> 엑셀 일괄조정
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="부품코드 또는 부품명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Inventory table for adjustment */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
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
                  <th className="text-right p-3 font-medium text-muted-foreground">현재수량</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">위치</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs">{item.part_code}</td>
                    <td className="p-3 font-medium">{item.part_name}</td>
                    <td className="p-3 text-right font-medium">{item.quantity ?? 0}</td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                      {[item.location_main, item.location_sub].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="p-3">
                      <Button variant="outline" size="sm" onClick={() => { setSingleItem(item); setAdjustOpen(true); }}>
                        <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> 조정
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Adjustment history */}
      <div className="mt-6">
        <h3 className="text-base font-semibold flex items-center gap-2 mb-3">
          <History className="h-4 w-4" /> 재고조정 이력
        </h3>
        {logsLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !logs?.length ? (
          <Card className="shadow-card border-0">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              재고조정 이력이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card border-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">일시</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">부품코드</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">부품명</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">이전</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">변동</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">이후</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">사유</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">조정자</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="p-3 font-mono text-xs">{log.part_code}</td>
                      <td className="p-3">{log.part_name}</td>
                      <td className="p-3 text-right">{log.previous_qty}</td>
                      <td className="p-3 text-right">
                        <Badge variant={log.adjustment_qty > 0 ? "default" : "destructive"} className="text-xs">
                          {log.adjustment_qty > 0 ? `+${log.adjustment_qty}` : log.adjustment_qty}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-medium">{log.new_qty}</td>
                      <td className="p-3 text-xs text-muted-foreground hidden sm:table-cell">{log.reason || "-"}</td>
                      <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{log.adjusted_by || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Single adjustment dialog */}
      {singleItem && (
        <SingleAdjustDialog
          item={singleItem}
          open={adjustOpen}
          onOpenChange={(v) => { setAdjustOpen(v); if (!v) setSingleItem(null); }}
          branch={branch}
        />
      )}

      {/* Bulk adjustment dialog */}
      <BulkAdjustDialog open={bulkOpen} onOpenChange={setBulkOpen} branch={branch} />
    </div>
  );
}

function SingleAdjustDialog({ item, open, onOpenChange, branch }: {
  item: InventoryItem; open: boolean; onOpenChange: (v: boolean) => void; branch: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newQty, setNewQty] = useState(String(item.quantity ?? 0));
  const [reason, setReason] = useState("");

  const prevQty = item.quantity ?? 0;
  const diff = (parseInt(newQty) || 0) - prevQty;

  const mutation = useMutation({
    mutationFn: async () => {
      const qty = parseInt(newQty) || 0;
      // Update inventory
      const { error: updErr } = await supabase.from("inventory").update({ quantity: qty }).eq("id", item.id);
      if (updErr) throw updErr;
      // Log adjustment
      const { error: logErr } = await supabase.from("inventory_adjustments").insert({
        branch,
        part_code: item.part_code,
        part_name: item.part_name,
        previous_qty: prevQty,
        new_qty: qty,
        adjustment_qty: qty - prevQty,
        reason: reason || null,
        adjusted_by: null,
      });
      if (logErr) throw logErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory_adjustments"] });
      toast({ title: "재고가 조정되었습니다." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>재고 조정</DialogTitle>
          <p className="text-sm text-muted-foreground font-mono">{item.part_code} — {item.part_name}</p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label>현재수량</Label>
              <Input value={prevQty} disabled />
            </div>
            <div className="flex-1">
              <Label>변경수량</Label>
              <Input type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
            </div>
          </div>
          {diff !== 0 && (
            <p className="text-sm">
              변동: <Badge variant={diff > 0 ? "default" : "destructive"}>{diff > 0 ? `+${diff}` : diff}</Badge>
            </p>
          )}
          <div>
            <Label>조정 사유</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="재고실사, 파손 등" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={diff === 0 || mutation.isPending}>
            {mutation.isPending ? "조정 중..." : "조정 확인"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkAdjustDialog({ open, onOpenChange, branch }: {
  open: boolean; onOpenChange: (v: boolean) => void; branch: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<any[]>([]);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [reason, setReason] = useState("엑셀 일괄조정");

  const warehouseCode = branch === "장흥" ? "00" : "01";

  const downloadTemplate = () => {
    // Match the uploaded file format exactly
    const ws = XLSX.utils.aoa_to_sheet([
      ["Upload File for Parts Inventory - Plural Parts Adjustment"],
      [],
      ["", "Max 3000 Items"],
      ["No.", "Warehouse Code", "Parts No.", "Parts Name", "Parts Name (Local)", "Dealer/Dist Parts No.",
       "Goods Name", "Goods Name (Local)", "Unit Price", "Price Change", "Wage",
       "Stock Qty", "Location (main)", "Location (sub）", "Vendor Code", "Vendor Name (ENG)",
       "Vendor Name (local)", "Latest In-WH (Received) Date", "Latest Shipped (Sales) date"],
      [1, warehouseCode, "", "", "", "", "", "", 0, "", 0, 0, "", "", "", "", "", 0, 0],
    ]);

    // Merge title row
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 18 } }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "재고조정");
    XLSX.writeFile(wb, `재고조정_템플릿_${branch}(${warehouseCode}).xlsx`);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { header: 1 }) as any[][];

        // Find header row (contains "Parts No." or "Warehouse Code")
        let headerIdx = -1;
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          const row = json[i] || [];
          if (row.some((c: any) => String(c).includes("Parts No") || String(c).includes("Warehouse"))) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) headerIdx = 2; // fallback: row 3 (index 2) based on template

        const dataRows = json.slice(headerIdx + 1).filter((r) => {
          // Required: B (Warehouse Code), C (Parts No.), L (Stock Qty), M (Location main)
          const partCode = String(r[2] || "").trim();
          return partCode.length > 0;
        });

        const mapped = dataRows.map((r) => ({
          warehouse_code: String(r[1] || warehouseCode).trim(),
          part_code: String(r[2] || "").trim(),
          part_name: String(r[3] || r[4] || "").trim(),
          quantity: parseInt(String(r[11] || "0")) || 0,
          location_main: String(r[12] || "").trim() || null,
          location_sub: String(r[13] || "").trim() || null,
          purchase_price: parseInt(String(r[8] || "")) || null,
          sales_price: parseInt(String(r[10] || "")) || null,
        }));

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

  const validRows = rows.filter((r) => r.part_code);

  const mutation = useMutation({
    mutationFn: async () => {
      // Get current inventory for comparison
      const { data: currentInv } = await supabase
        .from("inventory")
        .select("part_code, quantity")
        .eq("branch", branch);

      const currentMap = new Map<string, number>();
      (currentInv || []).forEach((i: any) => currentMap.set(i.part_code, i.quantity ?? 0));

      // Upsert inventory
      const inserts = validRows.map((r) => ({
        branch,
        part_code: r.part_code,
        part_name: r.part_name,
        quantity: r.quantity,
        location_main: r.location_main,
        location_sub: r.location_sub,
        purchase_price: r.purchase_price,
        sales_price: r.sales_price,
      }));

      const { error } = await supabase.from("inventory").upsert(inserts, { onConflict: "branch,part_code" });
      if (error) throw error;

      // Log adjustments
      const adjustments = validRows.map((r) => {
        const prev = currentMap.get(r.part_code) ?? 0;
        return {
          branch,
          part_code: r.part_code,
          part_name: r.part_name,
          previous_qty: prev,
          new_qty: r.quantity,
          adjustment_qty: r.quantity - prev,
          reason: reason || "엑셀 일괄조정",
          adjusted_by: null,
        };
      }).filter((a) => a.adjustment_qty !== 0);

      if (adjustments.length > 0) {
        const { error: logErr } = await supabase.from("inventory_adjustments").insert(adjustments);
        if (logErr) console.error("Adjustment log error:", logErr);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory_adjustments"] });
      toast({ title: `${validRows.length}건 재고조정 완료` });
      handleClose();
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const handleClose = () => { onOpenChange(false); setRows([]); setStep("upload"); setReason("엑셀 일괄조정"); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>엑셀 일괄 재고조정 ({branch} - 창고코드: {warehouseCode})</DialogTitle>
          <p className="text-sm text-muted-foreground">필수 입력: B(창고코드), C(부품번호), L(수량), M(위치)</p>
        </DialogHeader>
        {step === "upload" ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" /> 조정 템플릿 다운로드
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              창고코드: 장흥(00), 강진(01)<br />
              필수 열: B(Warehouse Code), C(Parts No.), L(Stock Qty), M(Location main)
            </p>
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
            <div className="mb-2">
              <Label>조정 사유</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="재고실사 등" />
            </div>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-2 font-medium text-muted-foreground">창고</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">부품코드</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">부품명</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">수량</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">위치(메인)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-b ${!r.part_code ? "bg-destructive/10" : ""}`}>
                      <td className="p-2 text-xs">{r.warehouse_code}</td>
                      <td className="p-2 font-mono text-xs">{r.part_code || <span className="text-destructive">누락</span>}</td>
                      <td className="p-2">{r.part_name || "-"}</td>
                      <td className="p-2 text-right">{r.quantity}</td>
                      <td className="p-2 text-xs">{r.location_main || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
              <span className="text-sm text-muted-foreground mr-auto">유효: {validRows.length} / {rows.length}건</span>
              <Button variant="outline" onClick={() => setStep("upload")}>다시 선택</Button>
              <Button onClick={() => mutation.mutate()} disabled={validRows.length === 0 || mutation.isPending}>
                {mutation.isPending ? "조정 중..." : `${validRows.length}건 조정`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
