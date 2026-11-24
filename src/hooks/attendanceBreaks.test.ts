import { describe, expect, it } from "vitest";
import { breakMinutes, calcOvertime, calcOvertimeWithBreaks } from "./useAttendance";

const t = (hm: string, d = "2026-11-24") => `${d}T${hm}:00+09:00`;

describe("외출 시간 빼기", () => {
  it("출근~퇴근 안에 든 외출만 센다 (안 돌아왔으면 퇴근까지)", () => {
    expect(breakMinutes(t("08:00"), t("18:00"), [{ started_at: t("12:00"), ended_at: t("13:30") }])).toBe(90);
    expect(breakMinutes(t("08:00"), t("18:00"), [{ started_at: t("17:30"), ended_at: null }])).toBe(30);
    expect(breakMinutes(t("08:00"), t("18:00"), [{ started_at: t("07:00"), ended_at: t("08:10") }])).toBe(10);
  });
  it("외출이 없으면 기존 계산과 같다", () => {
    const a = calcOvertime(t("07:30"), t("19:00"), false);
    expect(calcOvertimeWithBreaks(t("07:30"), t("19:00"), false, [])).toEqual({ ...a, breakMinutes: 0 });
  });
  it("저녁 초과 구간 안의 외출은 초과근무에서 빠진다", () => {
    // 07:30~20:00, 18:30~19:00 외출 → 오전 60분 + 오후 (120-30)=90분
    expect(calcOvertimeWithBreaks(t("07:30"), t("20:00"), false, [{ started_at: t("18:30"), ended_at: t("19:00") }]))
      .toEqual({ total: 150, morning: 60, afternoon: 90, breakMinutes: 30 });
  });
  it("외출로 실제 근무가 8시간이 안 되면 초과근무 없음", () => {
    // 08:00~18:30 (630분) - 외출 160분 = 470분
    expect(calcOvertimeWithBreaks(t("08:00"), t("18:30"), false, [{ started_at: t("13:00"), ended_at: t("15:40") }]).total).toBe(0);
  });
  it("휴일은 외출을 뺀 전부가 초과근무", () => {
    expect(calcOvertimeWithBreaks(t("09:00", "2026-11-22"), t("13:00", "2026-11-22"), true, [{ started_at: t("11:00", "2026-11-22"), ended_at: t("11:30", "2026-11-22") }]))
      .toEqual({ total: 210, morning: 0, afternoon: 210, breakMinutes: 30 });
  });
});
