import { describe, it, expect } from "vitest";
import { partSaleTotals, validatePartSale, addPartSaleLine, shortageLines, type PartSaleLine } from "./partSales";

const lines: PartSaleLine[] = [
  { part_code: "129961-77200", part_name: "필터", quantity: 2, unit_price: 15000, stock: 5 },
  { part_code: "198461-55120", part_name: "벨트", quantity: 1, unit_price: 42000, stock: 0 },
];
const base = { lines, customerId: null as string | null, buyerName: "김손님", discount: 0, mode: "paid" as const, partialPaid: 0 };

describe("부품 판매 합계", () => {
  it("수량×단가 합에서 할인을 뺀다", () => {
    expect(partSaleTotals(lines, 2000, "paid", 0)).toMatchObject({ subtotal: 72000, total: 70000, paid: 70000, receivable: 0 });
  });
  it("외상이면 합계 전부가 미수금이다", () => {
    expect(partSaleTotals(lines, 0, "unpaid", 0).receivable).toBe(72000);
  });
  it("일부 입금이면 남은 금액만 미수금이다", () => {
    expect(partSaleTotals(lines, 0, "partial", 30000).receivable).toBe(42000);
  });
});

describe("부품 판매 저장 전 확인", () => {
  it("고객 등록 없이 손님 이름만으로 현금 판매할 수 있다", () => {
    expect(validatePartSale(base)).toBeNull();
  });
  it("외상은 등록된 고객을 골라야 한다", () => {
    expect(validatePartSale({ ...base, mode: "unpaid" })).toMatch(/고객을 골라야/);
  });
  it("외상도 등록된 고객이면 저장된다", () => {
    expect(validatePartSale({ ...base, mode: "unpaid", customerId: "c1" })).toBeNull();
  });
  it("고객도 손님 이름도 없으면 막는다", () => {
    expect(validatePartSale({ ...base, buyerName: " " })).toMatch(/손님 이름/);
  });
  it("일부 입금액이 합계 이상이면 막는다", () => {
    expect(validatePartSale({ ...base, mode: "partial", customerId: "c1", partialPaid: 72000 })).toMatch(/일부 입금액/);
  });
  it("할인이 합계보다 크면 막는다", () => {
    expect(validatePartSale({ ...base, discount: 80000 })).toMatch(/할인/);
  });
});

describe("부품 담기·재고 경고", () => {
  it("같은 부품을 다시 담으면 수량을 합친다", () => {
    const next = addPartSaleLine(lines, { part_code: "129961-77200", part_name: "필터", quantity: 3, unit_price: 15000 });
    expect(next).toHaveLength(2);
    expect(next[0].quantity).toBe(5);
  });
  it("판매 후 재고가 마이너스가 되는 부품만 알려준다", () => {
    expect(shortageLines(lines).map((l) => l.part_code)).toEqual(["198461-55120"]);
  });
});
