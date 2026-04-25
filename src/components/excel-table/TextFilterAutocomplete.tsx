import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** 데이터에서 추출한 distinct 후보값 */
  suggestions: string[];
  placeholder?: string;
}

export default function TextFilterAutocomplete({ value, onChange, suggestions, placeholder = "필터..." }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 입력값으로 필터링 — 대소문자 무시, 부분일치, 빈 값이면 상위 8개 노출
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 8);
    const starts: string[] = [];
    const contains: string[] = [];
    for (const s of suggestions) {
      const sl = s.toLowerCase();
      if (sl === q) continue;
      if (sl.startsWith(q)) starts.push(s);
      else if (sl.includes(q)) contains.push(s);
      if (starts.length + contains.length >= 30) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }, [value, suggestions]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const select = (s: string) => {
    onChange(s);
    setOpen(false);
    setActiveIdx(-1);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0 && filtered[activeIdx]) {
      e.preventDefault();
      select(filtered[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <Input
        value={value ?? ""}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIdx(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        className="h-7 text-xs px-2"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-md border border-border/60 bg-popover shadow-md">
          {filtered.map((s, i) => (
            <button
              key={s + i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(s); }}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn(
                "w-full text-left px-2 py-1 text-xs truncate",
                i === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              )}
            >
              {highlight(s, value)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-primary">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}
