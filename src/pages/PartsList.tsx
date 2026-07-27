import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InventoryManagement from "@/components/InventoryManagement";
import StockAdjustment from "@/components/StockAdjustment";
import LowStockList from "@/components/LowStockList";
import BranchInventoryCompare from "@/components/BranchInventoryCompare";
import BulkPriceUpdate from "@/components/BulkPriceUpdate";
import { Package, ArrowUpDown, AlertTriangle, GitCompare, Tag } from "lucide-react";

export default function PartsList() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">부품관리</h1>
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="inventory" className="gap-1.5">
            <Package className="h-4 w-4" /> 부품현황
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
