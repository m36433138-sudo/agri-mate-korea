import { describe, expect, it } from "vitest";
import { repairDocNumber, repairToStatement, type RepairForStatement } from "./repairStatement";
import { statementHtml } from "./printPartSale";

const base: RepairForStatement = {
  id: "ab12cd34-0000", repair_date: "2026-11-25", repair_content: "유압 호스 교체", technician: "김영일",
  labor_cost: 50000, total_cost: 140000, notes: null,
  machine: { model_name: "YT5113A", serial_number: "TJB14104" }, customer: { name: "김정균", phone: "010-1111-2222", address: "강진군" },
  parts: [{ part_number: "1E8420-55430", part_name: "유압호스", quantity: 2, unit_price: 45000 }],
};

describe("수리 거래명세서", () => {
  it("부품 + 공임 줄, 미수금 없으면 완납", () => {
    const d = repairToStatement(base);
    expect(repairDocNumber(base)).toBe("RP-261125-AB12");
    expect(d.lines.map((l) => [l.name, l.amount])).toEqual([["유압호스", 90000], ["공임 (김영일)", 50000]]);
    expect(d).toMatchObject({ subtotal: 140000, total: 140000, paid: 140000, payLabel: "완납" });
    expect(d.notes).toContain("YT5113A (TJB14104)");
  });
  it("미수금이 남아 있으면 외상·일부 입금", () => {
    expect(repairToStatement({ ...base, receivable: { amount: 140000, paid_amount: 0, is_paid: false } })).toMatchObject({ paid: 0, payLabel: "외상" });
    expect(repairToStatement({ ...base, receivable: { amount: 140000, paid_amount: 40000, is_paid: false } })).toMatchObject({ paid: 40000, payLabel: "일부 입금" });
  });
  it("무상(서비스): 원래 금액을 남기고 합계 0원, 영수", () => {
    const d = repairToStatement({ ...base, total_cost: 0, is_free_service: true, waived_amount: 140000, free_reason: "보증기간 내 불량" });
    expect(d).toMatchObject({ total: 0, payLabel: "무상(서비스)", freeService: { waived: 140000, reason: "보증기간 내 불량" } });
    const html = statementHtml(d);
    expect(html).toContain("무 상 (서 비 스)");
    expect(html).toContain("140,000원을 무상으로");
    expect(html).toContain("보증기간 내 불량");
    expect(html).toContain("정히 영수합니다");
  });
});
