import { useState, useMemo, useEffect } from "react";
import {
  RefreshCw, Clock, User, LogIn, LogOut, MapPin, Wallet,
  CalendarDays, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useAttendance, minutesToHM, type Employee, type AttendanceRecord,
} from "@/hooks/useAttendance";
import TechnicianMap from "@/components/TechnicianMap";

const TECH_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  유호상: { bg: "bg-blue-500/10", text: "text-blue-400", accent: "bg-blue-500" },
  마성수: { bg: "bg-emerald-500/10", text: "text-emerald-400", accent: "bg-emerald-500" },
  김영일: { bg: "bg-amber-500/10", text: "text-amber-400", accent: "bg-amber-500" },
  이재현: { bg: "bg-purple-500/10", text: "text-purple-400", accent: "bg-purple-500" },
  이동진: { bg: "bg-rose-500/10", text: "text-rose-400", accent: "bg-rose-500" },
  주희로: { bg: "bg-cyan-500/10", text: "text-cyan-400", accent: "bg-cyan-500" },
};

function formatTime(isoStr: string | null): string {
  if (!isoStr) return "-";
  return new Date(isoStr).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Employee Card ──
function EmployeeCard({
  emp,
  records,
  onClockIn,
  onClockOut,
  isMutating,
}: {
  emp: Employee;
  records: AttendanceRecord[];
  onClockIn: (empId: string) => void;
  onClockOut: (empId: string) => void;
  isMutating: boolean;
}) {
  const colors = TECH_COLORS[emp.name] || { bg: "bg-muted", text: "text-foreground", accent: "bg-muted-foreground" };
  const today = new Date().toISOString().slice(0, 10);
  const todayRec = records.find((r) => r.employee_id === emp.id && r.date === today);
  const empRecords = records.filter((r) => r.employee_id === emp.id);

  // Current month total
  const monthStr = today.slice(0, 7);
  const monthTotal = empRecords
    .filter((r) => r.date.startsWith(monthStr))
    .reduce((s, r) => s + r.overtime_minutes, 0);

  // Year total
  const yearStr = today.slice(0, 4);
  const yearTotal = empRecords
    .filter((r) => r.date.startsWith(yearStr))
    .reduce((s, r) => s + r.overtime_minutes, 0);

  return (
    <Card className={`border-l-4 ${colors.bg}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-full ${colors.accent} flex items-center justify-center`}>
            <User className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg">{emp.name}</span>
          {todayRec?.clock_in && !todayRec?.clock_out && (
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">근무중</Badge>
          )}
          {todayRec?.clock_out && (
            <Badge variant="outline" className="text-muted-foreground border-border text-[10px]">퇴근완료</Badge>
          )}
        </div>

        {/* Today status */}
        <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
          <div>출근: {formatTime(todayRec?.clock_in ?? null)}</div>
          <div>퇴근: {formatTime(todayRec?.clock_out ?? null)}</div>
          {todayRec?.clock_out && (
            <div className={`font-semibold ${colors.text}`}>
              초과: {minutesToHM(todayRec.overtime_minutes)} (오전 {minutesToHM(todayRec.morning_ot_minutes)} / 오후 {minutesToHM(todayRec.afternoon_ot_minutes)})
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">이번달 초과</p>
            <p className={`text-xl font-bold ${colors.text}`}>{minutesToHM(monthTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">올해 누적</p>
            <p className="text-xl font-bold">{minutesToHM(yearTotal)}</p>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t">
          <Button
            size="sm" variant="outline"
            className="flex-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            onClick={() => onClockIn(emp.id)}
            disabled={isMutating || !!todayRec?.clock_in}
          >
            <LogIn className="h-4 w-4 mr-1" /> 출근
          </Button>
          <Button
            size="sm" variant="outline"
            className="flex-1 text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
            onClick={() => onClockOut(emp.id)}
            disabled={isMutating || !todayRec?.clock_in || !!todayRec?.clock_out}
          >
            <LogOut className="h-4 w-4 mr-1" /> 퇴근
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Settlement Dialog ──
function SettlementDialog({
  open,
  onClose,
  employees,
  records,
  userId,
  onSettle,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  records: AttendanceRecord[];
  userId: string | null;
  onSettle: (params: any) => Promise<any>;
}) {
  const [empId, setEmpId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [bonus, setBonus] = useState(0);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const selectedEmp = employees.find((e) => e.id === empId);
  const hourlyRate = selectedEmp?.overtime_hourly_rate || 0;

  const eligibleRecords = useMemo(() => {
    if (!empId || !periodStart || !periodEnd) return [];
    return records.filter(
      (r) =>
        r.employee_id === empId &&
        !r.is_settled &&
        r.date >= periodStart &&
        r.date <= periodEnd &&
        r.clock_out
    );
  }, [empId, periodStart, periodEnd, records]);

  const totalMin = eligibleRecords.reduce((s, r) => s + r.overtime_minutes, 0);
  const estimated = Math.round((totalMin / 60) * hourlyRate) + bonus;

  const handleSubmit = async () => {
    if (!empId || !periodStart || !periodEnd) return;
    setIsSubmitting(true);
    try {
      const result = await onSettle({
        employeeId: empId,
        periodStart,
        periodEnd,
        hourlyRate,
        bonus,
        settledBy: userId,
        notes: notes || undefined,
      });
      toast({
        title: "정산 완료",
        description: `총 ${minutesToHM(result.totalMin)} 초과근무, ₩${result.totalPayment.toLocaleString()} 지급`,
      });
      onClose();
    } catch (err: any) {
      toast({ title: "정산 실패", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> 초과근무 정산
          </DialogTitle>
          <DialogDescription>정산할 직원과 기간을 선택하세요.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>직원 선택</Label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger><SelectValue placeholder="직원 선택" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>시작일</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <Label>종료일</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>시급 (원)</Label>
              <Input type="number" value={hourlyRate} readOnly className="bg-muted" />
            </div>
            <div>
              <Label>보너스 (원)</Label>
              <Input type="number" value={bonus} onChange={(e) => setBonus(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <Label>비고</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {empId && periodStart && periodEnd && (
            <Card className="bg-muted/50">
              <CardContent className="p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">대상 건수</span>
                  <span className="font-semibold">{eligibleRecords.length}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">총 초과시간</span>
                  <span className="font-semibold">{minutesToHM(totalMin)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-1">
                  <span>예상 지급액</span>
                  <span className="text-primary">₩{estimated.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !empId || !periodStart || !periodEnd || eligibleRecords.length === 0}>
            {isSubmitting ? "처리 중..." : "정산 완료"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Monthly Summary ──
function MonthlySummary({ records, employees }: { records: AttendanceRecord[]; employees: Employee[] }) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const key = `${now.getFullYear()}-${String(m).padStart(2, "0")}`;
    return { label: `${m}월`, key };
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium">직원</th>
            {months.map((m) => (
              <th key={m.key} className="text-right py-2 px-3 font-medium text-xs">{m.label}</th>
            ))}
            <th className="text-right py-2 px-3 font-medium">합계</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const empRecs = records.filter((r) => r.employee_id === emp.id);
            const monthTotals = months.map((m) =>
              empRecs.filter((r) => r.date.startsWith(m.key)).reduce((s, r) => s + r.overtime_minutes, 0)
            );
            const yearTotal = monthTotals.reduce((a, b) => a + b, 0);
            const colors = TECH_COLORS[emp.name];
            return (
              <tr key={emp.id} className="border-b">
                <td className="py-2 px-3 font-semibold">
                  <span className={`inline-flex items-center gap-1.5 ${colors?.text || ""}`}>
                    <span className={`w-2 h-2 rounded-full ${colors?.accent || "bg-muted"}`} />
                    {emp.name}
                  </span>
                </td>
                {monthTotals.map((t, i) => (
                  <td key={i} className="py-2 px-3 text-right font-mono text-xs">
                    {t > 0 ? minutesToHM(t) : "-"}
                  </td>
                ))}
                <td className="py-2 px-3 text-right font-mono font-bold">{minutesToHM(yearTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Daily Records Table ──
function DailyRecordsTable({
  records,
  employees,
  employeeFilter,
}: {
  records: AttendanceRecord[];
  employees: Employee[];
  employeeFilter?: string;
}) {
  const filtered = employeeFilter
    ? records.filter((r) => r.employee_id === employeeFilter)
    : records;

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  const empMap = Object.fromEntries(employees.map((e) => [e.id, e.name]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium">날짜</th>
            {!employeeFilter && <th className="text-left py-2 px-3 font-medium">직원</th>}
            <th className="text-right py-2 px-3 font-medium">출근</th>
            <th className="text-right py-2 px-3 font-medium">퇴근</th>
            <th className="text-right py-2 px-3 font-medium">오전초과</th>
            <th className="text-right py-2 px-3 font-medium">오후초과</th>
            <th className="text-right py-2 px-3 font-medium">합계</th>
            <th className="text-center py-2 px-3 font-medium">상태</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 50).map((r) => {
            const mins = r.overtime_minutes;
            const rowBg = mins > 180 ? "bg-orange-500/10" : mins > 120 ? "bg-yellow-500/10" : "";
            return (
              <tr key={r.id} className={`border-b ${rowBg}`}>
                <td className="py-2 px-3">
                  {formatDate(r.date)}
                  {r.is_holiday && <span className="ml-1 text-[10px] text-rose-400">휴일</span>}
                </td>
                {!employeeFilter && (
                  <td className="py-2 px-3">{empMap[r.employee_id] || "-"}</td>
                )}
                <td className="py-2 px-3 text-right font-mono">{formatTime(r.clock_in)}</td>
                <td className="py-2 px-3 text-right font-mono">{formatTime(r.clock_out)}</td>
                <td className="py-2 px-3 text-right font-mono">{minutesToHM(r.morning_ot_minutes)}</td>
                <td className="py-2 px-3 text-right font-mono">{minutesToHM(r.afternoon_ot_minutes)}</td>
                <td className="py-2 px-3 text-right font-mono font-semibold">{minutesToHM(mins)}</td>
                <td className="py-2 px-3 text-center">
                  {r.is_modified && (
                    <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">수정</Badge>
                  )}
                  {r.is_settled && (
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-0.5" />정산
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">기록 없음</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Dashboard ──
export default function OvertimeDashboard() {
  const {
    employees, records, allRecords, isLoading, refresh,
    clockInMutation, clockOutMutation, settleMutation,
  } = useAttendance();
  const { userId, isAdmin } = useUserRole();
  const { toast } = useToast();

  const [confirmAction, setConfirmAction] = useState<{
    type: "in" | "out";
    empId: string;
    empName: string;
  } | null>(null);
  const [isModified, setIsModified] = useState(false);
  const [modReason, setModReason] = useState("");
  const [showSettlement, setShowSettlement] = useState(false);

  const isMutating = clockInMutation.isPending || clockOutMutation.isPending;

  // For employee view: find their employee record
  const myEmployee = employees.find((e) => e.user_id === userId);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const mutation = confirmAction.type === "in" ? clockInMutation : clockOutMutation;
    const label = confirmAction.type === "in" ? "출근" : "퇴근";
    try {
      const result = await mutation.mutateAsync({
        employeeId: confirmAction.empId,
        isModified,
        modReason: isModified ? modReason : undefined,
      });
      let desc = `${label} 시간이 기록되었습니다.`;
      if (confirmAction.type === "out" && result) {
        const r = result as AttendanceRecord;
        desc = `오늘 초과근무: ${minutesToHM(r.overtime_minutes)} (오전 ${minutesToHM(r.morning_ot_minutes)} / 오후 ${minutesToHM(r.afternoon_ot_minutes)})`;
      }
      toast({ title: `${confirmAction.empName} ${label} 완료`, description: desc });
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setConfirmAction(null);
      setIsModified(false);
      setModReason("");
    }
  };

  // Summary
  const today = new Date().toISOString().slice(0, 10);
  const monthKey = today.slice(0, 7);
  const totalMonthOT = allRecords
    .filter((r) => r.date.startsWith(monthKey))
    .reduce((s, r) => s + r.overtime_minutes, 0);
  const totalYearOT = allRecords
    .filter((r) => r.date.startsWith(today.slice(0, 4)))
    .reduce((s, r) => s + r.overtime_minutes, 0);

  // Current time display
  const [nowStr, setNowStr] = useState(new Date().toLocaleTimeString("ko-KR"));
  useEffect(() => {
    const t = setInterval(() => setNowStr(new Date().toLocaleTimeString("ko-KR")), 1000);
    return () => clearInterval(t);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  // Employee view (non-admin)
  if (!isAdmin && myEmployee) {
    const myRecords = records.filter((r) => r.employee_id === myEmployee.id);
    const myAllRecords = allRecords.filter((r) => r.employee_id === myEmployee.id && !r.is_settled);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-6 w-6" /> 내 출퇴근
            </h1>
            <p className="text-sm text-muted-foreground mt-1">현재 시각: {nowStr}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-1" /> 새로고침
          </Button>
        </div>

        <EmployeeCard
          emp={myEmployee}
          records={allRecords}
          onClockIn={(id) => setConfirmAction({ type: "in", empId: id, empName: myEmployee.name })}
          onClockOut={(id) => setConfirmAction({ type: "out", empId: id, empName: myEmployee.name })}
          isMutating={isMutating}
        />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">미정산 기록</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyRecordsTable records={myAllRecords} employees={employees} employeeFilter={myEmployee.id} />
          </CardContent>
        </Card>

        {/* Confirm Dialog */}
        <ClockConfirmDialog
          confirmAction={confirmAction}
          isModified={isModified}
          setIsModified={setIsModified}
          modReason={modReason}
          setModReason={setModReason}
          isMutating={isMutating}
          nowStr={nowStr}
          onClose={() => { setConfirmAction(null); setIsModified(false); setModReason(""); }}
          onConfirm={handleConfirm}
        />
      </div>
    );
  }

  // Admin view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" /> 초과근무 현황
          </h1>
          <p className="text-sm text-muted-foreground mt-1">현재 시각: {nowStr}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettlement(true)}>
            <Wallet className="h-4 w-4 mr-1" /> 정산
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> 새로고침
          </Button>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-8 items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">이번달 전체 초과</p>
              <p className="text-xl font-bold text-primary">{minutesToHM(totalMonthOT)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">올해 누적 초과</p>
              <p className="text-xl font-bold">{minutesToHM(totalYearOT)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Cards grouped by team */}
      {employees.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              재직 중인 직원이 없습니다. 직원 관리에서 직원을 등록하고 팀을 설정해주세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(["기사팀", "영업팀", "사무팀", "기타"] as const).map((teamName) => {
            const teamEmps = employees.filter((e) =>
              teamName === "기타" ? !["기사팀", "영업팀", "사무팀"].includes(e.team || "") : e.team === teamName
            );
            if (teamEmps.length === 0) return null;
            return (
              <div key={teamName}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">{teamName}</h3>
                  <Badge variant="outline" className="text-[10px]">{teamEmps.length}명</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teamEmps.map((emp) => (
                    <EmployeeCard
                      key={emp.id}
                      emp={emp}
                      records={allRecords}
                      onClockIn={(id) => setConfirmAction({ type: "in", empId: id, empName: emp.name })}
                      onClockOut={(id) => setConfirmAction({ type: "out", empId: id, empName: emp.name })}
                      isMutating={isMutating}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Technician Map */}
      <TechnicianMap />

      {/* Monthly Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> 월별 요약
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlySummary records={allRecords} employees={employees} />
        </CardContent>
      </Card>

      {/* Daily Records */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">일별 상세 기록</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyRecordsTable records={allRecords} employees={employees} />
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <ClockConfirmDialog
        confirmAction={confirmAction}
        isModified={isModified}
        setIsModified={setIsModified}
        modReason={modReason}
        setModReason={setModReason}
        isMutating={isMutating}
        nowStr={nowStr}
        onClose={() => { setConfirmAction(null); setIsModified(false); setModReason(""); }}
        onConfirm={handleConfirm}
      />

      {/* Settlement Dialog */}
      <SettlementDialog
        open={showSettlement}
        onClose={() => setShowSettlement(false)}
        employees={employees}
        records={records}
        userId={userId}
        onSettle={(params) => settleMutation.mutateAsync(params)}
      />
    </div>
  );
}

// ── Clock Confirm Dialog ──
function ClockConfirmDialog({
  confirmAction,
  isModified,
  setIsModified,
  modReason,
  setModReason,
  isMutating,
  nowStr,
  onClose,
  onConfirm,
}: {
  confirmAction: { type: "in" | "out"; empId: string; empName: string } | null;
  isModified: boolean;
  setIsModified: (v: boolean) => void;
  modReason: string;
  setModReason: (v: string) => void;
  isMutating: boolean;
  nowStr: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmAction?.empName} {confirmAction?.type === "in" ? "출근" : "퇴근"} 기록
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>현재 시각 <span className="font-mono font-bold text-foreground">{nowStr}</span>으로 기록합니다.</p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="mod-check"
                  checked={isModified}
                  onCheckedChange={(c) => setIsModified(c === true)}
                />
                <label htmlFor="mod-check" className="text-sm">시간 수정 필요 (사유 입력)</label>
              </div>
              {isModified && (
                <Textarea
                  placeholder="수정 사유를 입력하세요"
                  value={modReason}
                  onChange={(e) => setModReason(e.target.value)}
                  rows={2}
                />
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> 위치 정보도 함께 기록됩니다
              </span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isMutating}>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isMutating || (isModified && !modReason.trim())}>
            {isMutating ? "처리 중..." : "확인"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
