import { describe, it, expect } from "vitest";
import { receiptToRows, totalsByCategory, expenseSheet, type Expense } from "./expenses";

const extra = { receipt_path: "a/b.jpg", receipt_group: "g1" };

describe("영수증 → 지출 표", () => {
  it("품목마다 한 줄, 0원 안내 줄은 뺀다", () => {
    const rows = receiptToRows({
      vendor: "농협주유소", business_number: null, date: "2026-11-10", payment_method: "카드", total: 85000, vat: null,
      items: [
        { description: "경유", quantity: 50, unit_price: 1700, amount: 85000, category: "유류비" },
        { description: "적립 안내", quantity: null, unit_price: null, amount: 0, category: "기타" },
      ],
    }, "2026-11-17", extra);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ expense_date: "2026-11-10", category: "유류비", amount: 85000, receipt_group: "g1" });
  });
  it("날짜를 못 읽으면 오늘, 목록에 없는 분류는 기타", () => {
    const rows = receiptToRows({ vendor: null, business_number: null, date: "11월", payment_method: null, total: null, vat: null,
      items: [{ description: "볼트", quantity: 1, unit_price: 500, amount: 500, category: "잡화" }] }, "2026-11-17", extra);
    expect(rows[0]).toMatchObject({ expense_date: "2026-11-17", category: "기타" });
  });
  it("줄이 없으면 합계로 한 줄", () => {
    const rows = receiptToRows({ vendor: "한식당", business_number: null, date: null, payment_method: null, total: 32000, vat: null, items: [] }, "2026-11-17", extra);
    expect(rows).toEqual([expect.objectContaining({ amount: 32000, description: "한식당 결제" })]);
  });
  it("분류별 합계는 큰 순", () => {
    expect(totalsByCategory([{ category: "식대", amount: 10000 }, { category: "유류비", amount: 50000 }, { category: "식대", amount: 5000 }]))
      .toEqual([{ category: "유류비", amount: 50000 }, { category: "식대", amount: 15000 }]);
  });
  it("엑셀 마지막 줄은 금액 합계", () => {
    const r = (amount: number) => ({ expense_date: "2026-11-01", category: "기타", description: "", amount } as Expense);
    const sheet = expenseSheet([r(1000), r(2500)]);
    expect(sheet[sheet.length - 1][7]).toBe(3500);
  });
});
