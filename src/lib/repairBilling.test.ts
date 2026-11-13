import { describe, it, expect } from "vitest";
import { planRepairReceivable } from "./repairBilling";

describe("planRepairReceivable", () => {
  it("완납이면 미수금을 만들지 않는다", () => {
    expect(planRepairReceivable(150000, "paid", 0, "2026-11-13")).toBeNull();
  });
  it("미수면 전액을 30일 뒤 만기로 잡는다", () => {
    expect(planRepairReceivable(150000, "unpaid", 0, "2026-11-13")).toEqual({
      amount: 150000, paidAmount: 0, isPaid: false, dueDate: "2026-12-13",
    });
  });
  it("일부 입금은 입금액을 기록하고 잔액을 남긴다", () => {
    expect(planRepairReceivable(150000, "partial", 50000, "2026-11-13")?.paidAmount).toBe(50000);
  });
  it("일부 입금이 총액 이상이면 미수금이 없다", () => {
    expect(planRepairReceivable(150000, "partial", 200000, "2026-11-13")).toBeNull();
  });
  it("0원 수리는 미수금이 없다", () => {
    expect(planRepairReceivable(0, "unpaid", 0, "2026-11-13")).toBeNull();
  });
});
