import { describe, it, expect } from "vitest";
import { yanmarSalesPrice, roundTo100, missingPriceFields } from "./partPricing";

describe("yanmarSalesPrice", () => {
  it("공급가 × 1.1 × 1.35를 100원 단위로 반올림한다", () => {
    expect(yanmarSalesPrice(2260660)).toBe(3357100);
  });
  it("십의 자리 5는 올린다", () => {
    expect(roundTo100(12350)).toBe(12400);
    expect(roundTo100(12349)).toBe(12300);
  });
  it("공급가가 없거나 0이면 매출가를 비운다", () => {
    expect(yanmarSalesPrice(0)).toBeNull();
    expect(yanmarSalesPrice(null)).toBeNull();
  });
});

describe("missingPriceFields", () => {
  it("타사 부품은 매입가·매출가가 모두 필요하다", () => {
    expect(missingPriceFields("other", "", "")).toEqual(["매입가", "매출가"]);
    expect(missingPriceFields("other", "1000", "1500")).toEqual([]);
  });
  it("얀마 부품은 가격 칸이 비어도 등록할 수 있다", () => {
    expect(missingPriceFields("yanmar", "", "")).toEqual([]);
  });
});

import { resolvePartPrice } from "./partPricing";

describe("resolvePartPrice (견적 단가 자동 채우기)", () => {
  it("부품관리 매출가가 있으면 그 값을 쓴다", () => {
    expect(resolvePartPrice(55000, 10000)).toEqual({ price: 55000, source: "재고" });
  });
  it("부품관리 매출가가 없으면 공급가표 공급가 × 1.1 × 1.35 (100원 반올림)", () => {
    // 10,000 × 1.1 × 1.35 = 14,850 → 14,900
    expect(resolvePartPrice(null, 10000)).toEqual({ price: 14900, source: "공급가표" });
  });
  it("매출가 0원은 미등록으로 보고 공급가표로 채운다", () => {
    expect(resolvePartPrice(0, 10000)?.source).toBe("공급가표");
  });
  it("둘 다 없으면 null", () => {
    expect(resolvePartPrice(null, undefined)).toBeNull();
  });
});
