import { describe, it, expect } from "vitest";
import { mergeDiagramParts, modelFromMachineLabel, rowsToPanelItems } from "./repairDiagramParts";
import type { EstimateItem } from "./insuranceEstimate";

type Row = { part_id: string; part_name: string; part_number: string; quantity: number; unit_price: number; fromTemplate?: string };
const pick = (code: string, qty: number, price: number): EstimateItem => ({ key: code, item_type: "부품", part_code: code, part_name: "N", quantity: qty, unit_price: price });
const make = (it: EstimateItem): Row => ({ part_id: "new", part_name: it.part_name, part_number: it.part_code, quantity: it.quantity, unit_price: it.unit_price });

describe("mergeDiagramParts", () => {
  it("같은 부품번호면 수량을 더하고 기존 단가는 유지한다", () => {
    const rows: Row[] = [{ part_id: "a", part_name: "볼트", part_number: "129961-77200", quantity: 2, unit_price: 5000 }];
    const out = mergeDiagramParts(rows, [pick("129961-77200", 3, 7000)], make);
    expect(out).toHaveLength(1);
    expect(out[0].quantity).toBe(5);
    expect(out[0].unit_price).toBe(5000);
  });
  it("기존 단가가 0이면 도면 쪽 매출가로 채운다", () => {
    const rows: Row[] = [{ part_id: "a", part_name: "볼트", part_number: "X1", quantity: 1, unit_price: 0 }];
    expect(mergeDiagramParts(rows, [pick("x1", 1, 3300)], make)[0].unit_price).toBe(3300);
  });
  it("템플릿 줄과는 합치지 않고 새 줄로 넣는다", () => {
    const rows: Row[] = [{ part_id: "a", part_name: "볼트", part_number: "X1", quantity: 1, unit_price: 100, fromTemplate: "t" }];
    expect(mergeDiagramParts(rows, [pick("X1", 1, 100)], make)).toHaveLength(2);
  });
});

it("기계 표시 이름에서 모델명만 뽑는다", () => {
  expect(modelFromMachineLabel("YH6140 (SN12345)")).toBe("YH6140");
  expect(modelFromMachineLabel("")).toBeNull();
});

it("오른쪽 목록 줄은 수리 부품 순서대로 번호 key를 갖는다", () => {
  const items = rowsToPanelItems([{ part_number: "A", part_name: "a", quantity: 2, unit_price: 10 }, { part_number: "B", part_name: "b", quantity: 1, unit_price: 0 }]);
  expect(items.map((i) => i.key)).toEqual(["0", "1"]);
  expect(items[0].quantity).toBe(2);
});
