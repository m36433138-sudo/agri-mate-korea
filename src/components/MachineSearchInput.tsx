import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface MachineResult {
  id: string;
  model_name: string;
  serial_number: string;
  manufacturer: string | null;
}

interface Props {
  value: string;
  customerId?: string | null;  // 고객 ID → 해당 고객 보유 기계만 표시
  onChange: (modelName: string) => void;
  onSelect?: (machine: MachineResult) => void;
  placeholder?: string;
  className?: string;
}

export function MachineSearchInput({ value, customerId, onChange, onSelect, placeholder = "기계 검색 또는 직접 입력", className }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: machines = [] } = useQuery({
    queryKey: ["machines-by-customer", customerId ?? "all"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("machines")
        .select("id, model_name, serial_number, manufacturer")
        .order("model_name");
      if (customerId) q = q.eq("customer_id", customerId);
      const { data, error } = await q;
      if (error) throw error;
      return data as MachineResult[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const filtered = search.trim()
    ? machines.filter(m =>
        m.model_name.toLowerCase().includes(search.toLowerCase()) ||
        (m.serial_number || "").toLowerCase().includes(search.toLowerCase())
      ).slice(0, 10)
    : machines.slice(0, 10);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (m: MachineResult) => {
    onChange(m.model_name);
    setSearch("");
    setOpen(false);
    onSelect?.(m);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className || ""}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={open ? search : value}
          onChange={e => {
            if (!open) { setOpen(true); setSearch(e.target.value); }
            else { setSearch(e.target.value); }
            onChange(e.target.value);
          }}
          onFocus={() => setOpen(true)}
          placeholder={customerId ? "보유 기계 선택 또는 직접 입력" : placeholder}
          className="pl-8 pr-8"
        />
        {value && (
          <button type="button" onClick={() => { onChange(""); setSearch(""); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 text-center">
              {search ? "검색 결과 없음 (직접 입력 가능)" : customerId ? "보유 기계 없음 (직접 입력 가능)" : "등록된 기계가 없습니다"}
            </p>
          ) : (
            filtered.map(m => (
              <button key={m.id} type="button" onClick={() => handleSelect(m)}
                className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors text-sm flex items-center gap-2">
                <span className="font-medium">{m.model_name}</span>
                {m.serial_number && <span className="text-xs text-muted-foreground ml-auto">{m.serial_number}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
