import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Check, Stamp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstimateCompany } from "@/lib/printInsuranceEstimate";

export type PrintCompany = EstimateCompany & { id: string; is_default: boolean | null; sort_order: number | null };

export function useCompanies(enabled: boolean) {
  return useQuery<PrintCompany[]>({
    queryKey: ["quote-companies"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("companies").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** 처음 고를 사업장: 지난번에 고른 것 → (지점 이름이 상호·주소에 든 것) → 기본 → 첫 번째 */
export function defaultCompany(companies: PrintCompany[], lastId: string | null, branch?: string | null): PrintCompany | undefined {
  return companies.find((c) => c.id === lastId)
    ?? (branch ? companies.find((c) => `${c.company_name ?? ""} ${c.address ?? ""}`.includes(branch)) : undefined)
    ?? companies.find((c) => c.is_default)
    ?? companies[0];
}

const readLast = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
export const rememberCompany = (key: string, id: string | null) => { try { if (id) localStorage.setItem(key, id); } catch { /* 저장 못 해도 인쇄는 한다 */ } };

/** 인쇄할 문서의 공급자(사업장) 고르기 — 견적서·거래명세서 공용 */
export function CompanyPicker({ open, value, onChange, rememberKey, branch }: {
  open: boolean;
  value: string | null;
  onChange: (id: string, company: PrintCompany) => void;
  rememberKey: string;
  branch?: string | null;
}) {
  const { data: companies = [], isLoading } = useCompanies(open);

  useEffect(() => {
    if (!open || !companies.length) return;
    const pick = defaultCompany(companies, readLast(rememberKey), branch);
    if (pick) onChange(pick.id, pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companies, rememberKey, branch]);

  const company = companies.find((c) => c.id === value) ?? null;

  return (
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
            const on = c.id === value;
            const missing = [!c.business_number && "사업자번호", !c.address && "주소"].filter(Boolean);
            return (
              <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(c.id, c)}
                className={cn("flex w-full min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  on ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-foreground/30")}>
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
  );
}
