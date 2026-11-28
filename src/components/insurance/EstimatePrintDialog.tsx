import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Map as MapIcon, MapPin, Printer } from "lucide-react";
import { CompanyPicker, rememberCompany, type PrintCompany } from "@/components/print/CompanyPicker";
import { cn } from "@/lib/utils";
import type { EstimateItem } from "@/lib/insuranceEstimate";
import { printInsuranceEstimate, type EstimatePrintInfo } from "@/lib/printInsuranceEstimate";
import { loadEstimateSheets, loadPartLocations } from "@/lib/estimateDiagrams";

const LAST_KEY = "insuranceEstimate.companyId";
const LOC_KEY = "insuranceEstimate.withLocations";
const readLoc = () => { try { return localStorage.getItem(LOC_KEY) !== "false"; } catch { return true; } };

/** 견적서 인쇄 전: 어느 사업장 이름으로 낼지, 부품 위치 도면을 붙일지 고른다 */
export default function EstimatePrintDialog({
  open, onOpenChange, items, info,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: EstimateItem[];
  info: Omit<EstimatePrintInfo, "company" | "diagrams">;
}) {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [company, setCompany] = useState<PrintCompany | null>(null);
  const [withDiagrams, setWithDiagrams] = useState(true);
  const [withLocations, setWithLocations] = useState(readLoc);
  const [busy, setBusy] = useState(false);
  const diagramCount = useMemo(() => new Set(items.map((i) => i.diagram_id).filter(Boolean)).size, [items]);

  const print = async () => {
    setBusy(true);
    try {
      rememberCompany(LAST_KEY, companyId);
      try { localStorage.setItem(LOC_KEY, String(withLocations)); } catch { /* 저장 못 해도 인쇄는 한다 */ }
      let diagrams: EstimatePrintInfo["diagrams"] = [];
      let partLocations: EstimatePrintInfo["partLocations"] = null;
      if (withDiagrams && diagramCount) {
        try {
          [diagrams, partLocations] = await Promise.all([
            loadEstimateSheets(items),
            withLocations ? loadPartLocations(items).catch(() => {
              toast({ title: "창고 위치를 불러오지 못해 위치 없이 인쇄해요", variant: "destructive" });
              return null;
            }) : Promise.resolve(null),
          ]);
        } catch (e: any) {
          toast({ title: "도면을 불러오지 못해 견적서만 인쇄해요", description: e.message, variant: "destructive" });
        }
      }
      printInsuranceEstimate(items, { ...info, company, diagrams, partLocations });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5 text-primary" /> 견적서 인쇄</DialogTitle>
          <DialogDescription>{items.length}줄 · 보험사 제출용</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 min-w-0">
          <CompanyPicker open={open} value={companyId} rememberKey={LAST_KEY} branch={info.branch}
            onChange={(id, c) => { setCompanyId(id); setCompany(c); }} />

          <label className={cn("flex items-start gap-3 rounded-2xl border p-3", diagramCount ? "cursor-pointer" : "opacity-60")}>
            <Checkbox className="mt-0.5" checked={withDiagrams && diagramCount > 0} disabled={!diagramCount} onCheckedChange={(v) => setWithDiagrams(!!v)} />
            <span className="text-sm min-w-0">
              <span className="font-semibold flex items-center gap-1.5"><MapIcon className="h-4 w-4 text-primary" /> 부품 위치 도면 같이 인쇄</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {diagramCount
                  ? `도면 ${diagramCount}장에 견적 부품을 형광펜과 견적 번호로 표시해 견적서 뒤에 붙여요`
                  : "도면에서 담은 부품이 없어요. 「도면 보면서 담기」로 담은 부품만 표시돼요"}
              </span>
            </span>
          </label>

          <label className={cn("flex items-start gap-3 rounded-2xl border p-3 ml-6", withDiagrams && diagramCount ? "cursor-pointer" : "opacity-60")}>
            <Checkbox className="mt-0.5" checked={withLocations && withDiagrams && diagramCount > 0} disabled={!withDiagrams || !diagramCount} onCheckedChange={(v) => setWithLocations(!!v)} />
            <span className="text-sm min-w-0">
              <span className="font-semibold flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> 도면 옆에 장흥·강진 창고 위치</span>
              <span className="block text-xs text-muted-foreground mt-0.5">부품표에 두 창고의 보관 위치와 재고 수량을 같이 적어요. 보험사에 낼 때는 끄세요.</span>
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>취소</Button>
          <Button onClick={print} disabled={busy || !items.length} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {busy ? "도면 준비 중…" : "인쇄"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
