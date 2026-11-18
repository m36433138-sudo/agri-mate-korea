import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, FileSpreadsheet, Trash2, Download, Pencil, Package, AlertTriangle, CloudDownload, Boxes, Lightbulb, MapPin } from "lucide-react";
import { inventorySearchFilter } from "@/lib/partSearch";
import { yanmarSalesPrice, normalizePartCode, missingPriceFields, type PartOrigin } from "@/lib/partPricing";
import * as XLSX from "xlsx";
import PartTipsDialog from "@/components/parts/PartTipsDialog";
import { useSearchParams } from "react-router-dom";

type InventoryItem = {
  id: string;
  branch: string;
  part_code: string;
  part_name: string;
  part_name_en: string | null;
  alt_part_code: string | null;
  quantity: number | null;
  purchase_price: number | null;
  sales_price: number | null;
  location_main: string | null;
  location_sub: string | null;
  min_stock: number | null;
};

// 검색어 디바운스 훅 (300ms)
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function InventoryManagement() {
  const [searchParams] = useSearchParams();
  const [branch, setBranch] = useState<"장흥" | "강진">("장흥");
  const [search, setSearch] = useState(searchParams.get('search') ?? "");
  useEffect(() => { setSearch(searchParams.get('search') ?? ''); }, [searchParams]);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tipsItem, setTipsItem] = useState<InventoryItem | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const debouncedSearch = useDebounce(search, 300);
  const hasSearch = debouncedSearch.trim().length >= 2;

  useRealtimeSync("inventory", [["inventory-stats", branch], ["inventory-search", branch, debouncedSearch]]);

  // ① 요약 통계만 먼저 로드 (빠름 - 숫자만)
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["inventory-stats", branch],
    queryFn: async () => {
      const all: { quantity: number | null; min_stock: number | null }[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("inventory")
          .select("quantity, min_stock")
          .eq("branch", branch)
          .order("id")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      const totalItems = all.length;
      const totalQty = all.reduce((s, i) => s + (i.quantity ?? 0), 0);
      const lowStockCount = all.filter(
        (i) => (i.quantity ?? 0) < (i.min_stock ?? 1)
      ).length;
      return { totalItems, totalQty, lowStockCount };
    },
    staleTime: 1000 * 60 * 3,
  });

  // ② 검색 시에만 서버에서 데이터 가져옴 (최대 50개)
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["inventory-search", branch, debouncedSearch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("branch", branch)
        .or(inventorySearchFilter(debouncedSearch))
        .order("part_code")
        .limit(50);
      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: hasSearch, // 검색어 2자 이상일 때만 실행
    staleTime: 1000 * 30, // 30초 캐시
  });

  // ③ 검색 결과 부품들의 팁 개수 (부품코드 기준, 지점 공통)
  const partCodes = (searchResults || []).map((i) => i.part_code);
  const { data: tipCounts = {} } = useQuery({
    queryKey: ["part-tip-counts", partCodes],
    enabled: hasSearch && partCodes.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("part_tips")
        .select("part_code")
        .in("part_code", partCodes);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as { part_code: string }[]).forEach((t) => {
        counts[t.part_code] = (counts[t.part_code] || 0) + 1;
      });
      return counts;
    },
    staleTime: 1000 * 60,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      qc.invalidateQueries({ queryKey: ["inventory-search"] });
      toast({ title: "재고가 삭제되었습니다." });
      setDeleteId(null);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

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
      {/* 지점 선택 + 액션 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant={branch === "장흥" ? "default" : "outline"} size="sm" onClick={() => { setBranch("장흥"); setSearch(""); }}>
            장흥
          </Button>
          <Button variant={branch === "강진" ? "default" : "outline"} size="sm" onClick={() => { setBranch("강진"); setSearch(""); }}>
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
              qc.invalidateQueries({ queryKey: ["inventory-stats"] });
              qc.invalidateQueries({ queryKey: ["inventory-search"] });
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

      {/* 요약 카드 - 항상 표시 */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="shadow-card border-0">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">총 품목</p>
              {statsLoading ? (
                <Skeleton className="h-6 w-12 mt-0.5" />
              ) : (
                <p className="text-lg font-bold tabular-nums">{stats?.totalItems ?? 0}<span className="text-xs font-normal text-muted-foreground ml-1">종</span></p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card border-0">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-info/10">
              <Boxes className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">총 수량</p>
              {statsLoading ? (
                <Skeleton className="h-6 w-12 mt-0.5" />
              ) : (
                <p className="text-lg font-bold tabular-nums">{stats?.totalQty ?? 0}<span className="text-xs font-normal text-muted-foreground ml-1">개</span></p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className={`shadow-card border-0 ${(stats?.lowStockCount ?? 0) > 0 ? "border-l-2 border-l-destructive" : ""}`}>
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">재고 부족</p>
              {statsLoading ? (
                <Skeleton className="h-6 w-12 mt-0.5" />
              ) : (
                <p className="text-lg font-bold tabular-nums text-destructive">
                  {stats?.lowStockCount ?? 0}<span className="text-xs font-normal ml-1">건</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 검색창 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="부품코드 또는 부품명을 2글자 이상 입력하면 검색됩니다..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 max-w-md"
          autoComplete="off"
        />
        {hasSearch && searchResults && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {searchResults.length}건{searchResults.length === 50 ? " (최대)" : ""}
          </span>
        )}
      </div>

      {/* 결과 영역 */}
      {!hasSearch ? (
        /* 검색 전 안내 */
        <Card className="shadow-card border-0 border-dashed border-2">
          <CardContent className="py-14 text-center">
            <Search className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">부품코드 또는 부품명으로 검색하세요</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{branch} 지점 · 총 {statsLoading ? "..." : stats?.totalItems ?? 0}개 품목</p>
          </CardContent>
        </Card>
      ) : searchLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      ) : !searchResults || searchResults.length === 0 ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">"{debouncedSearch}"에 해당하는 부품이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <>
        {/* 핸드폰: 위치를 크게 보이는 카드 목록 */}
        <div className="sm:hidden space-y-2">
          {searchResults.map((item) => {
            const isLow = (item.quantity ?? 0) < (item.min_stock ?? 1);
            const loc = [item.location_main, item.location_sub].filter(Boolean);
            return (
              <Card key={item.id} className={`shadow-card border-0 ${isLow ? "bg-destructive/5" : ""}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-muted-foreground">{item.part_code}{item.alt_part_code ? ` · ${item.alt_part_code}` : ""}</p>
                      <p className="font-medium leading-snug">{item.part_name}</p>
                      {item.part_name_en && item.part_name_en !== item.part_name && <p className="text-xs text-muted-foreground leading-snug">{item.part_name_en}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xl font-bold tabular-nums leading-none ${isLow ? "text-destructive" : ""}`}>{item.quantity ?? 0}<span className="text-xs font-normal text-muted-foreground ml-0.5">개</span></p>
                      {item.sales_price != null && <p className="text-xs text-muted-foreground tabular-nums mt-1">{item.sales_price.toLocaleString()}원</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`flex-1 min-w-0 flex items-center gap-1.5 rounded-lg px-2.5 py-2 ${loc.length ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground"}`}>
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-semibold truncate">{loc.length ? loc.join(" · ") : "위치 미지정"}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9 relative shrink-0" onClick={() => setTipsItem(item)} aria-label="부품 팁·사진">
                      <Lightbulb className={`h-4 w-4 ${tipCounts[item.part_code] ? "text-amber-400" : "text-muted-foreground"}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setEditItem(item)} aria-label="수정">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Card className="shadow-card border-0 overflow-hidden hidden sm:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs">부품코드</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs">부품명(한글)</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">부품명(영문)</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">설계변경코드</th>
                  <th className="text-right p-3 font-medium text-muted-foreground text-xs">수량</th>
                  <th className="text-right p-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">적정재고</th>
                  <th className="text-right p-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">매출가</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs">위치</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((item) => {
                  const isLow = (item.quantity ?? 0) < (item.min_stock ?? 1);
                  return (
                    <tr
                      key={item.id}
                      className={`border-b last:border-0 transition-colors ${isLow ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/25"}`}
                    >
                      <td className="p-3 font-mono text-xs">{item.part_code}</td>
                      <td className="p-3 font-medium">
                        <span>{item.part_name}</span>
                        {isLow && (
                          <span className="ml-2 text-[10px] text-destructive font-semibold bg-destructive/10 px-1.5 py-0.5 rounded-full">부족</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{item.part_name_en || "-"}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground hidden lg:table-cell">
                        {item.alt_part_code || "-"}
                      </td>
                      <td className={`p-3 text-right font-bold tabular-nums ${isLow ? "text-destructive" : ""}`}>
                        {item.quantity ?? 0}
                      </td>
                      <td className="p-3 text-right text-muted-foreground hidden sm:table-cell">
                        {item.min_stock ?? 1}
                      </td>
                      <td className="p-3 text-right text-muted-foreground hidden sm:table-cell tabular-nums">
                        {item.sales_price?.toLocaleString() ?? "-"}
                      </td>
                      <td className="p-3 text-xs font-medium text-primary whitespace-nowrap">
                        {[item.location_main, item.location_sub].filter(Boolean).join(" / ") || <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={() => setTipsItem(item)} title="부품 팁·사진">
                            <Lightbulb className={`h-3.5 w-3.5 ${tipCounts[item.part_code] ? "text-amber-400" : "text-muted-foreground"}`} />
                            {!!tipCounts[item.part_code] && (
                              <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-amber-400/20 text-amber-400 rounded-full px-1 leading-3">
                                {tipCounts[item.part_code]}
                              </span>
                            )}
                          </Button>
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
        </>
      )}

      <AddInventoryDialog open={addOpen} onOpenChange={setAddOpen} branch={branch} />
      {editItem && (
        <EditInventoryDialog item={editItem} onOpenChange={(v) => !v && setEditItem(null)} />
      )}
      <BulkInventoryDialog open={bulkOpen} onOpenChange={setBulkOpen} branch={branch} onDownloadTemplate={downloadTemplate} />
      {tipsItem && (
        <PartTipsDialog
          partCode={tipsItem.part_code}
          partName={tipsItem.part_name}
          open={!!tipsItem}
          onOpenChange={(v) => !v && setTipsItem(null)}
        />
      )}

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
  const emptyForm = {
    part_code: "", part_name: "", part_name_en: "", quantity: "0", min_stock: "1",
    purchase_price: "", sales_price: "", location_main: "", location_sub: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [origin, setOrigin] = useState<PartOrigin>("yanmar");
  // 사용자가 매출가를 직접 고치면 자동 입력이 덮어쓰지 않음
  const [priceTouched, setPriceTouched] = useState(false);
  // 자동으로 채운 값 기억 → 부품코드를 바꾸면 자동 값만 지움(직접 쓴 값은 유지)
  const [autoFilled, setAutoFilled] = useState({ part_name: "", part_name_en: "", sales_price: "" });
  const clearAutoFilled = (f: typeof emptyForm) => ({
    ...f,
    part_name: f.part_name === autoFilled.part_name ? "" : f.part_name,
    part_name_en: f.part_name_en === autoFilled.part_name_en ? "" : f.part_name_en,
    sales_price: f.sales_price === autoFilled.sales_price ? "" : f.sales_price,
  });

  const code = useDebounce(normalizePartCode(form.part_code), 400);

  const { data: lookup, isFetching: lookingUp } = useQuery({
    queryKey: ["part-price-lookup", code, branch],
    enabled: open && code.length >= 4,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [supplyRes, invRes] = await Promise.all([
        supabase.from("yanmar_supply_prices").select("part_name, supply_price, effective_date").eq("part_code", code).maybeSingle(),
        supabase.from("inventory").select("branch, part_name, part_name_en, sales_price").eq("part_code", code).limit(5),
      ]);
      if (supplyRes.error) throw supplyRes.error;
      if (invRes.error) throw invRes.error;
      const existing = (invRes.data ?? []).find((r) => r.sales_price != null) ?? (invRes.data ?? [])[0] ?? null;
      const sameBranch = (invRes.data ?? []).some((r) => r.branch === branch);
      return { supply: supplyRes.data, existing, sameBranch };
    },
  });

  const supplyPrice = lookup?.supply?.supply_price ?? null;
  const calcPrice = yanmarSalesPrice(supplyPrice);
  // 다른 지점에 이미 있는 부품이면 그 매출가 우선(두 지점 매출가는 항상 같게 유지됨)
  const autoPrice = lookup?.existing?.sales_price ?? calcPrice;

  useEffect(() => {
    if (!lookup || origin !== "yanmar") return;
    setForm((f) => {
      const next = {
        ...f,
        sales_price: !priceTouched && autoPrice != null ? String(autoPrice) : f.sales_price,
        part_name: f.part_name || lookup.existing?.part_name || lookup.supply?.part_name || "",
        part_name_en: f.part_name_en || lookup.existing?.part_name_en || lookup.supply?.part_name || "",
      };
      setAutoFilled({
        part_name: next.part_name !== f.part_name ? next.part_name : autoFilled.part_name,
        part_name_en: next.part_name_en !== f.part_name_en ? next.part_name_en : autoFilled.part_name_en,
        sales_price: next.sales_price !== f.sales_price ? next.sales_price : autoFilled.sales_price,
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup, origin]);

  const reset = () => { setForm(emptyForm); setOrigin("yanmar"); setPriceTouched(false); setAutoFilled({ part_name: "", part_name_en: "", sales_price: "" }); };
  const chooseOrigin = (value: PartOrigin) => {
    setOrigin(value);
    if (value === "other") setForm((f) => clearAutoFilled(f));
  };

  const missing = missingPriceFields(origin, form.purchase_price, form.sales_price);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inventory").insert({
        branch,
        part_code: form.part_code.trim(),
        part_name: form.part_name,
        part_name_en: form.part_name_en.trim() || null,
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
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      qc.invalidateQueries({ queryKey: ["inventory-search"] });
      toast({ title: "재고가 등록되었습니다." });
      onOpenChange(false);
      reset();
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const codeReady = code.length >= 4 && code === normalizePartCode(form.part_code);
  let priceHint: React.ReactNode = null;
  if (origin === "yanmar" && codeReady) {
    if (lookingUp) priceHint = "얀마 공급가 찾는 중…";
    else if (lookup?.existing?.sales_price != null)
      priceHint = `${lookup.existing.branch}에 이미 있는 부품이라 같은 매출가를 넣었어요.`;
    else if (calcPrice != null && lookup?.supply)
      priceHint = `얀마 공급가 ${supplyPrice!.toLocaleString()}원(부가세 별도, ${lookup.supply.effective_date} 기준) × 1.1 × 1.35`;
    else if (lookup && !lookup.supply)
      priceHint = "얀마 공급가 표에 없는 번호예요. 타사 부품이면 위에서 「타사 부품」을 골라 주세요.";
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>재고 등록 ({branch})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="부품 종류">
            {([["yanmar", "얀마 부품"], ["other", "타사 부품"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={origin === value}
                onClick={() => chooseOrigin(value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${origin === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div>
            <Label>부품코드 *</Label>
            <Input value={form.part_code} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...clearAutoFilled(f), part_code: v })); setPriceTouched(false); }} placeholder="22217-160000" />
          </div>
          <div>
            <Label>부품명(한글) *</Label>
            <Input value={form.part_name} onChange={(e) => setForm((f) => ({ ...f, part_name: e.target.value }))} placeholder="엔진오일 필터" />
          </div>
          <div>
            <Label>부품명(영문)</Label>
            <Input value={form.part_name_en} onChange={(e) => setForm((f) => ({ ...f, part_name_en: e.target.value }))} placeholder="OIL FILTER" />
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
              <Label>매입가{origin === "other" ? " *" : ""}</Label>
              <Input type="number" value={form.purchase_price} onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))} />
            </div>
            <div>
              <Label>매출가{origin === "other" ? " *" : " (자동, 수정 가능)"}</Label>
              <Input type="number" value={form.sales_price} onChange={(e) => { setForm((f) => ({ ...f, sales_price: e.target.value })); setPriceTouched(true); }} />
            </div>
          </div>
          {codeReady && lookup?.sameBranch && (
            <p className="text-xs text-destructive -mt-1">이미 {branch}에 등록된 부품이에요. 목록에서 찾아 수량을 고쳐 주세요.</p>
          )}
          {priceHint && <p className="text-xs text-muted-foreground -mt-1">{priceHint}</p>}
          {origin === "other" && <p className="text-xs text-muted-foreground -mt-1">타사 부품은 매입가와 매출가를 직접 적어 주세요(부가세 포함).</p>}
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
          <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!(form.part_code && form.part_name) || missing.length > 0 || (codeReady && !!lookup?.sameBranch) || mutation.isPending}>
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
    part_name: item.part_name ?? "",
    part_name_en: item.part_name_en ?? "",
    quantity: String(item.quantity ?? 0),
    min_stock: String(item.min_stock ?? 1),
    purchase_price: String(item.purchase_price ?? ""),
    sales_price: String(item.sales_price ?? ""),
    location_main: item.location_main ?? "",
    location_sub: item.location_sub ?? "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("inventory").update({
        part_name: form.part_name.trim() || item.part_name,
        part_name_en: form.part_name_en.trim() || null,
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
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      qc.invalidateQueries({ queryKey: ["inventory-search"] });
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
              <Label>부품명(한글)</Label>
              <Input value={form.part_name} onChange={(e) => setForm((f) => ({ ...f, part_name: e.target.value }))} />
            </div>
            <div>
              <Label>부품명(영문)</Label>
              <Input value={form.part_name_en} onChange={(e) => setForm((f) => ({ ...f, part_name_en: e.target.value }))} />
            </div>
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
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      qc.invalidateQueries({ queryKey: ["inventory-search"] });
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
