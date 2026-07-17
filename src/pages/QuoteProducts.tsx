import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import type { QuoteProduct } from "@/lib/quoteTypes";
import { won } from "@/lib/quoteTypes";
import ProductBulkUpload from "@/components/quotes/ProductBulkUpload";

export default function QuoteProducts() {
  const [items, setItems] = useState<QuoteProduct[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<QuoteProduct> | null>(null);

  const load = async () => {
    const { data } = await (supabase as any).from("quote_products").select("*").order("sort_order").order("name");
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name) return toast.error("품명을 입력하세요");
    const payload = {
      name: editing.name,
      spec: editing.spec || null,
      unit_price: Number(editing.unit_price) || 0,
      category: editing.category || null,
      notes: editing.notes || null,
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await (supabase as any).from("quote_products").update(payload).eq("id", editing.id)
      : await (supabase as any).from("quote_products").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await (supabase as any).from("quote_products").delete().eq("id", id);
    load();
  };

  const filtered = items.filter((i) =>
    !q || i.name.toLowerCase().includes(q.toLowerCase()) || (i.spec || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">견적 제품 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">견적서에서 선택할 제품/규격/단가</p>
        </div>
        <div className="flex gap-2">
          <ProductBulkUpload onDone={load} />
          <Button onClick={() => { setEditing({ is_active: true }); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> 제품 추가
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="제품명/규격 검색" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-2">
        {filtered.map((p) => (
          <Card key={p.id} className="p-3 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                {p.spec && <span className="text-sm text-muted-foreground">{p.spec}</span>}
                {!p.is_active && <span className="text-xs text-muted-foreground">(비활성)</span>}
              </div>
              {p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold tabular-nums">{won(p.unit_price)}</span>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <div className="text-center text-muted-foreground py-8">제품이 없습니다</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "제품 수정" : "제품 추가"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>품명 *</Label><Input value={editing?.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>규격</Label><Input value={editing?.spec || ""} onChange={(e) => setEditing({ ...editing, spec: e.target.value })} /></div>
            <div><Label>단가</Label><Input type="number" value={editing?.unit_price ?? ""} onChange={(e) => setEditing({ ...editing, unit_price: Number(e.target.value) })} /></div>
            <div><Label>카테고리</Label><Input value={editing?.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
            <div><Label>메모</Label><Input value={editing?.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
