import { describe, expect, it } from "vitest";
import { buildRepairTrend, changePct, recentMonths, trendStart } from "./repairTrend";

const today = new Date(2026, 10, 22); // 2026-11-22

describe("repairTrend", () => {
  it("lists the last 12 months ending this month, across the year boundary", () => {
    const m = recentMonths(today);
    expect(m).toHaveLength(12);
    expect(m[0]).toBe("2025-12");
    expect(m[11]).toBe("2026-11");
    expect(trendStart(today)).toBe("2025-12-01");
  });

  it("sums sales split into labor and parts per month, ignoring rows outside the range", () => {
    const t = buildRepairTrend([
      { repair_date: "2026-11-02", labor_cost: 80000, total_cost: 455000, technician: "김영일" },
      { repair_date: "2026-11-20", labor_cost: 0, total_cost: 200000, technician: null },
      { repair_date: "2026-10-05", labor_cost: 60000, total_cost: 145000, technician: "마성수" },
      { repair_date: "2024-01-01", labor_cost: 1, total_cost: 999999, technician: "x" },
      { repair_date: null, labor_cost: 1, total_cost: 1, technician: "x" },
    ], today);
    const nov = t.months[11];
    expect(nov).toMatchObject({ label: "11월", total: 655000, labor: 80000, parts: 575000, count: 2 });
    expect(t.months[10]).toMatchObject({ total: 145000, count: 1 });
    expect(t.thisMonth).toEqual({ total: 655000, count: 2 });
    expect(t.countChange).toBe(100);
    expect(t.technicians).toEqual([{ name: "김영일", count: 1 }, { name: "미지정", count: 1 }]);
  });

  it("compares this month with the same days of last month", () => {
    const t = buildRepairTrend([
      { repair_date: "2026-11-10", labor_cost: 0, total_cost: 300, technician: null },
      { repair_date: "2026-10-22", labor_cost: 0, total_cost: 200, technician: null },
      { repair_date: "2026-10-23", labor_cost: 0, total_cost: 9999, technician: null }, // 오늘(22일) 이후라 비교에서 빠짐
    ], today);
    expect(t.lastMonthToDate).toEqual({ total: 200, count: 1 });
    expect(t.lastMonth.total).toBe(10199);
    expect(t.totalChange).toBe(50);
    expect(t.countChange).toBe(0);
  });

  it("treats labor-only repairs (no total) as sales and never goes negative", () => {
    const t = buildRepairTrend([{ repair_date: "2026-11-01", labor_cost: 50000, total_cost: 0, technician: "a" }], today);
    expect(t.months[11]).toMatchObject({ total: 50000, labor: 50000, parts: 0 });
  });

  it("does not compare against an empty previous month", () => {
    expect(changePct(100, 0)).toBeNull();
    expect(changePct(90, 100)).toBe(-10);
  });
});
