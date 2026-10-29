import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Tractor, Users, Wrench, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useGlobalSearch, type SearchResult as Result } from "@/hooks/useGlobalSearch";

const CATEGORY_META = {
  machine: { label: "기계", icon: Tractor },
  customer: { label: "고객", icon: Users },
  repair: { label: "수리이력", icon: Wrench },
  part: { label: "부품", icon: Package },
} as const;

const CATEGORIES = ["machine", "customer", "repair", "part"] as const;

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const { results, pending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useGlobalSearch(query);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const flatResults = CATEGORIES.flatMap((cat) => results.filter((r) => r.category === cat));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setActiveIndex(-1); }, [query]);

  const pick = useCallback((r: Result) => {
    const link = r.category === 'part'
      ? `/parts?search=${encodeURIComponent(r.link.split('?search=')[1] ?? '')}` : r.link;
    navigate(link);
    setQuery("");
    setOpen(false);
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!open || flatResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(flatResults[activeIndex >= 0 ? activeIndex : 0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }, [open, flatResults, activeIndex, pick]);

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    (acc[r.category] ||= []).push(r);
    return acc;
  }, {});

  let flatIndex = 0;

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(!!e.target.value.trim()); }}
        onFocus={() => query.trim() && setOpen(true)}
        aria-label="통합 검색"
        role="combobox"
        aria-expanded={open}
        onKeyDown={handleKeyDown}
        placeholder="검색 (기계, 고객, 수리, 부품)"
        className="pl-9 h-9 bg-background border-border"
      />

      {open && (
        <div ref={listRef} className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 overflow-hidden max-h-80 overflow-y-auto">
          {pending && <div className="p-3 text-sm text-muted-foreground" role="status">검색 중…</div>}
          {isError && <div className="p-3 text-sm text-destructive" role="alert">검색을 불러오지 못했습니다.<Button variant="ghost" size="sm" onClick={() => refetch()}>다시 시도</Button></div>}
          {!pending && !isError && !results.length && <div className="p-3 text-sm text-muted-foreground">검색 결과가 없습니다.</div>}
          {CATEGORIES.map((cat) => {
            const items = grouped[cat];
            if (!items?.length) return null;
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            return (
              <div key={cat}>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5 bg-muted/50">
                  <Icon className="h-3.5 w-3.5" /> {meta.label}
                </div>
                {items.map((r) => {
                  const idx = flatIndex++;
                  return (
                    <Button
                      variant="ghost"
                      key={r.id}
                      data-index={idx}
                      onClick={() => pick(r)}
                      className={`w-full h-auto items-start whitespace-normal text-left px-3 py-2 text-sm flex flex-col gap-0 transition-colors ${
                        idx === activeIndex ? "bg-accent" : "hover:bg-accent"
                      }`}
                    >
                      <span className="w-full font-medium text-foreground truncate">{r.label}</span>
                      <span className="w-full text-xs text-muted-foreground truncate">{r.sub}</span>
                    </Button>
                  );
                })}
              </div>
            );
          })}
          {hasNextPage && <Button variant="ghost" className="w-full" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>{isFetchingNextPage ? '불러오는 중…' : '결과 더 보기'}</Button>}
        </div>
      )}
    </div>
  );
}
