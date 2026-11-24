import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProductImage } from "@/components/quotes/ProductGrid";
import { won, type QuoteProduct } from "@/lib/quoteTypes";
import { groupOf } from "@/lib/productCatalog";

const db = supabase as any;

export function useQuoteProducts() {
  return useQuery<QuoteProduct[]>({
    queryKey: ["quote-products"],
    queryFn: async () => {
      const { data, error } = await db.from("quote_products").select("*").order("sort_order").order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

/** 제품 한 개 크게 보기: 사진, 주요 사양, 설명, 가격 */
export function ProductDetail({ p, open, onOpenChange, footer }: { p: QuoteProduct | null; open: boolean; onOpenChange: (v: boolean) => void; footer?: React.ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        {p && (
          <div className="flex flex-col min-h-full">
            <ProductImage p={p} className="aspect-[4/3] w-full" />
            <div className="p-5 space-y-4 flex-1">
              <SheetHeader className="text-left space-y-1">
                <p className="text-xs text-muted-foreground">{[groupOf(p), p.category, p.brand].filter(Boolean).join(" · ")}</p>
                <SheetTitle className="text-2xl font-extrabold">{p.name}</SheetTitle>
                {p.spec && p.spec !== p.category && <p className="text-sm text-muted-foreground">{p.spec}</p>}
              </SheetHeader>
              <p className="text-2xl font-extrabold tabular-nums">{won(p.unit_price)} <span className="text-xs font-medium text-muted-foreground">견적 기준가</span></p>
              {p.highlights && (
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">주요 사양</p>
                  <ul className="space-y-1.5 text-sm">
                    {p.highlights.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => (
                      <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{l}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {p.description && <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.description}</p>}
              {p.notes && <p className="text-xs text-muted-foreground">메모: {p.notes}</p>}
            </div>
            {footer && <div className="sticky bottom-0 border-t bg-background p-4 flex gap-2">{footer}</div>}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

