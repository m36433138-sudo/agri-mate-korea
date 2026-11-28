import { describe, expect, it } from "vitest";
import { annualLeave, leaveBalance, monthSummary, nextAccrual, previewDays, serviceText, type LeaveRequest } from "./hr";

const L = (p: Partial<LeaveRequest>): LeaveRequest => ({ id: "x", employee_id: "e", kind: "연차", start_date: "2026-01-05", end_date: "2026-01-05", days: 1, status: "승인", ...p });

describe("연차 (근로기준법 60조, 입사일 기준)", () => {
  it("1년 미만은 한 달마다 1일, 최대 11일", () => {
    expect(annualLeave("2026-06-15", "2026-06-14").entitled).toBe(0);
    expect(annualLeave("2026-06-15", "2026-07-15").entitled).toBe(1);
    expect(annualLeave("2026-06-15", "2026-11-28").entitled).toBe(5);
    expect(annualLeave("2026-06-15", "2027-06-14")).toMatchObject({ entitled: 11, firstYear: true, periodEnd: "2027-06-14" });
    expect(nextAccrual("2026-06-15", "2026-11-28")).toBe("2026-12-15");
  });
  it("1년 15일, 3년차부터 2년마다 +1, 최대 25일", () => {
    expect(annualLeave("2020-03-02", "2021-03-02")).toMatchObject({ entitled: 15, years: 1, periodStart: "2021-03-02", periodEnd: "2022-03-01" });
    expect(annualLeave("2020-03-02", "2023-03-02").entitled).toBe(16);
    expect(annualLeave("2020-03-02", "2025-03-02").entitled).toBe(17);
    expect(annualLeave("1990-01-01", "2026-11-28").entitled).toBe(25);
  });
  it("잔여 = 생긴 연차 + 조정 − 승인된 연차·반차 (이번 기간만, 병가는 안 뺌)", () => {
    const reqs = [
      L({ start_date: "2026-04-10", days: 2 }), L({ kind: "오전반차", start_date: "2026-05-01", days: 0.5 }),
      L({ kind: "병가", start_date: "2026-05-02", days: 3 }), L({ start_date: "2025-12-01", days: 5 }),
      L({ start_date: "2026-08-03", days: 1, status: "신청" }),
    ];
    const b = leaveBalance("2020-03-02", "2026-11-28", reqs, [{ id: "a", employee_id: "e", period_start: "2026-03-02", days: 2, reason: "이월" }]);
    expect(b).toMatchObject({ entitled: 17, adjusted: 2, used: 2.5, pending: 1, remaining: 16.5 });
  });
  it("근속 글자", () => {
    expect(serviceText("2023-09-01", "2026-11-28")).toBe("3년 2개월");
    expect(serviceText(null, "2026-11-28")).toBe("입사일 미입력");
  });
  it("휴가 일수: 주말·공휴일 빼고, 반차 0.5", () => {
    expect(previewDays("연차", "2027-02-05", "2027-02-10")).toBe(2);
    expect(previewDays("오후반차", "2026-12-01", "2026-12-01")).toBe(0.5);
  });
});

describe("월간 근태", () => {
  const at = (date: string, inHM: string, outHM: string | null, ot = 0) => ({
    date, clock_in: `${date}T${inHM}:00+09:00`, clock_out: outHM ? `${date}T${outHM}:00+09:00` : null, overtime_minutes: ot,
  });
  it("지각·조퇴·결근·휴가를 센다", () => {
    // 2026-12: 평일 22일(12/25 공휴일 제외). 오늘 12/10 → 12/1~12/9 중 기록 없는 날은 결근
    const recs = [at("2026-12-01", "08:20", "18:30", 30), at("2026-12-02", "08:45", "18:00"), at("2026-12-03", "08:25", "17:00"),
      at("2026-12-04", "09:30", "18:10"), at("2026-12-05", "09:00", "12:00", 180)];
    const leaves = [L({ start_date: "2026-12-07", end_date: "2026-12-08", days: 2 }), L({ kind: "오전반차", start_date: "2026-12-04", end_date: "2026-12-04", days: 0.5 })];
    const s = monthSummary("2026-12", "2026-12-10", recs, leaves);
    expect(s.workdays).toBe(22);
    expect(s.worked).toBe(5); // 토요일 출근 포함
    expect(s).toMatchObject({ late: 1, early: 1, leaveDays: 2.5, overtimeMin: 210 });
    expect(s.lateDates).toEqual(["2026-12-02"]);
    expect(s.absentDates).toEqual(["2026-12-09"]);
  });
  it("입사 전 날은 결근으로 안 센다", () => {
    expect(monthSummary("2026-06", "2026-06-30", [], [], "2026-06-15").absentDates[0]).toBe("2026-06-15");
  });
});
