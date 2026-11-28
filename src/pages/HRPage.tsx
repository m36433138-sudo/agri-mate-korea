import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader, SearchField } from "@/components/page/PageParts";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { kstDate } from "@/hooks/useMyAttendance";
import { fmtDays, leaveBalance, monthSummary, serviceText, type LeaveRequest } from "@/lib/hr";
import {
  useAddAdjustment, useCancelLeave, useDecideLeave, useDeleteAdjustment, useHrEmployees, useLeaveAdjustments,
  useLeaveRequests, useMonthAttendance, useSaveEmployee, type HrEmployee,
} from "@/lib/hrApi";
import { LeaveBalanceCard, LeaveCalendar, LeaveRequestDialog, StatusBadge, periodText } from "@/components/hr/LeaveParts";
import { Check, ClipboardCheck, Download, IdCard, Loader2, Plane, Plus, Trash2, UserRound, X, CalendarDays, BarChart3 } from "lucide-react";

const EMPLOYMENT = ["정규직", "계약직", "파트타임", "일용직", "수습"];
const TEAMS = ["사무팀", "기사팀", "영업팀"];

/** 인사관리 (관리자): 인사카드, 휴가 승인, 휴가 달력, 월간 근태 */
export default function HRPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "people";
  const { data: reqs = [] } = useLeaveRequests();
  const waiting = reqs.filter((r) => r.status === "신청").length;
  return (
    <div className="space-y-5">
      <PageHeader title="인사관리" sub="인사카드 · 연차·휴가 승인 · 휴가 달력 · 월간 근태" />
      <Tabs value={tab} onValueChange={(v) => setParams(v === "people" ? {} : { tab: v }, { replace: true })}>
        <TabsList className="mb-4">
          <TabsTrigger value="people" className="gap-1.5"><IdCard className="h-4 w-4" /> 직원</TabsTrigger>
          <TabsTrigger value="leave" className="gap-1.5">
            <ClipboardCheck className="h-4 w-4" /> 휴가 승인
            {waiting > 0 && <span className="ml-0.5 min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">{waiting}</span>}
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5"><CalendarDays className="h-4 w-4" /> 휴가 달력</TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1.5"><BarChart3 className="h-4 w-4" /> 근태 현황</TabsTrigger>
        </TabsList>
        <TabsContent value="people"><People /></TabsContent>
        <TabsContent value="leave"><Approvals /></TabsContent>
        <TabsContent value="calendar"><LeaveCalendar /></TabsContent>
        <TabsContent value="attendance"><Attendance /></TabsContent>
      </Tabs>
    </div>
  );
}

