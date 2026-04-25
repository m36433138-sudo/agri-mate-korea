import { PRIORITIES, PRIORITY_META, type Priority } from "@/lib/priority";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Flame, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: Priority;
  onChange: (next: Priority) => void;
  size?: "sm" | "md";
  stopPropagation?: boolean;
  disabled?: boolean;
}

export function PriorityPicker({ value, onChange, size = "sm", stopPropagation, disabled }: Props) {
  const meta = PRIORITY_META[value];
  const px = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        onClick={e => { if (stopPropagation) e.stopPropagation(); }}
      >
        <button
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1 rounded-md ring-1 ring-inset font-bold whitespace-nowrap",
            meta.badge,
            px,
            meta.pulse && "animate-pulse",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          title={`우선순위: ${meta.label}`}
        >
          {value === "긴급" && <Flame className="h-3 w-3" />}
          {meta.label}
          {!disabled && <ChevronDown className="h-3 w-3 opacity-60" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={e => { if (stopPropagation) e.stopPropagation(); }}>
        {PRIORITIES.map(p => {
          const m = PRIORITY_META[p];
          return (
            <DropdownMenuItem
              key={p}
              onClick={(e) => { if (stopPropagation) e.stopPropagation(); onChange(p); }}
              className="gap-2"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: m.color }}
              />
              <span className={p === value ? "font-bold" : ""}>{m.label}</span>
              {p === "긴급" && <Flame className="h-3 w-3 text-red-400 ml-auto" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
