import { describe, expect, it } from "vitest";
import { codeFromDescription, defaultLocation, findYanmarVendor, generalPartCode, guessBranch, matchVendor, normalizeVendorName } from "./partReceipts";

const vendors = [
  { id: "v1", name: "대원정공", business_number: null },
  { id: "v2", name: "(주)한일로우더", business_number: "123-45-67890" },
  { id: "v3", name: "얀마코리아 부품", business_number: null },
];

describe("거래처 찾기", () => {
  it("사업자번호가 같으면 이름이 달라도 그 거래처", () => {
    expect(matchVendor(vendors, "한일", "1234567890")?.id).toBe("v2");
  });
  it("(주)·주식회사·공백을 무시하고 이름으로 찾는다", () => {
    expect(normalizeVendorName("주식회사 한일 로우더")).toBe("한일로우더");
    expect(matchVendor(vendors, "한일로우더 주식회사", null)?.id).toBe("v2");
    expect(matchVendor(vendors, "대원정공(주)", null)?.id).toBe("v1");
  });
  it("모르는 거래처면 null, 얀마는 따로 찾는다", () => {
    expect(matchVendor(vendors, "삼성공구", null)).toBeNull();
    expect(matchVendor(vendors, "", null)).toBeNull();
    expect(findYanmarVendor(vendors)?.id).toBe("v3");
  });
});

describe("지점 추정 (명세서 위치 ↔ 재고 위치)", () => {
  const stock = [
    { branch: "강진", part_code: "129F01-19800", location_main: "J2" },
    { branch: "장흥", part_code: "129F01-19800", location_main: "X-20" },
    { branch: "강진", part_code: "1E6684-17551", location_main: "U19-8" },
    { branch: "장흥", part_code: "1E6684-17551", location_main: "JDD5-8" },
  ];
  it("위치가 많이 맞는 지점", () => {
    expect(guessBranch([{ partCode: "129F01-19800", location: "J2" }, { partCode: "1E6684-17551", location: "u19-8" }], stock)).toBe("강진");
    expect(guessBranch([{ partCode: "129F01-19800", location: "X-20" }], stock)).toBe("장흥");
  });
  it("근거가 없으면 null", () => {
    expect(guessBranch([{ partCode: "NEW-1", location: "Z9" }, { partCode: "X", location: null }], stock)).toBeNull();
  });
  it("위치 기본값: 명세서 → 기존 재고", () => {
    expect(defaultLocation("장흥", "129F01-19800", null, stock)).toBe("X-20");
    expect(defaultLocation("장흥", "129F01-19800", "K1", stock)).toBe("K1");
    expect(defaultLocation("장흥", "NEW", null, stock)).toBeNull();
  });
});

describe("번호 없는 일반 부품", () => {
  it("같은 거래처·같은 품명이면 같은 번호", () => {
    const a = generalPartCode("(주)한일로우더", "로우더 핀 25mm");
    expect(a).toBe(generalPartCode("한일로우더", "로우더핀 25MM"));
    expect(a).toBe("한일로우더-로우더핀25MM");
    expect(generalPartCode(null, "")).toBe("일반-품목");
  });
  it("설명 안의 부품번호를 뽑는다", () => {
    expect(codeFromDescription("오일필터 1a1040-26060 2개")).toBe("1A1040-26060");
    expect(codeFromDescription("그리스 20L")).toBeNull();
  });
});
