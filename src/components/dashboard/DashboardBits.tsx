import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Send, Sparkles, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** 전월 대비 변화 칩 (+8.4% 초록 / -6.2% 빨강) */
export function DeltaChip({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct == null) return null;
  const good = invert ? pct < 0 : pct >= 0;
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 h-6 px-2 rounded-full text-xs font-bold tabular-nums",
        good ? "bg-up/15 text-up" : "bg-down/15 text-down",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      {pct > 0 ? "+" : ""}{pct}%
    </span>
  );
}

export function KpiCard({
  label, icon: Icon, value, unit, chip, sub, to, loading, warn,
}: {
  label: string; icon: LucideIcon; value: ReactNode; unit?: string; chip?: ReactNode; sub?: string;
  to: string; loading?: boolean; warn?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group rounded-3xl bg-card border border-border/70 card-shadow p-4 sm:p-5 flex flex-col gap-3 hover:border-foreground/20 transition-colors min-w-0"
    >
      <div className="flex items-center gap-2.5">
        <span className={cn(
          "hidden sm:flex w-9 h-9 rounded-full items-center justify-center shrink-0",
          warn ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-foreground/[0.06] text-foreground/80",
        )}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="text-[13px] sm:text-sm font-medium text-muted-foreground truncate">{label}</span>
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {loading ? (
        <Skeleton className="h-9 w-28 rounded-lg" />
      ) : (
        <div className="flex items-end justify-between gap-2 flex-wrap">
          <p className="flex items-baseline gap-1 min-w-0">
            <span className={cn("text-[26px] sm:text-[32px] leading-none font-extrabold tracking-tight tabular-nums",
              warn && "text-amber-600 dark:text-amber-400")}>{value}</span>
            {unit && <span className="text-sm font-semibold text-muted-foreground">{unit}</span>}
          </p>
          {chip}
        </div>
      )}
      {sub && <p className="text-xs text-muted-foreground truncate -mt-1">{sub}</p>}
    </Link>
  );
}

/** AI 상담 카드: 예시 질문을 누르거나 적으면 AI 어시스턴트 화면 입력칸에 채워 연다 */
export function AiAssistantCard({ suggestions, className }: { suggestions: string[]; className?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const go = (text: string) => navigate(`/chat${text.trim() ? `?q=${encodeURIComponent(text.trim())}` : ""}`);
  return (
    <section className={cn("ai-gradient relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white flex flex-col card-shadow", className)}>
      <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="flex items-center gap-2 text-sm font-medium text-white/80">
        <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center"><Sparkles className="h-4 w-4" /></span>
        AI 어시스턴트
      </div>
      <h2 className="mt-5 text-xl sm:text-2xl font-extrabold leading-snug text-center">무엇을 도와드릴까요?</h2>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go(s)}
            className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-medium transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
      <form
        className="mt-auto pt-5"
        onSubmit={(e) => { e.preventDefault(); go(q); }}
      >
        <div className="flex items-center h-12 rounded-full bg-black/20 border border-white/20 pl-5 pr-1.5 focus-within:border-white/50">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="무엇이든 물어보세요…"
            className="flex-1 min-w-0 bg-transparent text-sm placeholder:text-white/60 outline-none"
            aria-label="AI에게 물어보기"
          />
          <button type="submit" aria-label="AI 화면으로 보내기" className="w-9 h-9 rounded-full bg-white text-[hsl(var(--ai-to))] flex items-center justify-center hover:scale-105 transition-transform">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </section>
  );
}

/** 이번 달 기사별 수리 건수 막대 */
export function TechnicianLoad({ items, loading }: { items: { name: string; count: number }[]; loading?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  const colors = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4"];
  if (loading) return <div className="space-y-3 px-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 rounded-lg" />)}</div>;
  if (!items.length) return <p className="text-sm text-muted-foreground text-center py-10">이번 달 수리가 아직 없어요.</p>;
  return (
    <ul className="space-y-3.5 px-3 pt-1">
      {items.slice(0, 6).map((t, i) => (
        <li key={t.name}>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="font-medium">{t.name}</span>
            <span className="tabular-nums text-muted-foreground"><b className="text-foreground">{t.count}</b>건</span>
          </div>
          <div className="h-2.5 rounded-full bg-foreground/[0.06] overflow-hidden">
            <div className={cn("h-full rounded-full", colors[i % colors.length])} style={{ width: `${(t.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
