import { describe, expect, it } from "vitest";
import { addHoldItem, heldQtyByCode, holdOwner, validateHold } from "./partHolds";

describe("빼놓은 부품", () => {
  it("같은 부품은 수량을 합친다", () => {
    const a = addHoldItem([], { part_code: "A1", part_name: "필터", quantity: 1 });
    expect(addHoldItem(a, { part_code: "A1", part_name: "필터", quantity: 2 })).toEqual([{ part_code: "A1", part_name: "필터", quantity: 3 }]);
  });
  it("아직 빼놓은 것만, 지점별로 부품코드 수량을 더한다", () => {
    const holds = [
      { status: "held" as const, branch: "장흥", part_hold_items: [{ part_code: "A1", part_name: "", quantity: 2 }, { part_code: "B2", part_name: "", quantity: 1 }] },
      { status: "held" as const, branch: "장흥", part_hold_items: [{ part_code: "A1", part_name: "", quantity: 1 }] },
      { status: "used" as const, branch: "장흥", part_hold_items: [{ part_code: "A1", part_name: "", quantity: 5 }] },
      { status: "held" as const, branch: "강진", part_hold_items: [{ part_code: "A1", part_name: "", quantity: 7 }] },
    ];
    expect(heldQtyByCode(holds, "장흥").get("A1")).toBe(3);
    expect(heldQtyByCode(holds, "장흥").get("B2")).toBe(1);
    expect(heldQtyByCode(holds).get("A1")).toBe(10);
  });
  it("누구 것인지: 연결 고객 → 적은 이름, 담당", () => {
    expect(holdOwner({ customer_name: "김영수", assignee: "김영일", customers: null })).toBe("김영수 · 담당 김영일");
    expect(holdOwner({ customer_name: null, assignee: null, customers: { name: "박철민" } })).toBe("박철민");
    expect(holdOwner({ customer_name: null, assignee: null, customers: null })).toBe("대상 미정");
  });
  it("부품과 대상이 있어야 저장할 수 있다", () => {
    const item = { part_code: "A1", part_name: "필터", quantity: 1 };
    expect(validateHold({ items: [], customerName: "김", assignee: "", purpose: "" })).toMatch(/부품/);
    expect(validateHold({ items: [item], customerName: "", assignee: "", purpose: "" })).toMatch(/누구/);
    expect(validateHold({ items: [item], customerName: "", assignee: "마성수", purpose: "" })).toBeNull();
  });
});
