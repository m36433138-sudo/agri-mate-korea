import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ShoppingCart } from "lucide-react";
import PartOrderCartContents from "./PartOrderCartContents";
import { cart, useCart, toOrderRows } from "@/lib/partOrderCart";

export default function PartOrderCartDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const items = useCart();
  const download = () => {
    const ws = XLSX.utils.json_to_sheet(toOrderRows(items));
    ws["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 30 }, { wch: 6 }, { wch: 18 }, { wch: 10 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "발주");
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    XLSX.writeFile(wb, `얀마_부품발주_${ymd}.xlsx`);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /> 주문 목록 ({items.length})</DialogTitle>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">도면에서 부품번호를 눌러 「주문 목록에 담기」를 해 주세요.</p>
        ) : (
          <div className="space-y-2">
            <PartOrderCartContents />
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => confirm("주문 목록을 비울까요?") && cart.clear()}>비우기</Button>
              <Button className="flex-1 gap-1.5" onClick={download}><Download className="h-4 w-4" /> 발주 엑셀 내려받기</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
