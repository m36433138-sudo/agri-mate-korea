import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page/PageParts";
import ProductBulkUpload from "@/components/quotes/ProductBulkUpload";
import { ProductGrid } from "@/components/quotes/ProductGrid";
import { ProductDetail, useQuoteProducts } from "@/components/quotes/ProductDetail";
import type { QuoteProduct } from "@/lib/quoteTypes";
import { MACHINE_GROUPS, PRODUCT_BUCKET, groupOf, productImageUrl, uploadProductImage } from "@/lib/productCatalog";
import { cn } from "@/lib/utils";

const db = supabase as any;

type Draft = Partial<QuoteProduct> & { _file?: File | null; _preview?: string | null; _removeImage?: boolean };

function ProductEditDialog({ draft, onClose, categories, onSaved }: { draft: Draft | null; onClose: () => void; categories: string[]; onSaved: () => void }) {
  const [d, setD] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (draft) setD(draft); }, [draft]);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const pick = (f?: File | null) => { if (f) set({ _file: f, _preview: URL.createObjectURL(f), _removeImage: false }); };
  const preview = d._preview ?? (d._removeImage ? null : productImageUrl(d.image_path));

  const save = async () => {
    if (!d.name?.trim()) return toast.error("모델명(품명)을 입력하세요");
    setSaving(true);
    try {
      const payload = {
        name: d.name.trim(), spec: d.spec?.trim() || null, unit_price: Number(d.unit_price) || 0,
        machine_group: d.machine_group || groupOf({ name: d.name, category: d.category ?? null }),
        category: d.category?.trim() || null, brand: d.brand?.trim() || null,
        highlights: d.highlights?.trim() || null, description: d.description?.trim() || null,
        notes: d.notes?.trim() || null, is_active: d.is_active ?? true, sort_order: Number(d.sort_order) || 0,
      };
      let id = d.id;
      if (id) {
        const { error } = await db.from("quote_products").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await db.from("quote_products").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      const old = d.image_path;
      if (d._file) {
        const path = await uploadProductImage(d._file, id!);
        await db.from("quote_products").update({ image_path: path }).eq("id", id);
        if (old) await supabase.storage.from(PRODUCT_BUCKET).remove([old]);
      } else if (d._removeImage && old) {
        await db.from("quote_products").update({ image_path: null }).eq("id", id);
        await supabase.storage.from(PRODUCT_BUCKET).remove([old]);
      }
      toast.success("저장했어요");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!draft} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader><DialogTitle>{d.id ? "제품 수정" : "제품 추가"}</DialogTitle></DialogHeader>
        <div className="space-y-4 min-w-0">
          <div className="space-y-2">
            <Label>사진</Label>
            <div className="relative aspect-[4/3] rounded-2xl border border-dashed bg-muted/40 overflow-hidden flex items-center justify-center">
              {preview ? <img src={preview} alt="" className="absolute inset-0 w-full h-full object-contain p-2" /> : <ImagePlus className="h-10 w-10 text-muted-foreground/40" />}
              {preview && (
                <button type="button" onClick={() => set({ _file: null, _preview: null, _removeImage: true })} className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/90 flex items-center justify-center" aria-label="사진 빼기">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" />사진 고르기</Button>
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => camRef.current?.click()}><Camera className="h-4 w-4" />사진 찍기</Button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>

          <div className="space-y-1.5">
            <Label>종류</Label>
            <div className="flex flex-wrap gap-1.5">
              {MACHINE_GROUPS.map((g) => {
                const on = (d.machine_group || (d.name ? groupOf({ name: d.name, category: d.category ?? null }) : "")) === g;
                return (
                  <button key={g} type="button" onClick={() => set({ machine_group: g })} aria-pressed={on}
                    className={cn("h-9 px-3 rounded-full border text-sm", on ? "border-primary bg-primary/10 text-primary font-semibold" : "text-muted-foreground")}>{g}</button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>세부 분류</Label>
              <Input list="product-categories" value={d.category ?? ""} onChange={(e) => set({ category: e.target.value })} placeholder="예: 자탈형 콤바인" />
              <datalist id="product-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="space-y-1.5"><Label>제조사</Label><Input value={d.brand ?? ""} onChange={(e) => set({ brand: e.target.value })} placeholder="얀마" /></div>
          </div>
          <div className="space-y-1.5"><Label>모델명 (품명) *</Label><Input value={d.name ?? ""} onChange={(e) => set({ name: e.target.value })} placeholder="예: YT5113A" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>규격</Label><Input value={d.spec ?? ""} onChange={(e) => set({ spec: e.target.value })} placeholder="예: 113마력, 6조" /></div>
            <div className="space-y-1.5"><Label>견적 기준가 (원)</Label><Input inputMode="numeric" value={d.unit_price ?? ""} onChange={(e) => set({ unit_price: Number(e.target.value.replace(/\D/g, "")) })} /></div>
          </div>
          <div className="space-y-1.5"><Label>주요 사양 <span className="text-muted-foreground font-normal">(한 줄에 하나)</span></Label>
            <Textarea rows={4} value={d.highlights ?? ""} onChange={(e) => set({ highlights: e.target.value })} placeholder={"엔진 4TNV98C 113마력\n캐빈·에어컨 기본\n자동 수평 제어"} />
          </div>
          <div className="space-y-1.5"><Label>설명</Label><Textarea rows={3} value={d.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>메모 (내부용)</Label><Input value={d.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>정렬 순서</Label><Input inputMode="numeric" value={d.sort_order ?? 0} onChange={(e) => set({ sort_order: Number(e.target.value.replace(/\D/g, "")) })} /></div>
          </div>
          <label className="flex items-center justify-between rounded-2xl border p-3"><span className="text-sm font-medium">견적에서 고를 수 있게 (판매 중)</span><Switch checked={d.is_active ?? true} onCheckedChange={(v) => set({ is_active: v })} /></label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />}저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function QuoteProducts() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuoteProducts();
  const [detail, setDetail] = useState<QuoteProduct | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const reload = () => qc.invalidateQueries({ queryKey: ["quote-products"] });
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean) as string[])].sort();

  const remove = async (p: QuoteProduct) => {
    if (!confirm(`「${p.name}」을(를) 지울까요? 이미 만든 견적서에는 그대로 남아요.`)) return;
    const { error } = await db.from("quote_products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    if (p.image_path) await supabase.storage.from(PRODUCT_BUCKET).remove([p.image_path]);
    setDetail(null);
    reload();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="제품 카탈로그"
        sub={`견적서에 넣는 농기계·작업기 ${items.length}종 · 사진과 주요 사양을 함께 관리`}
        actions={
          <>
            <ProductBulkUpload onDone={reload} />
            <Button className="h-11 rounded-full px-5" onClick={() => setDraft({ is_active: true, brand: "얀마" })}><Plus className="w-4 h-4 mr-1" /> 제품 추가</Button>
          </>
        }
      />
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-64 rounded-3xl" />)}</div>
      ) : (
        <ProductGrid products={items} onOpen={setDetail} />
      )}
      <ProductDetail p={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)}
        footer={detail && (
          <>
            <Button variant="outline" className="text-destructive gap-1.5" onClick={() => remove(detail)}><Trash2 className="h-4 w-4" />삭제</Button>
            <Button className="flex-1 gap-1.5" onClick={() => { setDraft(detail); setDetail(null); }}><Pencil className="h-4 w-4" />수정</Button>
          </>
        )} />
      <ProductEditDialog draft={draft} onClose={() => setDraft(null)} categories={categories} onSaved={reload} />
    </div>
  );
}
