import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/quotes/ProductGrid";
import { ProductDetail } from "@/components/quotes/ProductDetail";
import { won } from "@/lib/quoteTypes";
import type { QuoteProduct } from "@/lib/quoteTypes";

export function ProductPickerDialog({ open, onOpenChange, onPick }: {
  open: boolean; onOpenChange: (v: boolean) => void; onPick: (p: QuoteProduct) => void;
}) {
  const [items, setItems] = useState<QuoteProduct[]>([]);
  const [detail, setDetail] = useState<QuoteProduct | null>(null);

  useEffect(() => {
    if (!open) return;
    (supabase as any).from("quote_products").select("*").eq("is_active", true).order("sort_order").order("name")
      .then(({ data }: any) => setItems(data || []));
  }, [open]);

  const choose = (p: QuoteProduct) => { onPick(p); setDetail(null); onOpenChange(false); };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto overflow-x-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>제품 선택</DialogTitle></DialogHeader>
          <ProductGrid products={items} compact showInactive={false} onOpen={setDetail}
            renderAction={(p) => <Button size="sm" className="w-full gap-1" onClick={() => choose(p)}><Plus className="h-4 w-4" />담기</Button>} />
        </DialogContent>
      </Dialog>
      <ProductDetail p={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)}
        footer={detail && <Button className="flex-1 gap-1.5" onClick={() => choose(detail)}><Plus className="h-4 w-4" />견적에 담기</Button>} />
    </>
  );
}

export function CustomerPickerDialog({ open, onOpenChange, onPick }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onPick: (c: { id: string; name: string; phone: string | null; address: string | null }) => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    (supabase as any).from("customers").select("id,name,phone,address").order("name").limit(500)
      .then(({ data }: any) => setItems(data || []));
  }, [open]);

  const filtered = items.filter((i) =>
    !q || (i.name || "").toLowerCase().includes(q.toLowerCase()) || (i.phone || "").includes(q)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>고객 선택</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus placeholder="이름/전화번호 검색" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto space-y-1">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => { onPick(c); onOpenChange(false); }}
              className="w-full text-left p-3 rounded-lg hover:bg-accent">
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.phone} · {c.address}</div>
            </button>
          ))}
          {filtered.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm">검색 결과 없음</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
