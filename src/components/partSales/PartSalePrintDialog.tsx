import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Printer } from "lucide-react";
import { CompanyPicker, rememberCompany, type PrintCompany } from "@/components/print/CompanyPicker";
import { printHtmlDocument } from "@/lib/printInsuranceEstimate";
import { partSaleHtml } from "@/lib/printPartSale";
import type { PartSaleRow } from "./types";
import { buyerOf } from "./types";

const keyOf = (branch: string) => `partSale.companyId.${branch}`;
const COPY_KEY = "partSale.withSupplierCopy";

/** 거래명세서 인쇄 전: 공급자(사업장)와 보관용 2장 여부를 고른다. 사업장은 지점별로 지난번 선택을 기억한다. */
export function PartSalePrintDialog({ sale, open, onOpenChange }: { sale: PartSaleRow; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [company, setCompany] = useState<PrintCompany | null>(null);
  const [twoCopies, setTwoCopies] = useState(() => { try { return localStorage.getItem(COPY_KEY) === "1"; } catch { return false; } });

  const print = () => {
    rememberCompany(keyOf(sale.branch), companyId);
    try { localStorage.setItem(COPY_KEY, twoCopies ? "1" : "0"); } catch { /* 기억 못 해도 인쇄는 한다 */ }
    printHtmlDocument(partSaleHtml(sale, { company, withSupplierCopy: twoCopies }));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5 text-primary" /> 거래명세서 인쇄</DialogTitle>
          <DialogDescription>{buyerOf(sale)} · {sale.sale_date} · {(sale.part_sale_items ?? []).length}품목</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 min-w-0">
          <CompanyPicker open={open} value={companyId} rememberKey={keyOf(sale.branch)} branch={sale.branch}
            onChange={(id, c) => { setCompanyId(id); setCompany(c); }} />
          <label className="flex items-start gap-3 rounded-2xl border p-3 cursor-pointer">
            <Checkbox className="mt-0.5" checked={twoCopies} onCheckedChange={(v) => setTwoCopies(!!v)} />
            <span className="text-sm min-w-0">
              <span className="font-semibold flex items-center gap-1.5"><Copy className="h-4 w-4 text-primary" /> 공급자 보관용도 같이 인쇄</span>
              <span className="block text-xs text-muted-foreground mt-0.5">「공급받는자 보관용」·「공급자 보관용」 2장을 뽑아요</span>
            </span>
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={print} className="gap-1.5"><Printer className="h-4 w-4" /> 인쇄</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
