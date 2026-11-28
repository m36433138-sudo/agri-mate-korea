import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { kstDate } from "@/hooks/useMyAttendance";
import {
  LEAVE_KINDS, fmtDays, leaveBalance, nextAccrual, previewDays, serviceText,
  type LeaveAdjustment, type LeaveKind, type LeaveRequest, type LeaveStatus,
} from "@/lib/hr";
import { useLeaveCalendar, useRequestLeave, type CalendarLeave } from "@/lib/hrApi";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plane } from "lucide-react";

export const STATUS_STYLE: Record<LeaveStatus, string> = {
  신청: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  승인: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  반려: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  취소: "bg-muted text-muted-foreground",
};
export const KIND_DOT: Record<LeaveKind, string> = {
  연차: "bg-sky-500", 오전반차: "bg-cyan-500", 오후반차: "bg-cyan-500", 병가: "bg-rose-500", 경조사: "bg-violet-500",
  공가: "bg-slate-500", 대체휴무: "bg-emerald-500", 무급휴가: "bg-amber-500",
};

export function StatusBadge({ s }: { s: LeaveStatus }) {
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[s])}>{s}</span>;
}

export const periodText = (s: string, e: string) => (s === e ? s : `${s} ~ ${e}`);

/** 연차 잔여 카드 */
export function LeaveBalanceCard({ joinDate, requests, adjustments, compact }: {
  joinDate: string | null; requests: LeaveRequest[]; adjustments: LeaveAdjustment[]; compact?: boolean;
}) {
  const today = kstDate();
  if (!joinDate) {
    return <p className="text-sm text-muted-foreground rounded-2xl border border-dashed p-4">입사일이 없어 연차를 계산할 수 없어요. 관리자에게 인사관리에서 입사일을 넣어 달라고 부탁해 주세요.</p>;
  }
  const b = leaveBalance(joinDate, today, requests, adjustments);
  const cells: [string, string, string?][] = [
    ["생긴 연차", fmtDays(b.entitled + b.adjusted), b.adjusted ? `조정 ${b.adjusted > 0 ? "+" : ""}${b.adjusted}` : undefined],
    ["사용", fmtDays(b.used), b.pending ? `신청 중 ${fmtDays(b.pending)}` : undefined],
    ["남은 연차", fmtDays(b.remaining)],
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {cells.map(([label, v, sub], i) => (
          <div key={label} className={cn("rounded-2xl px-3 py-2.5", i === 2 ? "bg-primary/10" : "bg-muted/50")}>
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className={cn("font-extrabold tabular-nums", compact ? "text-lg" : "text-2xl", i === 2 && "text-primary")}>{v}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        근속 {serviceText(joinDate, today)} · 연차 기간 {b.periodStart} ~ {b.periodEnd}
        {b.firstYear ? ` · 1년 미만이라 한 달마다 1일씩 생겨요 (다음 ${nextAccrual(joinDate, today)})` : ` · 다음 발생 ${nextAccrual(joinDate, today)}`}
      </p>
    </div>
  );
}

/** 휴가 신청 창 (forEmployee 를 주면 관리자가 대신 등록 → 바로 승인) */
export function LeaveRequestDialog({ open, onOpenChange, myName, forEmployee }: {
  open: boolean; onOpenChange: (v: boolean) => void; myName?: string; forEmployee?: { id: string; name: string };
}) {
  const { toast } = useToast();
  const req = useRequestLeave();
  const [kind, setKind] = useState<LeaveKind>("연차");
  const [start, setStart] = useState(kstDate());
  const [end, setEnd] = useState(kstDate());
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) { setKind("연차"); setStart(kstDate()); setEnd(kstDate()); setReason(""); } }, [open]);
  const half = kind === "오전반차" || kind === "오후반차";
  const realEnd = half ? start : end;
  const days = useMemo(() => previewDays(kind, start, realEnd), [kind, start, realEnd]);
  const problem = !start || realEnd < start ? "날짜를 확인해 주세요" : days <= 0 ? "고른 기간이 모두 주말·공휴일이에요" : null;

  const submit = () => req.mutate({ kind, start, end: realEnd, reason, employeeId: forEmployee?.id, myName }, {
    onSuccess: () => {
      toast({ title: forEmployee ? `${forEmployee.name} 휴가를 등록했어요` : "휴가를 신청했어요", description: forEmployee ? "승인된 상태로 들어가요." : "관리자가 승인하면 알림이 가요." });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "신청하지 못했어요", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !req.isPending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" /> {forEmployee ? `${forEmployee.name} 휴가 등록` : "휴가 신청"}</DialogTitle>
          <DialogDescription>{forEmployee ? "관리자가 대신 등록하면 바로 승인돼요." : "주말·공휴일은 일수에서 빠져요. 승인되면 알림이 가요."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {LEAVE_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", kind === k ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted")}>
                {k}
              </button>
            ))}
          </div>
          <div className={cn("grid gap-3", half ? "grid-cols-1" : "grid-cols-2")}>
            <div className="space-y-1.5"><Label>{half ? "날짜" : "시작"}</Label><Input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} /></div>
            {!half && <div className="space-y-1.5"><Label>끝</Label><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>}
          </div>
          <div className="space-y-1.5">
            <Label>사유 {kind === "연차" || half ? "(선택)" : ""}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={kind === "경조사" ? "예: 조부상" : kind === "병가" ? "예: 감기 몸살 (진단서 있으면 관리자에게)" : "예: 개인 사정"} />
          </div>
          <p className="text-sm rounded-2xl bg-muted/50 px-3 py-2.5">
            {problem ? <span className="text-destructive">{problem}</span> : <>모두 <b className="text-primary">{fmtDays(days)}</b>{kind === "연차" || half ? " · 연차에서 빠져요" : " · 연차에서 안 빠져요"}</>}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={req.isPending}>취소</Button>
          <Button onClick={submit} disabled={!!problem || req.isPending} className="gap-1.5">
            {req.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {forEmployee ? "등록" : "신청"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** 휴가 달력: 한 달, 날마다 쉬는 사람 이름 */
export function LeaveCalendar() {
  const today = kstDate();
  const [ym, setYm] = useState(() => today.slice(0, 7));
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const { data: list = [], isLoading } = useLeaveCalendar(`${ym}-01`, ymd(y, m, last));
  const move = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setYm(d.toISOString().slice(0, 7)); };
  const on = (ds: string) => list.filter((l: CalendarLeave) => l.start_date <= ds && l.end_date >= ds);
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];

  return (
    <section className="rounded-3xl border border-border/70 bg-card card-shadow p-4 space-y-3 min-w-0">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h2 className="font-bold flex-1">휴가 달력</h2>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => move(-1)} aria-label="이전 달"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-semibold tabular-nums w-20 text-center">{y}.{String(m).padStart(2, "0")}</span>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => move(1)} aria-label="다음 달"><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => <span key={d} className={cn(i === 0 && "text-rose-500", i === 6 && "text-sky-600")}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`b${i}`} />;
          const ds = ymd(y, m, d);
          const people = on(ds);
          const dow = (firstDow + d - 1) % 7;
          return (
            <div key={ds} className={cn("min-h-[64px] sm:min-h-[84px] rounded-xl border p-1 text-left min-w-0", ds === today ? "border-primary bg-primary/5" : "border-border/60", (dow === 0 || dow === 6) && "bg-muted/40")}>
              <p className={cn("text-[11px] font-semibold", dow === 0 && "text-rose-500", dow === 6 && "text-sky-600")}>{d}</p>
              <div className="space-y-0.5">
                {people.slice(0, 3).map((p) => (
                  <p key={p.id} title={`${p.name} ${p.kind}${p.status === "신청" ? " (승인 대기)" : ""}`}
                    className={cn("flex items-center gap-1 text-[10px] sm:text-[11px] leading-tight truncate", p.status === "신청" && "opacity-60")}>
                    <i className={cn("w-1.5 h-1.5 rounded-full shrink-0", KIND_DOT[p.kind])} />
                    <span className="truncate"><span className="sm:hidden">{p.name.slice(-2)}</span><span className="hidden sm:inline">{p.name}</span>{p.kind.includes("반차") ? "½" : ""}</span>
                  </p>
                ))}
                {people.length > 3 && <p className="text-[10px] text-muted-foreground">+{people.length - 3}</p>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {(["연차", "오전반차", "병가", "경조사", "공가", "대체휴무", "무급휴가"] as LeaveKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1"><i className={cn("w-2 h-2 rounded-full", KIND_DOT[k])} />{k === "오전반차" ? "반차(½)" : k}</span>
        ))}
        <span>흐린 이름 = 승인 대기</span>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
    </section>
  );
}
