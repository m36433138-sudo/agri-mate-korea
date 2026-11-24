import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Package, Building2, Trash2, FileText, MoreHorizontal, ChevronRight } from "lucide-react";
import { PageHeader, SearchField } from "@/components/page/PageParts";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { won } from "@/lib/quoteTypes";
import { toast } from "sonner";

export default function QuotesList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const [authors, setAuthors] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await (supabase as any)
      .from("quotes")
      .select("id,quote_number,quote_date,customer_name,customer_phone,total_amount,created_by,assignee,companies(company_name)")
      .order("quote_date", { ascending: false })
      .limit(200);
    setRows(data || []);
    setLoading(false);
    const ids = [...new Set((data || []).map((r: any) => r.created_by).filter(Boolean))];
    if (ids.length) {
      const { data: profs } = await (supabase as any).from("profiles").select("id,display_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p.display_name || "알 수 없음"; });
      setAuthors(map);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) =>
    !q || r.quote_number?.includes(q) || (r.customer_name || "").includes(q) || (r.customer_phone || "").includes(q)
  );

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await (supabase as any).from("quotes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const total = filtered.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="견적서 관리"
        sub={loading ? "불러오는 중…" : <>최근 {rows.length}건{q && <> · 찾은 견적 {filtered.length}건</>} · 합계 {won(total)}</>}
        actions={
          <>
            <Button variant="outline" className="h-11 rounded-full bg-card hidden sm:inline-flex" onClick={() => navigate("/quotes/companies")}><Building2 className="w-4 h-4 mr-1.5" />사업자</Button>
            <Button variant="outline" className="h-11 rounded-full bg-card hidden sm:inline-flex" onClick={() => navigate("/quotes/products")}><Package className="w-4 h-4 mr-1.5" />제품</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 w-11 p-0 rounded-full bg-card sm:hidden" aria-label="더 보기"><MoreHorizontal className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => navigate("/quotes/companies")}><Building2 className="w-4 h-4 mr-2" />사업자 관리</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/quotes/products")}><Package className="w-4 h-4 mr-2" />제품 관리</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="h-11 rounded-full px-5" onClick={() => navigate("/quotes/new")}><Plus className="w-4 h-4 mr-1" />견적서 작성</Button>
          </>
        }
      />

      <SearchField value={q} onChange={setQ} placeholder="견적번호, 고객명, 전화번호로 찾기" className="max-w-xl" />

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-border/70 bg-card py-16 text-center text-sm text-muted-foreground">
          {q ? "조건에 맞는 견적서가 없어요." : "견적서가 없습니다"}
        </div>
      ) : (
        <div className="rounded-3xl border border-border/70 bg-card card-shadow p-1.5 sm:p-2">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="group flex items-center gap-3 px-2.5 py-3 rounded-2xl hover:bg-foreground/[0.04] cursor-pointer transition-colors"
              onClick={() => navigate(`/quotes/${r.id}`)}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="h-[18px] w-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-[15px] truncate">{r.customer_name || "고객 미지정"}</span>
                  {r.customer_phone && <span className="text-xs text-muted-foreground truncate hidden sm:inline">{r.customer_phone}</span>}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 min-w-0 whitespace-nowrap overflow-hidden">
                  <span className="font-mono">{r.quote_number}</span>
                  <span className="hidden sm:inline">· {r.quote_date}</span>
                  <span className="sm:hidden">· {r.quote_date?.slice(5)}</span>
                  {r.companies?.company_name && <span className="truncate hidden sm:inline">· {r.companies.company_name}</span>}
                  {r.created_by && authors[r.created_by] && <span className="truncate hidden md:inline">· 작성 {authors[r.created_by]}</span>}
                  {r.assignee && <span className="truncate text-primary">· 담당 {r.assignee}</span>}
                </div>
              </div>
              <span className="text-sm sm:text-base font-bold tabular-nums whitespace-nowrap">{won(Number(r.total_amount))}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors shrink-0 hidden sm:block" />
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground" aria-label="더 보기"><MoreHorizontal className="h-5 w-5" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => navigate(`/quotes/${r.id}`)}>열기 · 수정</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => remove(r.id)} className="text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" /> 삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
