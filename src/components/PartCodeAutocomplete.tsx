import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search } from "lucide-react";

type InventoryItem = {
  id: string;
  part_code: string;
  part_name: string;
  quantity: number;
  branch: string;
};

type Props = {
  branch?: string;
  onSelect: (item: InventoryItem) => void;
  placeholder?: string;
};

export default function PartCodeAutocomplete({ branch = "장흥", onSelect, placeholder = "부품번호 입력 (3자리 이상)..." }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["inventory-search", search, branch],
    enabled: search.length >= 3,
    queryFn: async () => {
      const like = `%${search}%`;
      const { data, error } = await supabase
        .from("inventory")
        .select("id, part_code, part_name, quantity, branch")
        .eq("branch", branch)
        .or(`part_code.ilike.${like},part_name.ilike.${like}`)
        .order("part_code")
        .limit(15);
      if (error) throw error;
      return data as InventoryItem[];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (search.length >= 3 && results.length > 0) {
      setOpen(true);
    }
  }, [results, search]);

  const handleSelect = (item: InventoryItem) => {
    onSelect(item);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            onFocus={() => search.length >= 3 && results.length > 0 && setOpen(true)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command>
          <CommandList>
            <CommandEmpty>
              {search.length < 3 ? "3자리 이상 입력해주세요" : isFetching ? "검색 중..." : "부품을 찾을 수 없습니다"}
            </CommandEmpty>
            <CommandGroup>
              {results.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.part_code}
                  onSelect={() => handleSelect(item)}
                  className="cursor-pointer"
                >
                  <div className="flex-1">
                    <span className="font-mono text-xs text-muted-foreground">[{item.part_code}]</span>{" "}
                    <span className="font-medium">{item.part_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">재고: {item.quantity}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
