/**
 * 인사관리 계산: 연차(근로기준법 제60조, 입사일 기준)·근속·월간 근태 요약.
 * 화면과 테스트가 같이 쓰도록 순수 함수로만 둔다.
 */
import { isHolidayOrWeekend } from "@/hooks/useAttendance";

export const LEAVE_KINDS = ["연차", "오전반차", "오후반차", "병가", "경조사", "공가", "대체휴무", "무급휴가"] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];
export type LeaveStatus = "신청" | "승인" | "반려" | "취소";
/** 연차에서 빠지는 종류 */
export const ANNUAL_KINDS: LeaveKind[] = ["연차", "오전반차", "오후반차"];

export type LeaveRequest = {
  id: string; employee_id: string; kind: LeaveKind; start_date: string; end_date: string; days: number;
  reason?: string | null; status: LeaveStatus; decision_note?: string | null; created_at?: string;
};
export type LeaveAdjustment = { id: string; employee_id: string; period_start: string; days: number; reason: string; created_at?: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(`${s}T00:00:00Z`);
function addYears(s: string, n: number): string {
  const d = parse(s); d.setUTCFullYear(d.getUTCFullYear() + n); return iso(d);
}
function addMonths(s: string, n: number): string {
  const d = parse(s); d.setUTCMonth(d.getUTCMonth() + n); return iso(d);
}

/** 꽉 찬 근속 개월 수 */
export function fullMonths(join: string, asOf: string): number {
  const a = parse(join), b = parse(asOf);
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m--;
  return Math.max(0, m);
}

/** 「3년 2개월」 */
export function serviceText(join: string | null | undefined, asOf: string): string {
  if (!join) return "입사일 미입력";
  if (join > asOf) return "입사 전";
  const m = fullMonths(join, asOf);
  const y = Math.floor(m / 12), r = m % 12;
  return y ? (r ? `${y}년 ${r}개월` : `${y}년`) : `${r}개월`;
}

export type AnnualLeave = {
  /** 이번 연차 기간 (입사 기념일 ~ 다음 기념일 전날) */
  periodStart: string; periodEnd: string;
  /** 이번 기간에 생긴 연차 */
  entitled: number;
  /** 1년 미만이면 다음 달에 1일 더 생긴다 */
  firstYear: boolean;
  years: number;
};

/**
 * 근로기준법 제60조 (입사일 기준)
 * - 1년 미만: 1개월 개근마다 1일, 최대 11일 (입사 1년이 되면 그 기간이 끝난다)
 * - 1년 이상: 15일, 3년차부터 2년마다 1일 더, 최대 25일
 * 개근 여부(결근)는 화면에서 관리자가 조정으로 반영한다.
 */
export function annualLeave(join: string, asOf: string): AnnualLeave {
  const years = Math.floor(fullMonths(join, asOf) / 12);
  if (years < 1) {
    return { periodStart: join, periodEnd: iso(new Date(parse(addYears(join, 1)).getTime() - 86400_000)), entitled: Math.min(11, fullMonths(join, asOf)), firstYear: true, years: 0 };
  }
  const start = addYears(join, years);
  return {
    periodStart: start,
    periodEnd: iso(new Date(parse(addYears(join, years + 1)).getTime() - 86400_000)),
    entitled: Math.min(25, 15 + Math.floor((years - 1) / 2)),
    firstYear: false,
    years,
  };
}

/** 다음에 연차가 생기는 날 (1년 미만은 다음 달 같은 날, 그 뒤엔 다음 기념일) */
export function nextAccrual(join: string, asOf: string): string {
  const a = annualLeave(join, asOf);
  if (a.firstYear && a.entitled < 11) return addMonths(join, fullMonths(join, asOf) + 1);
  return addYears(join, a.years + 1);
}

export type LeaveBalance = AnnualLeave & { adjusted: number; used: number; pending: number; remaining: number };

/** 이번 연차 기간의 잔여: 생긴 연차 + 조정 − 승인된 연차·반차 (신청 중은 따로) */
export function leaveBalance(join: string, asOf: string, requests: LeaveRequest[], adjustments: LeaveAdjustment[]): LeaveBalance {
  const a = annualLeave(join, asOf);
  const inPeriod = (d: string) => d >= a.periodStart && d <= a.periodEnd;
  const annual = requests.filter((r) => ANNUAL_KINDS.includes(r.kind) && inPeriod(r.start_date));
  const used = sum(annual.filter((r) => r.status === "승인").map((r) => Number(r.days)));
  const pending = sum(annual.filter((r) => r.status === "신청").map((r) => Number(r.days)));
  const adjusted = sum(adjustments.filter((x) => x.period_start === a.periodStart).map((x) => Number(x.days)));
  return { ...a, adjusted, used, pending, remaining: round1(a.entitled + adjusted - used) };
}

const sum = (xs: number[]) => round1(xs.reduce((s, x) => s + x, 0));
const round1 = (n: number) => Math.round(n * 10) / 10;
export const fmtDays = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}일`;

/** 화면에서 미리 보는 휴가 일수 (서버 leave_days 와 같은 규칙) */
export function previewDays(kind: LeaveKind, start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  if (kind === "오전반차" || kind === "오후반차") return 0.5;
  let n = 0;
  for (let d = parse(start); iso(d) <= end; d = new Date(d.getTime() + 86400_000)) if (!isHolidayOrWeekend(iso(d))) n++;
  return n;
}

// ───────── 월간 근태 ─────────
export const WORK_START = "08:30";
export const WORK_END = "18:00";

type Att = { date: string; clock_in: string | null; clock_out: string | null; overtime_minutes?: number | null; break_minutes?: number | null };

const kstHM = (ts: string) => new Date(new Date(ts).getTime() + 9 * 3600_000).toISOString().slice(11, 16);

export type MonthSummary = {
  workdays: number; worked: number; late: number; early: number; absent: number; leaveDays: number; overtimeMin: number;
  lateDates: string[]; absentDates: string[];
};

/**
 * 한 사람의 한 달(YYYY-MM) 근태: 평일 근무일 중 출근한 날, 지각(08:30 지나 출근), 조퇴(18:00 전 퇴근),
 * 결근(오늘 이전 평일인데 출근·휴가 모두 없음), 승인된 휴가 일수, 연장근무.
 */
export function monthSummary(month: string, today: string, records: Att[], leaves: LeaveRequest[], joinDate?: string | null): MonthSummary {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const approved = leaves.filter((l) => l.status === "승인");
  const byDate = new Map(records.map((r) => [r.date, r]));
  const out: MonthSummary = { workdays: 0, worked: 0, late: 0, early: 0, absent: 0, leaveDays: 0, overtimeMin: 0, lateDates: [], absentDates: [] };
  for (let d = 1; d <= last; d++) {
    const ds = `${month}-${String(d).padStart(2, "0")}`;
    const r = byDate.get(ds);
    if (r?.overtime_minutes) out.overtimeMin += r.overtime_minutes;
    if (isHolidayOrWeekend(ds) || (joinDate && ds < joinDate)) { if (r?.clock_in) out.worked++; continue; }
    out.workdays++;
    const leave = approved.filter((l) => l.start_date <= ds && l.end_date >= ds);
    const fullDayOff = leave.some((l) => l.kind !== "오전반차" && l.kind !== "오후반차");
    if (leave.length) out.leaveDays += fullDayOff ? 1 : 0.5;
    if (r?.clock_in) {
      out.worked++;
      const amHalf = leave.some((l) => l.kind === "오전반차"), pmHalf = leave.some((l) => l.kind === "오후반차");
      if (!amHalf && kstHM(r.clock_in) > WORK_START) { out.late++; out.lateDates.push(ds); }
      if (r.clock_out && !pmHalf && kstHM(r.clock_out) < WORK_END) out.early++;
    } else if (!fullDayOff && ds < today) {
      out.absent++; out.absentDates.push(ds);
    }
  }
  out.leaveDays = round1(out.leaveDays);
  return out;
}
