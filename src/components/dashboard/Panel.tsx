import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** 대시보드 구역 카드: 제목 + (선택) 전체보기 링크 */
export function Panel({
  title,
  badge,
  to,
  linkLabel = "전체보기",
  className,
  bodyClassName,
  children,
}: {
  title: string;
  badge?: ReactNode;
  to?: string;
  linkLabel?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-3xl bg-card border border-border/70 card-shadow overflow-hidden", className)}>
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h2 className="text-[17px] font-bold tracking-tight flex items-center gap-2">
          {title}
          {badge}
        </h2>
        {to && (
          <Link to={to} className="text-[13px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-0.5">
            {linkLabel} <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className={cn("px-2 pb-3", bodyClassName)}>{children}</div>
    </section>
  );
}
