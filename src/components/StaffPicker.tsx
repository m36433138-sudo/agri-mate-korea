import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Plus, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitNames, useStaffDirectory } from "@/hooks/useTechnicians";

/**
 * 담당자 고르기: 직원·관리자 누구나(팀별로 묶어 보여 줌) + 목록에 없는 이름 직접 입력.
 * multiple 이면 여러 명을 「김영일, 마성수」로 저장한다.
 */
export function StaffPicker({ value, onChange, multiple = false, placeholder = "담당자 선택", className }: {
  value: string;
  onChange: (v: string) => void;
  multiple?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const { data: staff = [], isLoading } = useStaffDirectory();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const chosen = splitNames(value);

  const groups = useMemo(() => {
    const m = new Map<string, typeof staff>();
    for (const s of staff) {
      const g = s.is_admin && !s.team ? "관리자" : s.team || "기타";
      m.set(g, [...(m.get(g) ?? []), s]);
    }
    const order = ["기사팀", "사무팀", "영업팀", "관리자"];
    return [...m.entries()].sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99));
  }, [staff]);

  const toggle = (name: string) => {
    if (!multiple) { onChange(chosen[0] === name ? "" : name); setOpen(false); return; }
    const next = chosen.includes(name) ? chosen.filter((n) => n !== name) : [...chosen, name];
    onChange(next.join(", "));
  };
  const addTyped = () => {
    const n = typed.trim();
    if (!n) return;
    if (multiple) onChange([...new Set([...chosen, n])].join(", ")); else { onChange(n); setOpen(false); }
    setTyped("");
  };
  const unknown = chosen.filter((n) => !staff.some((s) => s.name === n));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("w-full justify-between font-normal h-10 px-3", !chosen.length && "text-muted-foreground", className)}>
          <span className="truncate flex items-center gap-1.5"><UserRound className="h-4 w-4 shrink-0 opacity-60" />{chosen.length ? chosen.join(", ") : placeholder}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,340px)] p-0" align="start">
        <div className="max-h-[50vh] overflow-y-auto p-2 space-y-2">
          {isLoading && <p className="text-xs text-muted-foreground p-2">불러오는 중…</p>}
          {groups.map(([g, list]) => (
            <div key={g}>
              <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">{g}</p>
              <div className="grid grid-cols-2 gap-1">
                {list.map((s) => {
                  const on = chosen.includes(s.name);
                  return (
                    <button key={s.id} type="button" onClick={() => toggle(s.name)} aria-pressed={on}
                      className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-left", on ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted")}>
                      <span className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0", on ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40")}>
                        {on && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="truncate">{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {unknown.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">직접 입력한 이름</p>
              <div className="flex flex-wrap gap-1 px-1">
                {unknown.map((n) => (
                  <span key={n} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">{n}
                    <button type="button" onClick={() => toggle(n)} aria-label={`${n} 빼기`}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="border-t p-2 flex gap-1.5">
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="목록에 없으면 이름 입력" className="h-9"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTyped(); } }} />
          <Button type="button" size="sm" className="h-9 gap-1 shrink-0" onClick={addTyped} disabled={!typed.trim()}><Plus className="h-4 w-4" />추가</Button>
        </div>
        {chosen.length > 0 && (
          <div className="border-t p-2"><Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { onChange(""); setOpen(false); }}>지정 안 함</Button></div>
        )}
      </PopoverContent>
    </Popover>
  );
}
