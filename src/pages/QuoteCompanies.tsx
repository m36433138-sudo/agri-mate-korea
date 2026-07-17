import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import type { Company } from "@/lib/quoteTypes";

export default function QuoteCompanies() {
  const [items, setItems] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Company> | null>(null);

  const load = async () => {
    const { data } = await (supabase as any).from("companies").select("*").order("sort_order");
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.company_name) return toast.error("회사명을 입력하세요");
    const payload = {
      company_name: editing.company_name,
      business_number: editing.business_number || null,
      ceo_name: editing.ceo_name || null,
      address: editing.address || null,
      phone: editing.phone || null,
      fax: editing.fax || null,
      sort_order: editing.sort_order ?? 99,
    };
    const { error } = editing.id
      ? await (supabase as any).from("companies").update(payload).eq("id", editing.id)
      : await (supabase as any).from("companies").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await (supabase as any).from("companies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const setDefault = async (id: string) => {
    await (supabase as any).from("companies").update({ is_default: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    await (supabase as any).from("companies").update({ is_default: true }).eq("id", id);
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">사업자 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">견적서 발행 시 선택할 자사 사업자 정보</p>
        </div>
        <Button onClick={() => { setEditing({}); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> 사업자 추가
        </Button>
      </div>

      <div className="grid gap-3">
        {items.map((c) => (
          <Card key={c.id} className="p-4 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{c.company_name}</h3>
                {c.is_default && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">기본</span>}
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                {c.business_number && <div>사업자번호: {c.business_number}</div>}
                {c.ceo_name && <div>대표: {c.ceo_name}</div>}
                {c.address && <div>주소: {c.address}</div>}
                {c.phone && <div>전화: {c.phone}</div>}
              </div>
            </div>
            <div className="flex gap-1">
              {!c.is_default && (
                <Button size="sm" variant="ghost" onClick={() => setDefault(c.id)} title="기본으로">
                  <Star className="w-4 h-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "사업자 수정" : "사업자 추가"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>회사명 *</Label><Input value={editing?.company_name || ""} onChange={(e) => setEditing({ ...editing, company_name: e.target.value })} /></div>
            <div><Label>사업자번호</Label><Input value={editing?.business_number || ""} onChange={(e) => setEditing({ ...editing, business_number: e.target.value })} placeholder="000-00-00000" /></div>
            <div><Label>대표자명</Label><Input value={editing?.ceo_name || ""} onChange={(e) => setEditing({ ...editing, ceo_name: e.target.value })} /></div>
            <div><Label>주소</Label><Input value={editing?.address || ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>전화</Label><Input value={editing?.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div><Label>팩스</Label><Input value={editing?.fax || ""} onChange={(e) => setEditing({ ...editing, fax: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
