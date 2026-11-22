import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PartReceiving from "@/components/partReceipts/PartReceiving";
import { db } from "@/components/partReceipts/receiptData";
import InventoryManagement from "@/components/InventoryManagement";
import StockAdjustment from "@/components/StockAdjustment";
import LowStockList from "@/components/LowStockList";
import BranchInventoryCompare from "@/components/BranchInventoryCompare";
import BulkPriceUpdate from "@/components/BulkPriceUpdate";
import PartProcurement from "@/components/PartProcurement";
import { PageHeader } from "@/components/page/PageParts";
import { PackageCheck, Package, ArrowUpDown, AlertTriangle, GitCompare, Tag, Truck } from "lucide-react";

export default function PartsList() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "inventory";
  // 입고 대기 줄 수 (탭에 숫자로)
  const { data: waiting = 0 } = useQuery({
    queryKey: ["part-receipts", "waiting-count"],
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await db.from("part_receipt_items").select("id, part_receipts!inner(status)", { count: "exact", head: true })
        .eq("status", "pending").in("part_receipts.status", ["pending", "partial"]);
      return count ?? 0;
    },
  });
  return (
    <div>
      <PageHeader title="부품관리" sub="재고 찾기 · 조달 · 지점 비교 · 재고조정" className="mb-5" />
      <Tabs value={tab} onValueChange={(v) => setParams(v === "inventory" ? {} : { tab: v }, { replace: true })} className="w-full">
        <TabsList className="mb-5">
          <TabsTrigger value="inventory" className="gap-1.5">
            <Package className="h-4 w-4" /> 부품현황
          </TabsTrigger>
          <TabsTrigger value="receiving" className="gap-1.5">
            <PackageCheck className="h-4 w-4" /> 부품 입고
            {waiting > 0 && <span className="ml-0.5 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">{waiting}</span>}
          </TabsTrigger>
          <TabsTrigger value="procurement" className="gap-1.5">
            <Truck className="h-4 w-4" /> 부품조달
          </TabsTrigger>
          <TabsTrigger value="compare" className="gap-1.5">
            <GitCompare className="h-4 w-4" /> 지점 비교
          </TabsTrigger>
          <TabsTrigger value="lowstock" className="gap-1.5">
            <AlertTriangle className="h-4 w-4" /> 부족재고
          </TabsTrigger>
          <TabsTrigger value="adjustment" className="gap-1.5">
            <ArrowUpDown className="h-4 w-4" /> 재고조정
          </TabsTrigger>
          <TabsTrigger value="price" className="gap-1.5">
            <Tag className="h-4 w-4" /> 매출가 일괄수정
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <InventoryManagement />
        </TabsContent>
        <TabsContent value="receiving">
          <PartReceiving />
        </TabsContent>
        <TabsContent value="procurement">
          <PartProcurement />
        </TabsContent>
        <TabsContent value="compare">
          <BranchInventoryCompare />
        </TabsContent>
        <TabsContent value="lowstock">
          <LowStockList />
        </TabsContent>
        <TabsContent value="adjustment">
          <StockAdjustment />
        </TabsContent>
        <TabsContent value="price">
          <BulkPriceUpdate />
        </TabsContent>
      </Tabs>
    </div>
  );
}
