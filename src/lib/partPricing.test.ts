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
