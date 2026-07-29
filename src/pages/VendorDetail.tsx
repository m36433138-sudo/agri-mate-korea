import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Pencil, Package, FileSpreadsheet, Download, Truck } from "lucide-react";
import * as XLSX from "xlsx";

const BRANCHES = ["장흥", "강진"] as const;

interface VendorItem {
  id: string; vendor_id: string; part_code: string | null; part_name: string;
  purchase_price: number; sales_price: number | null; unit: string | null; notes: string | null;
}
interface Purchase {
  id: string; purchase_date: string; branch: string; part_code: string | null; part_name: string;
  quantity: number; purchase_price: number; sales_price: number | null; notes: string | null;
}

const won = (n: number | null | undefined) => (n == null ? "-" : `${n.toLocaleString()}원`);

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState<Partial<VendorItem>>({});
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [pForm, setPForm] = useState<Partial<Purchase>>({});

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("vendors").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["vendor_items", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vendor_items").select("*").eq("vendor_id", id).order("part_name");
      if (error) throw error;
      return data as VendorItem[];
    },
    enabled: !!id,
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["vendor_purchases", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vendor_purchases").select("*").eq("vendor_id", id).order("purchase_date", { ascending: false });
      if (error) throw error;
      return data as Purchase[];
    },
    enabled: !!id,
  });

  const saveItem = useMutation({
    mutationFn: async () => {
      const payload = {
        vendor_id: id,
        part_code: itemForm.part_code || null,
        part_name: itemForm.part_name,
        purchase_price: Number(itemForm.purchase_price) || 0,
        sales_price: itemForm.sales_price == null || itemForm.sales_price === ("" as any) ? null : Number(itemForm.sales_price),
        unit: itemForm.unit || null,
        notes: itemForm.notes || null,
      };
      const { error } = itemForm.id
        ? await (supabase as any).from("vendor_items").update(payload).eq("id", itemForm.id)
        : await (supabase as any).from("vendor_items").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor_items", id] });
      setItemOpen(false); setItemForm({});
      toast({ title: "저장되었습니다." });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await (supabase as any).from("vendor_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor_items", id] }),
  });

  const savePurchase = useMutation({
    mutationFn: async () => {
      const payload = {
        vendor_id: id,
        purchase_date: pForm.purchase_date || new Date().toISOString().slice(0, 10),
        branch: pForm.branch || "장흥",
        part_code: pForm.part_code || null,
        part_name: pForm.part_name,
        quantity: Number(pForm.quantity) || 0,
        purchase_price: Number(pForm.purchase_price) || 0,
        sales_price: pForm.sales_price == null || pForm.sales_price === ("" as any) ? null : Number(pForm.sales_price),
        notes: pForm.notes || null,
      };
      if (!payload.part_name) throw new Error("부품명을 입력하세요");
      const { error } = await (supabase as any).from("vendor_purchases").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor_purchases", id] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setPurchaseOpen(false); setPForm({});
      toast({ title: "매입 등록 완료", description: "해당 지점 부품 재고에 수량이 반영되었습니다." });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const removePurchase = useMutation({
    mutationFn: async (pid: string) => {
      const { error } = await (supabase as any).from("vendor_purchases").delete().eq("id", pid);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor_purchases", id] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "매입 내역이 삭제되고 재고 수량이 차감되었습니다." });
    },
  });

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["부품코드", "부품명", "매입가", "매출가", "단위", "비고"],
      ["22217-160000", "오일필터", 8000, 12000, "EA", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "취급품목");
    XLSX.writeFile(wb, "업체_취급품목_템플릿.xlsx");
  };

  const bulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const json = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 }).slice(1);
        const num = (v: any) => {
          const n = parseInt(String(v ?? "").replace(/[,\s₩]/g, ""), 10);
          return Number.isFinite(n) ? n : null;
        };
        const rows = json
          .map((r) => ({
            vendor_id: id,
            part_code: String(r[0] ?? "").trim() || null,
            part_name: String(r[1] ?? "").trim(),
            purchase_price: num(r[2]) ?? 0,
            sales_price: num(r[3]),
            unit: String(r[4] ?? "").trim() || null,
            notes: String(r[5] ?? "").trim() || null,
          }))
          .filter((r) => r.part_name);
        if (!rows.length) return toast({ title: "등록할 행이 없습니다.", variant: "destructive" });
        const { error } = await (supabase as any).from("vendor_items").insert(rows);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["vendor_items", id] });
        toast({ title: `${rows.length}건이 등록되었습니다.` });
      } catch (err: any) {
        toast({ title: "업로드 실패", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (!vendor) return <div className="text-sm text-muted-foreground">업체를 찾을 수 없습니다.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/vendors"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-xl font-bold">{vendor.name}</h1>
          <p className="text-xs text-muted-foreground">
            {[vendor.representative && `대표: ${vendor.representative}`, vendor.phone, vendor.business_number].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items" className="gap-1.5"><Package className="h-4 w-4" /> 취급품목</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1.5"><Truck className="h-4 w-4" /> 매입내역</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-3">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" /> 템플릿</Button>
            <Button size="sm" variant="outline" asChild>
              <label className="cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 mr-1" /> 엑셀 일괄등록
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={bulkUpload} />
              </label>
            </Button>
            <Button size="sm" onClick={() => { setItemForm({}); setItemOpen(true); }}><Plus className="h-4 w-4 mr-1" /> 품목 추가</Button>
          </div>

          <Card className="border-0 shadow-card overflow-hidden">
            {items.length === 0 ? (
              <CardContent className="py-10 text-center text-sm text-muted-foreground">등록된 취급품목이 없습니다.</CardContent>
            ) : items.map((it, idx) => (
              <div key={it.id} className={`flex items-center gap-3 px-4 py-3 group hover:bg-muted/40 ${idx ? "border-t" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{it.part_name} {it.unit && <span className="text-xs text-muted-foreground">/ {it.unit}</span>}</p>
                  {it.part_code && <p className="text-xs text-muted-foreground">{it.part_code}</p>}
                  {it.notes && <p className="text-xs text-muted-foreground/70">{it.notes}</p>}
                </div>
                <div className="text-right text-xs shrink-0">
                  <p>매입 <span className="font-semibold tabular-nums">{won(it.purchase_price)}</span></p>
                  <p className="text-muted-foreground">매출 <span className="tabular-nums">{won(it.sales_price)}</span></p>
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setItemForm(it); setItemOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => confirm("삭제하시겠습니까?") && removeItem.mutate(it.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <Button size="sm" variant="outline" className="shrink-0"
                  onClick={() => { setPForm({ part_code: it.part_code || "", part_name: it.part_name, purchase_price: it.purchase_price, sales_price: it.sales_price ?? undefined, quantity: 1, branch: "장흥", purchase_date: new Date().toISOString().slice(0, 10) }); setPurchaseOpen(true); }}>
                  매입등록
                </Button>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setPForm({ quantity: 1, branch: "장흥", purchase_date: new Date().toISOString().slice(0, 10) }); setPurchaseOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> 매입 등록
            </Button>
          </div>
          <Card className="border-0 shadow-card overflow-hidden">
            {purchases.length === 0 ? (
              <CardContent className="py-10 text-center text-sm text-muted-foreground">매입 내역이 없습니다.</CardContent>
            ) : purchases.map((p, idx) => (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-3 group hover:bg-muted/40 ${idx ? "border-t" : ""}`}>
                <div className="text-xs text-muted-foreground w-20 shrink-0">{p.purchase_date}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{p.part_name} <span className="text-xs text-muted-foreground">[{p.branch}]</span></p>
                  <p className="text-xs text-muted-foreground">{p.part_code} · {p.quantity}개</p>
                  {p.notes && <p className="text-xs text-muted-foreground/70">{p.notes}</p>}
                </div>
                <div className="text-right text-xs shrink-0">
                  <p>매입 <span className="font-semibold tabular-nums">{won(p.purchase_price)}</span></p>
                  <p className="text-muted-foreground">매출 <span className="tabular-nums">{won(p.sales_price)}</span></p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
                  onClick={() => confirm("삭제 시 재고 수량도 차감됩니다. 계속할까요?") && removePurchase.mutate(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>

      {/* 품목 다이얼로그 */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{itemForm.id ? "품목 수정" : "품목 추가"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>부품명 *</Label><Input value={itemForm.part_name || ""} onChange={(e) => setItemForm({ ...itemForm, part_name: e.target.value })} /></div>
            <div><Label>부품코드</Label><Input value={itemForm.part_code || ""} onChange={(e) => setItemForm({ ...itemForm, part_code: e.target.value })} /></div>
            <div><Label>단위</Label><Input value={itemForm.unit || ""} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} placeholder="EA" /></div>
            <div><Label>매입가</Label><Input type="number" value={itemForm.purchase_price ?? ""} onChange={(e) => setItemForm({ ...itemForm, purchase_price: Number(e.target.value) })} /></div>
            <div><Label>매출가</Label><Input type="number" value={itemForm.sales_price ?? ""} onChange={(e) => setItemForm({ ...itemForm, sales_price: Number(e.target.value) })} /></div>
            <div className="col-span-2"><Label>비고</Label><Textarea rows={2} value={itemForm.notes || ""} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>취소</Button>
            <Button onClick={() => saveItem.mutate()} disabled={!itemForm.part_name || saveItem.isPending}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 매입 다이얼로그 */}
      <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>매입 등록</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>매입일</Label><Input type="date" value={pForm.purchase_date || ""} onChange={(e) => setPForm({ ...pForm, purchase_date: e.target.value })} /></div>
            <div>
              <Label>지점</Label>
              <Select value={pForm.branch || "장흥"} onValueChange={(v) => setPForm({ ...pForm, branch: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>부품명 *</Label><Input value={pForm.part_name || ""} onChange={(e) => setPForm({ ...pForm, part_name: e.target.value })} /></div>
            <div><Label>부품코드</Label><Input value={pForm.part_code || ""} onChange={(e) => setPForm({ ...pForm, part_code: e.target.value })} /></div>
            <div><Label>수량</Label><Input type="number" value={pForm.quantity ?? 1} onChange={(e) => setPForm({ ...pForm, quantity: Number(e.target.value) })} /></div>
            <div><Label>매입가</Label><Input type="number" value={pForm.purchase_price ?? ""} onChange={(e) => setPForm({ ...pForm, purchase_price: Number(e.target.value) })} /></div>
            <div><Label>매출가</Label><Input type="number" value={pForm.sales_price ?? ""} onChange={(e) => setPForm({ ...pForm, sales_price: Number(e.target.value) })} /></div>
            <div className="col-span-2"><Label>비고</Label><Input value={pForm.notes || ""} onChange={(e) => setPForm({ ...pForm, notes: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">저장하면 선택한 지점의 부품 재고에 수량이 더해지고 매입가·매출가가 갱신됩니다.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseOpen(false)}>취소</Button>
            <Button onClick={() => savePurchase.mutate()} disabled={!pForm.part_name || savePurchase.isPending}>등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
