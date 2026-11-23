import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Building2, Check, Loader2, Map as MapIcon, Printer, Stamp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstimateItem } from "@/lib/insuranceEstimate";
import { printInsuranceEstimate, type EstimateCompany, type EstimatePrintInfo } from "@/lib/printInsuranceEstimate";
import { loadEstimateSheets } from "@/lib/estimateDiagrams";

type Company = EstimateCompany & { id: string; is_default: boolean | null; sort_order: number | null };
const LAST_KEY = "insuranceEstimate.companyId";

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
  const [withDiagrams, setWithDiagrams] = useState(true);
  const [busy, setBusy] = useState(false);
  const diagramCount = useMemo(() => new Set(items.map((i) => i.diagram_id).filter(Boolean)).size, [items]);

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["quote-companies"],
    enabled: open,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("companies").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 지난번에 고른 사업장 → 기본 사업장 → 첫 번째
  useEffect(() => {
    if (!open || !companies.length) return;
    let last: string | null = null;
    try { last = localStorage.getItem(LAST_KEY); } catch { /* 저장소 없음 */ }
    const pick = companies.find((c) => c.id === last) ?? companies.find((c) => c.is_default) ?? companies[0];
    setCompanyId(pick.id);
  }, [open, companies]);

  const company = companies.find((c) => c.id === companyId) ?? null;

  const print = async () => {
    setBusy(true);
    try {
      try { if (companyId) localStorage.setItem(LAST_KEY, companyId); } catch { /* 저장 못 해도 인쇄는 한다 */ }
      let diagrams: EstimatePrintInfo["diagrams"] = [];
      if (withDiagrams && diagramCount) {
        try {
          diagrams = await loadEstimateSheets(items);
        } catch (e: any) {
          toast({ title: "도면을 불러오지 못해 견적서만 인쇄해요", description: e.message, variant: "destructive" });
        }
      }
      printInsuranceEstimate(items, { ...info, company, diagrams });
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
          <div className="space-y-2 min-w-0">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Building2 className="h-4 w-4 text-muted-foreground" /> 공급자 (사업장)</p>
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
            ) : companies.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-2xl border p-3">
                등록된 사업장이 없어요. <Link to="/quotes/companies" className="text-primary underline">견적서 → 사업자</Link>에서 먼저 등록해 주세요.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 min-w-0" role="radiogroup" aria-label="사업장">
                {companies.map((c) => {
                  const on = c.id === companyId;
                  const missing = [!c.business_number && "사업자번호", !c.address && "주소"].filter(Boolean);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setCompanyId(c.id)}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                        on ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-foreground/30",
                      )}
                    >
                      <span className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                        {on && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold truncate">{c.company_name}{c.is_default && <span className="ml-1.5 text-[11px] text-primary font-medium">기본</span>}</span>
                        <span className="block text-xs text-muted-foreground truncate">
                          {[c.business_number, c.ceo_name && `대표 ${c.ceo_name}`, c.address].filter(Boolean).join(" · ") || "정보 없음"}
                        </span>
                        {missing.length > 0 && <span className="block text-[11px] text-amber-600 dark:text-amber-400">{missing.join("·")}가 비어 있어요</span>}
                      </span>
                      {c.stamp_url
                        ? <img src={c.stamp_url} alt="직인" className="h-9 w-9 object-contain shrink-0" />
                        : <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1"><Stamp className="h-3.5 w-3.5" />(인)만</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {company && !company.stamp_url && (
              <p className="text-xs text-muted-foreground">
                직인 그림이 없어 「(인)」 자리만 비워 인쇄해요. 직인을 올리면 자동으로 찍혀요 → <Link to="/quotes/companies" className="text-primary underline">사업자 관리</Link>
              </p>
            )}
          </div>

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
