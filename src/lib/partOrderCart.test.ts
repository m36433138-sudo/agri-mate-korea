import { describe, it, expect } from "vitest";
import { mergeItem, toOrderRows } from "./partOrderCart";

describe("부품 주문 목록", () => {
  it("같은 부품번호를 다시 담으면 수량이 합쳐진다", () => {
    const a = mergeItem([], { partCode: "129978-01331", partName: "필터", qty: 1 });
    const b = mergeItem(a, { partCode: "129978-01331", partName: "필터", qty: 2 });
    expect(b).toHaveLength(1);
    expect(b[0].qty).toBe(3);
  });
  it("발주 엑셀 금액 = 단가 × 수량", () => {
    const rows = toOrderRows([{ partCode: "A", partName: "x", qty: 3, unitPrice: 12000 }]);
    expect(rows[0].금액).toBe(36000);
    expect(rows[0].순번).toBe(1);
  });
});
