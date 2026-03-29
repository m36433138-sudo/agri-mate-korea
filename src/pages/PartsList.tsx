import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InventoryManagement from "@/components/InventoryManagement";
import StockAdjustment from "@/components/StockAdjustment";
import { Package, ArrowUpDown } from "lucide-react";

export default function PartsList() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">부품관리</h1>
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="inventory" className="gap-1.5">
            <Package className="h-4 w-4" /> 부품현황
          </TabsTrigger>
          <TabsTrigger value="adjustment" className="gap-1.5">
            <ArrowUpDown className="h-4 w-4" /> 재고조정
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <InventoryManagement />
        </TabsContent>
        <TabsContent value="adjustment">
          <StockAdjustment />
        </TabsContent>
      </Tabs>
    </div>
  );
}
