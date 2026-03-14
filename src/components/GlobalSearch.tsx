import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Tractor, Users, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Result = {
  id: string;
  label: string;
  sub: string;
  category: "machine" | "customer" | "repair";
  link: string;
};

const CATEGORY_META = {
  machine: { label: "기계", icon: Tractor },
  customer: { label: "고객", icon: Users },
  repair: { label: "수리이력", icon: Wrench },
} as const;

const CATEGORIES = ["machine", "customer", "repair"] as const;

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flat ordered list for keyboard nav
  const flatResults = CATEGORIES.flatMap((cat) => results.filter((r) => r.category === cat));

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset active index when results change
  useEffect(() => { setActiveIndex(-1); }, [results]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setOpen(false); return; }

    const timer = setTimeout(async () => {
      const like = `%${q}%`;

      const [machinesRes, customersRes, repairsRes] = await Promise.all([
        supabase.from("machines").select("id, model_name, serial_number").or(`model_name.ilike.${like},serial_number.ilike.${like}`).limit(5),
        supabase.from("customers").select("id, name, phone").or(`name.ilike.${like},phone.ilike.${like}`).limit(5),
        supabase.from("repair_history").select("id, machine_id, repair_content, repair_date, machines(model_name)").ilike("repair_content", like).limit(5),
      ]);

      const items: Result[] = [
        ...(machinesRes.data || []).map((m) => ({
          id: m.id, label: m.model_name, sub: m.serial_number, category: "machine" as const, link: `/machines/${m.id}`,
        })),
        ...(customersRes.data || []).map((c) => ({
          id: c.id, label: c.name, sub: c.phone, category: "customer" as const, link: `/customers/${c.id}`,
        })),
        ...(repairsRes.data || []).map((r: any) => ({
          id: r.id, label: r.repair_content, sub: `${r.repair_date} · ${r.machines?.model_name || ""}`, category: "repair" as const, link: `/machines/${r.machine_id}`,
        })),
      ];

      setResults(items);
      setOpen(items.length > 0);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const pick = useCallback((r: Result) => {
    navigate(r.link);
    setQuery("");
    setOpen(false);
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || flatResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(flatResults[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }, [open, flatResults, activeIndex, pick]);

  // Scroll active item into view
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
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="검색 (기계, 고객, 수리이력)"
        className="pl-9 h-9 bg-background border-border"
      />

      {open && (
        <div ref={listRef} className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 overflow-hidden max-h-80 overflow-y-auto">
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
                    <button
                      key={r.id}
                      data-index={idx}
                      onClick={() => pick(r)}
                      className={`w-full text-left px-3 py-2 text-sm flex flex-col transition-colors ${
                        idx === activeIndex ? "bg-accent" : "hover:bg-accent"
                      }`}
                    >
                      <span className="font-medium text-foreground truncate">{r.label}</span>
                      <span className="text-xs text-muted-foreground truncate">{r.sub}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
