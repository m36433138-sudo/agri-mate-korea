import { describe, it, expect } from "vitest";
import { partQueryVariants, inventorySearchFilter } from "./partSearch";

describe("부품번호 검색", () => {
  it("뒷자리 77200만 쳐도 그대로 부분 검색한다", () => {
    expect(inventorySearchFilter("77200")).toContain("part_code.ilike.%77200%");
  });
  it("하이픈 없이 12996177200을 치면 129961-77200도 찾는다", () => {
    expect(partQueryVariants("12996177200")).toContain("129961-77200");
  });
  it("설계변경코드에서도 찾는다", () => {
    expect(inventorySearchFilter("77200")).toContain("alt_part_code.ilike.%77200%");
  });
  it("쉼표·괄호는 지워 조회 조건이 깨지지 않는다", () => {
    expect(inventorySearchFilter("볼트(M6,16)")).toBe("part_code.ilike.%볼트M616%,alt_part_code.ilike.%볼트M616%,part_name.ilike.%볼트M616%");
  });
});