// ───────── 직원 ─────────
function People() {
  const [showResigned, setShowResigned] = useState(false);
  const { data: emps = [], isLoading } = useHrEmployees(showResigned);
  const { data: reqs = [] } = useLeaveRequests();
  const { data: adjs = [] } = useLeaveAdjustments();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<HrEmployee | null>(null);
  const today = kstDate();
  const shown = emps.filter((e) => !q.trim() || [e.name, e.team, e.position, e.phone].some((v) => (v ?? "").includes(q.trim())));
  const missingJoin = emps.filter((e) => e.is_active && !e.join_date).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="이름·팀·직급·연락처" className="max-w-sm" />
        <label className="flex items-center gap-2 text-sm ml-auto"><Switch checked={showResigned} onCheckedChange={setShowResigned} /> 퇴사자 포함</label>
      </div>
      {missingJoin > 0 && <p className="text-sm rounded-2xl bg-amber-500/10 text-amber-800 dark:text-amber-300 px-4 py-2.5">입사일이 없는 직원이 {missingJoin}명 있어요. 입사일을 넣어야 연차가 계산돼요. 직원을 눌러 넣어 주세요.</p>}
      {isLoading ? <Skeleton className="h-40 rounded-3xl" /> : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((e) => {
            const b = e.join_date ? leaveBalance(e.join_date, today, reqs.filter((r) => r.employee_id === e.id), adjs.filter((a) => a.employee_id === e.id)) : null;
            const off = reqs.find((r) => r.employee_id === e.id && r.status === "승인" && r.start_date <= today && r.end_date >= today);
            return (
              <li key={e.id}>
                <button type="button" onClick={() => setOpen(e)} className={cn("w-full text-left rounded-3xl border border-border/70 bg-card card-shadow p-4 hover:border-primary/50 transition-colors", !e.is_active && "opacity-60")}>
                  <div className="flex items-center gap-2">
                    <span className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">{e.name.slice(-2)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{e.name} <span className="text-xs font-normal text-muted-foreground">{[e.position, e.team].filter(Boolean).join(" · ")}</span></p>
                      <p className="text-xs text-muted-foreground">{e.is_active ? (e.join_date ? `${e.join_date} 입사 · ${serviceText(e.join_date, today)}` : "입사일 미입력") : `퇴사 ${e.resigned_at ?? ""}`}</p>
                    </div>
                    {off && <span className="rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-xs font-semibold shrink-0">오늘 {off.kind}</span>}
                  </div>
                  {b && (
                    <div className="mt-3 flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">연차</span>
                      <span className="tabular-nums">{fmtDays(b.used)} / {fmtDays(b.entitled + b.adjusted)}</span>
                      <span className="ml-auto font-bold text-primary tabular-nums">남음 {fmtDays(b.remaining)}</span>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && <EmployeeDialog emp={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function EmployeeDialog({ emp, onClose }: { emp: HrEmployee; onClose: () => void }) {
  const { toast } = useToast();
  const save = useSaveEmployee();
  const [f, setF] = useState(emp);
  useEffect(() => setF(emp), [emp]);
  const { data: reqs = [] } = useLeaveRequests(emp.id);
  const { data: adjs = [] } = useLeaveAdjustments(emp.id);
  const addAdj = useAddAdjustment();
  const delAdj = useDeleteAdjustment();
  const cancel = useCancelLeave();
  const [adj, setAdj] = useState({ days: "", reason: "" });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const today = kstDate();
  const b = f.join_date ? leaveBalance(f.join_date, today, reqs, adjs) : null;
  const set = (k: keyof HrEmployee) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = () => save.mutate({
    id: f.id, team: f.team, position: f.position, employment_type: f.employment_type, branch: f.branch, join_date: f.join_date || null,
    birth_date: f.birth_date || null, phone: f.phone, emergency_contact: f.emergency_contact, address: f.address, notes: f.notes,
    is_active: f.is_active, resigned_at: f.is_active ? null : (f.resigned_at || today),
  }, {
    onSuccess: () => { toast({ title: `${f.name} 인사카드를 저장했어요` }); onClose(); },
    onError: (e: Error) => toast({ title: "저장하지 못했어요", description: e.message, variant: "destructive" }),
  });

  const chip = (vals: string[], k: "team" | "employment_type" | "branch") => (
    <div className="flex flex-wrap gap-1.5">
      {vals.map((v) => (
        <button key={v} type="button" onClick={() => setF({ ...f, [k]: f[k] === v ? null : v })}
          className={cn("rounded-full border px-3 py-1 text-sm", f[k] === v ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted")}>{v}</button>
      ))}
    </div>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto overflow-x-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /> {emp.name} 인사카드</DialogTitle>
          <DialogDescription>{emp.user_id ? "앱 계정 연결됨" : "앱 계정 없음 (사용자 관리에서 연결)"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 min-w-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>입사일</Label><Input type="date" value={f.join_date ?? ""} onChange={set("join_date")} /></div>
            <div className="space-y-1.5"><Label>직급</Label><Input value={f.position ?? ""} onChange={set("position")} placeholder="예: 대리, 기사, 총무" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>팀</Label>{chip(TEAMS, "team")}</div>
            <div className="space-y-1.5 sm:col-span-2"><Label>고용 형태</Label>{chip(EMPLOYMENT, "employment_type")}</div>
            <div className="space-y-1.5 sm:col-span-2"><Label>근무지</Label>{chip(["장흥", "강진"], "branch")}</div>
            <div className="space-y-1.5"><Label>연락처</Label><Input value={f.phone ?? ""} onChange={set("phone")} inputMode="tel" /></div>
            <div className="space-y-1.5"><Label>비상연락처</Label><Input value={f.emergency_contact ?? ""} onChange={set("emergency_contact")} placeholder="예: 배우자 010-…" /></div>
            <div className="space-y-1.5"><Label>생년월일</Label><Input type="date" value={f.birth_date ?? ""} onChange={set("birth_date")} /></div>
            <div className="space-y-1.5"><Label>주소</Label><Input value={f.address ?? ""} onChange={set("address")} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>메모</Label><Textarea rows={2} value={f.notes ?? ""} onChange={set("notes")} placeholder="자격증, 면허, 교육 이수 등" /></div>
            <label className="flex items-center justify-between gap-3 rounded-2xl border p-3 sm:col-span-2">
              <span className="text-sm"><b>재직 중</b><span className="block text-xs text-muted-foreground">끄면 퇴사로 기록돼 목록·담당자 고르기에서 빠져요. 앱 로그인은 사용자 관리에서 따로 막아 주세요.</span></span>
              <Switch checked={!!f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} />
            </label>
            {!f.is_active && <div className="space-y-1.5"><Label>퇴사일</Label><Input type="date" value={f.resigned_at ?? today} onChange={set("resigned_at")} /></div>}
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold flex-1 flex items-center gap-1.5"><Plane className="h-4 w-4 text-primary" /> 연차</h3>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setLeaveOpen(true)}><Plus className="h-3.5 w-3.5" /> 휴가 대신 등록</Button>
            </div>
            <LeaveBalanceCard joinDate={f.join_date} requests={reqs} adjustments={adjs} compact />
            {b && (
              <div className="rounded-2xl border p-3 space-y-2">
                <p className="text-sm font-semibold">연차 조정 <span className="text-xs font-normal text-muted-foreground">(이번 기간 {b.periodStart}~ · 이월, 포상, 결근 차감 등)</span></p>
                <div className="flex gap-1.5">
                  <Input className="w-24" inputMode="decimal" placeholder="+1 / -0.5" value={adj.days} onChange={(e) => setAdj({ ...adj, days: e.target.value })} />
                  <Input className="flex-1 min-w-0" placeholder="사유 (예: 작년 이월)" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />
                  <Button size="sm" className="shrink-0" disabled={!Number(adj.days) || !adj.reason.trim() || addAdj.isPending}
                    onClick={() => addAdj.mutate({ employee_id: emp.id, period_start: b.periodStart, days: Math.round(Number(adj.days) * 10) / 10, reason: adj.reason.trim() }, {
                      onSuccess: () => setAdj({ days: "", reason: "" }),
                      onError: (e: Error) => toast({ title: "조정 실패", description: e.message, variant: "destructive" }),
                    })}>추가</Button>
                </div>
                {adjs.length > 0 && (
                  <ul className="text-sm divide-y">
                    {adjs.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 py-1.5">
                        <span className={cn("tabular-nums font-semibold w-14", a.days > 0 ? "text-emerald-600" : "text-rose-600")}>{a.days > 0 ? "+" : ""}{a.days}일</span>
                        <span className="flex-1 min-w-0 truncate">{a.reason}</span>
                        <span className="text-xs text-muted-foreground">{a.period_start}~</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delAdj.mutate(a.id)} aria-label="조정 지우기"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <ul className="divide-y rounded-2xl border">
              {reqs.length === 0 ? <li className="p-3 text-sm text-muted-foreground">휴가 기록이 없어요</li> : reqs.slice(0, 30).map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1"><b>{r.kind}</b> {fmtDays(r.days)} <span className="text-muted-foreground">{periodText(r.start_date, r.end_date)}{r.reason ? ` · ${r.reason}` : ""}</span></span>
                  <StatusBadge s={r.status} />
                  {(r.status === "승인" || r.status === "신청") && (
                    <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => { if (confirm("이 휴가를 취소할까요?")) cancel.mutate(r.id); }}>취소</Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>닫기</Button>
          <Button onClick={submit} disabled={save.isPending} className="gap-1.5">{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} 저장</Button>
        </DialogFooter>
        <LeaveRequestDialog open={leaveOpen} onOpenChange={setLeaveOpen} forEmployee={{ id: emp.id, name: emp.name }} />
      </DialogContent>
    </Dialog>
  );
}

// ───────── 휴가 승인 ─────────
function Approvals() {
  const { toast } = useToast();
  const { data: reqs = [], isLoading } = useLeaveRequests();
  const { data: emps = [] } = useHrEmployees(true);
  const { data: adjs = [] } = useLeaveAdjustments();
  const decide = useDecideLeave();
  const nameOf = (id: string) => emps.find((e) => e.id === id)?.name ?? "?";
  const pending = reqs.filter((r) => r.status === "신청").sort((a, b) => a.start_date.localeCompare(b.start_date));
  const recent = reqs.filter((r) => r.status !== "신청").slice(0, 30);
  const today = kstDate();

  const act = (r: LeaveRequest, approve: boolean) => {
    const note = approve ? "" : (prompt("반려 사유 (선택)") ?? null);
    if (note === null) return;
    decide.mutate({ req: r, approve, note, employeeName: nameOf(r.employee_id) }, {
      onSuccess: () => toast({ title: approve ? `${nameOf(r.employee_id)} 휴가를 승인했어요` : "반려했어요", description: "신청한 사람에게 알림을 보냈어요." }),
      onError: (e: Error) => toast({ title: "처리하지 못했어요", description: e.message, variant: "destructive" }),
    });
  };

  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />;
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="font-bold">승인 대기 {pending.length}건</h2>
        {pending.length === 0 ? <p className="text-sm text-muted-foreground rounded-2xl border border-dashed p-4">기다리는 휴가 신청이 없어요.</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {pending.map((r) => {
              const e = emps.find((x) => x.id === r.employee_id);
              const b = e?.join_date ? leaveBalance(e.join_date, today, reqs.filter((x) => x.employee_id === r.employee_id), adjs.filter((a) => a.employee_id === r.employee_id)) : null;
              return (
                <li key={r.id} className="rounded-3xl border border-border/70 bg-card card-shadow p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-bold flex-1">{nameOf(r.employee_id)} <span className="text-sm font-normal text-muted-foreground">{e?.team}</span></p>
                    <StatusBadge s={r.status} />
                  </div>
                  <p className="text-sm"><b>{r.kind}</b> {fmtDays(r.days)} · {periodText(r.start_date, r.end_date)}</p>
                  {r.reason && <p className="text-sm text-muted-foreground">{r.reason}</p>}
                  {b && ["연차", "오전반차", "오후반차"].includes(r.kind) && (
                    <p className={cn("text-xs", b.remaining - r.days < 0 ? "text-destructive font-semibold" : "text-muted-foreground")}>
                      승인하면 남은 연차 {fmtDays(b.remaining)} → {fmtDays(Math.round((b.remaining - r.days) * 10) / 10)}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button className="rounded-full gap-1.5" disabled={decide.isPending} onClick={() => act(r, true)}><Check className="h-4 w-4" /> 승인</Button>
                    <Button variant="outline" className="rounded-full gap-1.5" disabled={decide.isPending} onClick={() => act(r, false)}><X className="h-4 w-4" /> 반려</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="font-bold">최근 처리</h2>
        <ul className="divide-y rounded-3xl border bg-card">
          {recent.length === 0 ? <li className="p-4 text-sm text-muted-foreground">아직 없어요</li> : recent.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              <span className="font-semibold w-16 shrink-0 truncate">{nameOf(r.employee_id)}</span>
              <span className="min-w-0 flex-1 truncate">{r.kind} {fmtDays(r.days)} <span className="text-muted-foreground">{periodText(r.start_date, r.end_date)}</span></span>
              <StatusBadge s={r.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ───────── 근태 현황 ─────────
function Attendance() {
  const today = kstDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const { data: emps = [] } = useHrEmployees();
  const { data: recs = [], isLoading } = useMonthAttendance(month);
  const { data: reqs = [] } = useLeaveRequests();
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => emps.map((e) => ({
    e, s: monthSummary(month, today, recs.filter((r) => r.employee_id === e.id), reqs.filter((r) => r.employee_id === e.id), e.join_date),
  })), [emps, recs, reqs, month, today]);

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map(({ e, s }) => ({
      이름: e.name, 팀: e.team ?? "", 근무일: s.workdays, 출근: s.worked, 지각: s.late, 조퇴: s.early, "기록 없음(결근 포함)": s.absent,
      휴가일수: s.leaveDays, "연장근무(시간)": Math.round(s.overtimeMin / 6) / 10, 지각한날: s.lateDates.join(", "), 기록없는날: s.absentDates.join(", "),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, month);
    XLSX.writeFile(wb, `근태현황_${month}.xlsx`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
        <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">지각 = 08:30 지나 출근, 조퇴 = 18:00 전 퇴근 (반차한 날은 빼요). 기록 없음 = 오늘 이전 평일에 출근 기록도 휴가도 없는 날 (출근을 안 찍었거나 결근).</p>
        <Button variant="outline" className="gap-1.5" onClick={exportXlsx}><Download className="h-4 w-4" /> 엑셀</Button>
      </div>
      {isLoading ? <Skeleton className="h-40 rounded-3xl" /> : (
        <div className="rounded-3xl border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>{["이름", "근무일", "출근", "지각", "조퇴", "기록 없음", "휴가", "연장근무"].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ e, s }) => (
                <Fragment key={e.id}>
                  <tr className="hover:bg-muted/40 cursor-pointer" onClick={() => setOpen(open === e.id ? null : e.id)}>
                    <td className="px-3 py-2.5 font-semibold">{e.name} <span className="text-xs font-normal text-muted-foreground">{e.team}</span></td>
                    <td className="px-3 py-2.5 tabular-nums">{s.workdays}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.worked}</td>
                    <td className={cn("px-3 py-2.5 tabular-nums", s.late && "text-amber-600 font-semibold")}>{s.late}</td>
                    <td className={cn("px-3 py-2.5 tabular-nums", s.early && "text-amber-600 font-semibold")}>{s.early}</td>
                    <td className={cn("px-3 py-2.5 tabular-nums", s.absent && "text-rose-600 font-semibold")}>{s.absent}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.leaveDays ? fmtDays(s.leaveDays) : 0}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.overtimeMin ? `${Math.floor(s.overtimeMin / 60)}시간 ${s.overtimeMin % 60}분` : "-"}</td>
                  </tr>
                  {open === e.id && (
                    <tr className="bg-muted/30">
                      <td colSpan={8} className="px-3 py-2.5 text-xs space-y-1">
                        <p><b>지각</b> {s.lateDates.length ? s.lateDates.map((d) => d.slice(5)).join(", ") : "없음"}</p>
                        <p><b>기록 없음</b> {s.absentDates.length ? s.absentDates.map((d) => d.slice(5)).join(", ") : "없음"} <span className="text-muted-foreground">(휴가 등록을 빠뜨렸으면 인사카드에서 대신 등록하세요)</span></p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
