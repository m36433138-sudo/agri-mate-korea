import { describe, expect, it } from "vitest";
import { addEstimateItem, estimateTotals, parseQtyNote, resolveDiagramQty, type EstimateItem } from "./insuranceEstimate";

const item = (p: Partial<EstimateItem>): EstimateItem => ({ key: "k", item_type: "부품", part_code: "", part_name: "", quantity: 1, unit_price: 0, ...p });

describe("보험 견적 수량", () => {
  it("한 가지 수량(2개)은 그대로 쓴다", () => {
    expect(resolveDiagramQty("소요 수량 · 2개", "YH7140").qty).toBe(2);
  });
  it("기계 기종에 맞는 수량을 고른다 (YH7140-X → YH7140 3)", () => {
    const r = resolveDiagramQty("YH6140 2 / YH7140 3", "YH7140-X");
    expect(r.qty).toBe(3);
    expect(r.matchedModel).toBe("YH7140");
  });
  it("그 기종에 「-」면 안 쓰이는 부품으로 표시한다", () => {
    const r = resolveDiagramQty("AW6114 - / AW7114 1", "AW6114");
    expect(r.qty).toBeNull();
    expect(r.notUsed).toBe(true);
  });
  it("기종을 모르는데 기종마다 수량이 다르면 골라야 한다", () => {
    const r = resolveDiagramQty("EL2200 3개 / EL2400 2개", null);
    expect(r.ambiguous).toBe(true);
    expect(r.options).toEqual([{ model: "EL2200", qty: 3 }, { model: "EL2400", qty: 2 }]);
  });
  it("기종을 몰라도 수량이 모두 같으면 그 수량", () => {
    expect(resolveDiagramQty("AW695 2 / AW695K-C 2", "").qty).toBe(2);
  });
  it("소요 수량 접두어가 붙어 있어도 읽는다", () => {
    expect(parseQtyNote("소요 수량 · 4개")).toEqual([{ model: null, qty: 4 }]);
  });
});

describe("보험 견적 합계", () => {
  it("부품·공임·기타를 나눠 더한다", () => {
    const t = estimateTotals([
      item({ quantity: 2, unit_price: 15000 }),
      item({ item_type: "공임", quantity: 1, unit_price: 50000 }),
      item({ item_type: "기타", quantity: 1, unit_price: 3000 }),
    ]);
    expect(t).toEqual({ parts: 30000, labor: 50000, other: 3000, total: 83000 });
  });
  it("같은 부품번호를 또 담으면 수량만 더한다", () => {
    const a = addEstimateItem([item({ part_code: "1E8080-81650", quantity: 1, unit_price: 9000 })], item({ part_code: "1e8080-81650", quantity: 2 }));
    expect(a).toHaveLength(1);
    expect(a[0].quantity).toBe(3);
    expect(a[0].unit_price).toBe(9000);
  });
  it("공임 줄은 합치지 않는다", () => {
    const a = addEstimateItem([item({ item_type: "공임", part_name: "탈착" })], item({ item_type: "공임", part_name: "탈착" }));
    expect(a).toHaveLength(2);
  });
});

import { syncAutoLabor, AUTO_LABOR_NAME } from "./insuranceEstimate";
describe("syncAutoLabor", () => {
  const p = (q: number, u: number) => ({ key: Math.random().toString(), item_type: "부품" as const, part_code: "A" + u, part_name: "x", quantity: q, unit_price: u });
  it("부품 합계의 20%를 공임으로 넣는다", () => {
    const r = syncAutoLabor([p(2, 50000)], 20);
    expect(r.find((i) => i.part_name === AUTO_LABOR_NAME)?.unit_price).toBe(20000);
  });
  it("부품이 바뀌면 공임도 다시 계산한다", () => {
    const r = syncAutoLabor(syncAutoLabor([p(1, 100000)], 20).concat(p(1, 50000)), 20);
    expect(r.filter((i) => i.item_type === "공임")).toHaveLength(1);
    expect(r.find((i) => i.part_name === AUTO_LABOR_NAME)?.unit_price).toBe(30000);
  });
  it("부품이 없으면 자동 공임을 뺀다", () => {
    const r = syncAutoLabor(syncAutoLabor([p(1, 1000)], 20).filter((i) => i.item_type !== "부품"), 20);
    expect(r).toHaveLength(0);
  });
});

import { qtyChoices } from "./insuranceEstimate";

describe("qtyChoices (견적에서 도면 기종별 수량 고르기)", () => {
  it("같은 수량 기종은 한 버튼으로 묶는다", () => {
    expect(qtyChoices("소요 수량 · YH6140 1 / YH7140 1", null)).toEqual([{ qty: 1, models: ["YH6140", "YH7140"], matched: false }]);
  });
  it("수량이 다르면 기종별 버튼, 이 기계 기종이 맨 앞", () => {
    const c = qtyChoices("YH6140 2 / YH7140 3", "YH7140-X");
    expect(c.map((x) => x.qty)).toEqual([3, 2]);
    expect(c[0].matched).toBe(true);
  });
  it("「-」 기종은 안 씀(qty null)으로 남긴다", () => {
    expect(qtyChoices("AW6114 - / AW7114 1", null)).toEqual([
      { qty: null, models: ["AW6114"], matched: false },
      { qty: 1, models: ["AW7114"], matched: false },
    ]);
  });
  it("기종 없는 「2개」는 수량 버튼 하나", () => {
    expect(qtyChoices("소요 수량 · 2개", null)).toEqual([{ qty: 2, models: [], matched: false }]);
  });
});
