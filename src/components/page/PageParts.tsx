import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 페이지 머리말: 큰 제목 + 한 줄 요약 + 오른쪽 버튼들 */
export function PageHeader({ title, sub, actions, className }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

/** 큰 검색칸 (지우기 버튼 포함) */
export function SearchField({
  value, onChange, placeholder, className,
}: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cn("relative flex-1", className)}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-10 h-11 rounded-xl bg-card"
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="검색어 지우기"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-foreground/[0.06]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** 목록을 나눠 그릴 때 아래쪽 「더 보기」 */
export function ShowMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (total <= shown) return null;
  return (
    <Button variant="outline" className="w-full h-12 rounded-2xl bg-card" onClick={onMore}>
      더 보기 ({shown.toLocaleString("ko-KR")} / {total.toLocaleString("ko-KR")})
    </Button>
  );
}

/** 알약 모양 선택 버튼 묶음 */
export function Segmented<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div className="flex items-center h-11 shrink-0 rounded-xl bg-muted p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 px-3.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
