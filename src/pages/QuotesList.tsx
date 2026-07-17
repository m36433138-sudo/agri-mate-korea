import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Package, Building2, Trash2 } from "lucide-react";
import { won } from "@/lib/quoteTypes";
import { toast } from "sonner";

export default function QuotesList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await (supabase as any)
      .from("quotes")
      .select("id,quote_number,quote_date,customer_name,customer_phone,total_amount,companies(company_name)")
      .order("quote_date", { ascending: false })
      .limit(200);
    setRows(data || []);
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold">견적서 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">발행한 견적서 목록</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/quotes/companies")}><Building2 className="w-4 h-4 mr-1" />사업자</Button>
          <Button variant="outline" onClick={() => navigate("/quotes/products")}><Package className="w-4 h-4 mr-1" />제품</Button>
          <Button onClick={() => navigate("/quotes/new")}><Plus className="w-4 h-4 mr-1" />견적서 작성</Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="견적번호/고객명/전화 검색" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-2">
        {filtered.map((r) => (
          <Card key={r.id} className="p-4 hover:bg-accent/40 cursor-pointer flex items-center justify-between" onClick={() => navigate(`/quotes/${r.id}`)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-primary">{r.quote_number}</span>
                <span className="text-sm text-muted-foreground">{r.quote_date}</span>
                {r.companies?.company_name && <span className="text-xs bg-secondary px-2 py-0.5 rounded">{r.companies.company_name}</span>}
              </div>
              <div className="mt-1 flex items-center gap-3">
                <span className="font-medium">{r.customer_name || "-"}</span>
                <span className="text-xs text-muted-foreground">{r.customer_phone}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-primary tabular-nums">{won(Number(r.total_amount))}</span>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); remove(r.id); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <div className="text-center text-muted-foreground py-12">견적서가 없습니다</div>}
      </div>
    </div>
  );
}
