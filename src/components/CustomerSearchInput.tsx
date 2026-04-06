import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import type { Customer } from "@/types/database";

interface Props {
  value: string;
  onChange: (name: string) => void;
  onSelect?: (customer: Customer) => void;
  placeholder?: string;
  className?: string;
}

export function CustomerSearchInput({ value, onChange, onSelect, placeholder = "고객 검색 또는 직접 입력", className }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-search"],
    queryFn: async () => {
      const all: Customer[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from("customers").select("*").order("name").range(from, from + PAGE - 1);
        if (error) throw error;
        all.push(...(data as Customer[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
    staleTime: 1000 * 60 * 2,
  });

  const filtered = search.trim()
    ? customers.filter(c =>
        c.name.includes(search) || c.phone?.includes(search) || c.address?.includes(search)
      ).slice(0, 10)
    : customers.slice(0, 10);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (c: Customer) => {
    onChange(c.name);
    setSearch("");
    setOpen(false);
    onSelect?.(c);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className || ""}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={open ? search : value}
          onChange={e => {
            if (!open) {
              setOpen(true);
              setSearch(e.target.value);
            } else {
              setSearch(e.target.value);
            }
            onChange(e.target.value);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-8 pr-8"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); setSearch(""); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 text-center">
              {search ? "검색 결과 없음 (직접 입력 가능)" : "등록된 고객이 없습니다"}
            </p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors text-sm flex items-center gap-2"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.phone}</span>
                {c.address && <span className="text-xs text-muted-foreground truncate ml-auto">{c.address}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
