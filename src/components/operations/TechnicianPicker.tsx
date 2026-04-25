import { TECHNICIANS } from "@/lib/priority";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTechnicianColor } from "@/types/operations";

interface Props {
  value: string;
  onChange: (next: string) => void;
  size?: "sm" | "md";
  stopPropagation?: boolean;
  options?: readonly string[];
  disabled?: boolean;
}

export function TechnicianPicker({
  value, onChange, size = "sm", stopPropagation, options, disabled,
}: Props) {
  const list = options ?? TECHNICIANS;
  const px = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  const color = value ? getTechnicianColor(value) : "#475569";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        onClick={e => { if (stopPropagation) e.stopPropagation(); }}
      >
        <button
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1 rounded-md ring-1 ring-inset font-semibold whitespace-nowrap",
            value ? "text-foreground" : "text-muted-foreground",
            "ring-border/60 bg-card hover:bg-muted/40",
            px,
            disabled && "opacity-50 cursor-not-allowed",
          )}
          title={value ? `담당: ${value}` : "기사 미배정"}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: value ? color : "#94a3b8" }}
          />
          {value || "미배정"}
          {!disabled && <ChevronDown className="h-3 w-3 opacity-60" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={e => { if (stopPropagation) e.stopPropagation(); }}>
        {list.map(name => (
          <DropdownMenuItem
            key={name}
            onClick={(e) => { if (stopPropagation) e.stopPropagation(); onChange(name); }}
            className="gap-2"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: getTechnicianColor(name) }}
            />
            <span className={name === value ? "font-bold" : ""}>{name}</span>
          </DropdownMenuItem>
        ))}
        {value && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => { if (stopPropagation) e.stopPropagation(); onChange(""); }}
              className="gap-2 text-muted-foreground"
            >
              <X className="h-3 w-3" /> 배정 해제
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
