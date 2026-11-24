import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CalendarCheck, Check, MapPin, MoreHorizontal, Navigation, Pause, Pencil, Phone, Play, RotateCcw, Tractor } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OnsiteVisit, VisitInput, VisitStatus } from "@/lib/onsiteVisits";
import { navLinks } from "@/lib/onsiteRoute";

export const STATUS_STYLE: Record<VisitStatus, { dot: string; pill: string; bar: string }> = {
  대기: { dot: "bg-slate-400", pill: "bg-slate-500/15 text-slate-700 dark:text-slate-300", bar: "#94a3b8" },
  진행중: { dot: "bg-blue-500", pill: "bg-blue-500/15 text-blue-700 dark:text-blue-300", bar: "#3b82f6" },
  보류: { dot: "bg-amber-500", pill: "bg-amber-500/15 text-amber-700 dark:text-amber-300", bar: "#d97706" },
  완료: { dot: "bg-emerald-500", pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", bar: "#16a34a" },
};

export const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/** 「오늘」, 「내일」, 「3일 지남」, 「11/25」 */
export function dayLabel(iso: string, today = kstToday()): { text: string; tone: "late" | "today" | "soon" | "later" } {
  const d = Math.round((Date.parse(iso) - Date.parse(today)) / 86_400_000);
  if (d < 0) return { text: `${-d}일 지남`, tone: "late" };
  if (d === 0) return { text: "오늘", tone: "today" };
  if (d === 1) return { text: "내일", tone: "soon" };
  const [, m, day] = iso.split("-");
  return { text: `${Number(m)}/${Number(day)}`, tone: "later" };
}

const TONE = {
  late: "bg-red-500/15 text-red-700 dark:text-red-300",
  today: "bg-primary/15 text-primary",
  soon: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  later: "bg-muted text-muted-foreground",
};

export function isUrgent(p: string | null) {
  return !!p && /급|빨리|오늘/.test(p);
}

type Props = {
  visit: OnsiteVisit;
  canManage: boolean;
  order?: { no: number; km: number };
  onEdit: (v: OnsiteVisit) => void;
  onPatch: (v: OnsiteVisit, change: Partial<VisitInput>) => void;
};

export function VisitCard({ visit: v, canManage, order, onEdit, onPatch }: Props) {
  const [open, setOpen] = useState(false);
  const st = STATUS_STYLE[v.status];
  const links = navLinks(v);
  const today = kstToday();
  const plannedToday = v.scheduled_on === today;
  const setStatus = (status: VisitStatus) => onPatch(v, { status, completed_on: status === "완료" ? today : null });

  return (
    <div className="bg-card rounded-3xl card-shadow border border-border/70 overflow-hidden min-w-0" style={{ boxShadow: `inset 0 3px 0 ${st.bar}` }}>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-1.5">
         <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {order && <span className="h-6 min-w-6 px-1.5 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">{order.no}</span>}
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full", st.pill)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />{v.status}
          </span>
          {v.category && v.status !== "완료" && <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">{v.category}</span>}
          {v.priority && (
            <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", isUrgent(v.priority) ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-muted text-muted-foreground")}>{v.priority}</span>
          )}
          {v.scheduled_on && v.status !== "완료" && (() => { const l = dayLabel(v.scheduled_on, today); return <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", TONE[l.tone])}>📅 {l.text}</span>; })()}
          {v.status === "완료" && v.completed_on && <span className="text-xs text-muted-foreground">{v.completed_on.slice(5).replace("-", "/")} 완료</span>}
         </div>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 -mr-1 rounded-full flex items-center justify-center text-muted-foreground hover:bg-foreground/[0.06]" aria-label="더 보기">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(v)}><Pencil className="h-4 w-4 mr-2" />수정</DropdownMenuItem>
                <DropdownMenuSeparator />
                {v.status !== "보류" && <DropdownMenuItem onClick={() => setStatus("보류")}><Pause className="h-4 w-4 mr-2" />보류</DropdownMenuItem>}
                {v.status !== "대기" && <DropdownMenuItem onClick={() => setStatus("대기")}><RotateCcw className="h-4 w-4 mr-2" />대기로 되돌리기</DropdownMenuItem>}
                {v.scheduled_on && <DropdownMenuItem onClick={() => onPatch(v, { scheduled_on: null })}>일정 빼기</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xl font-extrabold tracking-tight truncate leading-tight">{v.customer_name}</p>
            {(v.branch || v.technician) && <p className="text-xs text-muted-foreground mt-0.5 truncate">{[v.branch, v.technician && `기사 ${v.technician}`].filter(Boolean).join(" · ")}</p>}
          </div>
          {v.phone && (
            <a href={`tel:${v.phone}`} className="h-11 shrink-0 rounded-full px-3.5 flex items-center gap-1.5 text-primary bg-primary/10 hover:bg-primary/15 text-sm font-semibold tabular-nums" aria-label={`${v.customer_name}에게 전화`}>
              <Phone className="h-4 w-4" /><span className="hidden min-[380px]:inline">{v.phone}</span>
            </a>
          )}
        </div>

        {(v.machine || v.model) && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tractor className="h-4 w-4 text-muted-foreground shrink-0" />
            {v.machine && <span className="rounded-full px-2.5 py-0.5 text-sm font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{v.machine}</span>}
            {v.model && <span className="text-base font-semibold">{v.model}</span>}
          </div>
        )}

        {v.address && (
          <div className="flex items-start gap-2">
            <MapPin className={cn("h-4 w-4 shrink-0 mt-0.5", v.lat ? "text-primary" : "text-muted-foreground")} />
            <span className="text-sm leading-snug flex-1 min-w-0">{v.address}{order ? <span className="text-muted-foreground"> · {order.km < 1 ? "1km 안" : `약 ${Math.round(order.km)}km`}</span> : null}</span>
          </div>
        )}

        {v.detail && (
          <button type="button" onClick={() => setOpen((o) => !o)} className={cn("block w-full text-left rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap", !open && "line-clamp-3")}>
            {v.detail}
          </button>
        )}

        {v.address && (
          <DropdownMenu>
            <div className="flex">
              <Button asChild className="flex-1 rounded-l-full rounded-r-none h-11 gap-1.5">
                <a href={links.kakao} target="_blank" rel="noreferrer"><Navigation className="h-4 w-4" />길찾기 (카카오맵)</a>
              </Button>
              <DropdownMenuTrigger asChild>
                <Button className="h-11 w-11 px-0 rounded-r-full rounded-l-none border-l border-primary-foreground/25" aria-label="다른 지도 앱으로 길찾기">▾</Button>
              </DropdownMenuTrigger>
            </div>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><a href={links.kakao} target="_blank" rel="noreferrer">카카오맵</a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={links.tmap}>티맵</a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={links.naver} target="_blank" rel="noreferrer">네이버 지도</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {canManage && v.status !== "완료" && (
          <div className="grid grid-cols-3 gap-2">
            <Button variant={plannedToday ? "secondary" : "outline"} className={cn("h-11 rounded-full px-2 gap-1.5", plannedToday && "ring-1 ring-primary/40 text-primary")} aria-pressed={plannedToday}
              onClick={() => onPatch(v, { scheduled_on: plannedToday ? null : today })}>
              <CalendarCheck className="h-4 w-4 shrink-0" />{plannedToday ? "오늘 감" : "오늘 가기"}
            </Button>
            <Button variant="outline" className="h-11 rounded-full px-2 gap-1.5" disabled={v.status === "진행중"} onClick={() => setStatus("진행중")}>
              <Play className="h-4 w-4 shrink-0" />{v.status === "진행중" ? "진행 중" : "시작"}
            </Button>
            <Button variant="outline" className="h-11 rounded-full px-2 gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-500/40" onClick={() => setStatus("완료")}>
              <Check className="h-4 w-4 shrink-0" />완료
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
