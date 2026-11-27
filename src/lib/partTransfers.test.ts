import { describe, expect, it } from "vitest";
import { addTransferLine, otherWarehouse, transferPayload, validateTransfer } from "./partTransfers";

const base = { part_code: "A1", part_name: "필터", stock: 2, dest_qty: null, dest_location: null };

describe("창고 이동", () => {
  it("같은 부품을 또 담으면 재고 한도 안에서 하나씩 늘린다", () => {
    let l = addTransferLine([], base);
    l = addTransferLine(l, base);
    l = addTransferLine(l, base);
    expect(l).toHaveLength(1);
    expect(l[0].quantity).toBe(2);
  });
  it("재고보다 많이 옮기거나 0개면 막는다", () => {
    expect(validateTransfer([])).toMatch(/담아/);
    expect(validateTransfer([{ ...base, quantity: 3, to_location: "" }])).toMatch(/2개뿐/);
    expect(validateTransfer([{ ...base, quantity: 0, to_location: "" }])).toMatch(/1개 이상/);
    expect(validateTransfer([{ ...base, quantity: 2, to_location: "" }])).toBeNull();
  });
  it("보낼 때 빈 위치는 null, 반대 창고를 고른다", () => {
    expect(transferPayload([{ ...base, quantity: 1, to_location: "  " }])).toEqual([{ part_code: "A1", quantity: 1, to_location: null }]);
    expect(otherWarehouse("장흥")).toBe("강진");
  });
});
