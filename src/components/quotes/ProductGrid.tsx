import { useMemo, useState } from "react";
import { Wheat, Package, Sprout, Tractor, Wrench, Cog, Boxes, type LucideIcon } from "lucide-react";
import { SearchField } from "@/components/page/PageParts";
import { cn } from "@/lib/utils";
import { won } from "@/lib/quoteTypes";
import type { QuoteProduct } from "@/lib/quoteTypes";
import { MACHINE_GROUPS, groupOf, productImageUrl, searchProducts, sortProducts, type MachineGroup } from "@/lib/productCatalog";

export const GROUP_ICON: Record<MachineGroup, LucideIcon> = {
  트랙터: Tractor, 이앙기: Sprout, 콤바인: Wheat, 작업기: Cog, "관리기·방제기": Wrench, "옵션·부속": Package, 기타: Boxes,
};

export function ProductImage({ p, className }: { p: QuoteProduct; className?: string }) {
  const url = productImageUrl(p.image_path);
  const [broken, setBroken] = useState<string | null>(null);
  const Icon = GROUP_ICON[groupOf(p)];
  return (
    <div className={cn("relative bg-muted/60 overflow-hidden flex items-center justify-center", className)}>
      {url && broken !== url
        ? <img src={url} alt={p.name} loading="lazy" onError={() => setBroken(url)} className="absolute inset-0 w-full h-full object-contain p-2" />
        : <Icon className="h-10 w-10 text-muted-foreground/40" />}
    </div>
  );
}

/**
 * 제품 카드 목록: 대분류 탭 → 소분류 칩 → 검색. 카탈로그 화면과 견적 「제품 선택」이 같이 쓴다.
 */
export function ProductGrid({ products, onOpen, renderAction, showInactive = true, compact = false }: {
  products: QuoteProduct[];
  onOpen: (p: QuoteProduct) => void;
  renderAction?: (p: QuoteProduct) => React.ReactNode;
  showInactive?: boolean;
  compact?: boolean;
}) {
  const [group, setGroup] = useState<MachineGroup | "전체">("전체");
  const [cat, setCat] = useState<string>("");
  const [q, setQ] = useState("");

  const visible = useMemo(() => sortProducts(products.filter((p) => showInactive || p.is_active)), [products, showInactive]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    visible.forEach((p) => m.set(groupOf(p), (m.get(groupOf(p)) ?? 0) + 1));
    return m;
  }, [visible]);
  const inGroup = group === "전체" ? visible : visible.filter((p) => groupOf(p) === group);
  const cats = [...new Set(inGroup.map((p) => p.category).filter(Boolean) as string[])];
  const shown = searchProducts(cat ? inGroup.filter((p) => p.category === cat) : inGroup, q);

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="제품 종류">
        {(["전체", ...MACHINE_GROUPS] as const).filter((g) => g === "전체" || counts.get(g)).map((g) => {
          const Icon = g === "전체" ? Boxes : GROUP_ICON[g];
          const on = group === g;
          return (
            <button key={g} role="tab" aria-selected={on} onClick={() => { setGroup(g); setCat(""); }}
              className={cn("shrink-0 h-10 px-3.5 rounded-full border text-sm font-medium flex items-center gap-1.5 transition-colors",
                on ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4" />{g}<span className={cn("text-xs tabular-nums", on ? "opacity-70" : "opacity-60")}>{g === "전체" ? visible.length : counts.get(g)}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="모델명, 사양, 분류로 찾기" className="flex-1 min-w-[200px] max-w-md" />
        {cats.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(cat === c ? "" : c)} aria-pressed={cat === c}
                className={cn("h-8 px-3 rounded-full border text-xs", cat === c ? "border-primary bg-primary/10 text-primary font-semibold" : "text-muted-foreground")}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12 rounded-3xl border border-dashed">조건에 맞는 제품이 없어요</p>
      ) : (
        <div className={cn("grid gap-3", compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5")}>
          {shown.map((p) => (
            <div key={p.id} className={cn("group rounded-3xl border border-border/70 bg-card card-shadow overflow-hidden flex flex-col min-w-0", !p.is_active && "opacity-60")}>
              <button type="button" onClick={() => onOpen(p)} className="text-left flex-1 flex flex-col">
                <ProductImage p={p} className="aspect-[4/3] w-full" />
                <div className="p-3 space-y-1 flex-1">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="truncate">{[p.brand, p.category].filter(Boolean).join(" · ")}</span>
                    {!p.is_active && <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5">판매 중지</span>}
                  </div>
                  <p className="font-bold leading-tight break-words">{p.name}</p>
                  {p.spec && p.spec !== p.category && <p className="text-xs text-muted-foreground line-clamp-1">{p.spec}</p>}
                  <p className="text-[15px] font-extrabold tabular-nums pt-0.5">{won(p.unit_price)}</p>
                </div>
              </button>
              {renderAction && <div className="px-3 pb-3">{renderAction(p)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
