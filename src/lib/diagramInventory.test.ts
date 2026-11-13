import { describe, expect, it } from "vitest";
import { matchesInventory } from "./diagramInventory";

describe("체크한 부품 재고 연결", () => {
  it("실제 번호와 대체 번호, 접미 번호를 연결한다", () => {
    expect(matchesInventory("129978-01331", { part_code: "129978-01331-YNK", alt_part_code: null })).toBe(true);
    expect(matchesInventory("129978-01331", { part_code: "OTHER", alt_part_code: "129978-01331" })).toBe(true);
  });
  it("번호 일부가 같은 다른 부품은 연결하지 않는다", () => {
    expect(matchesInventory("129978-01331", { part_code: "129978-013310", alt_part_code: null })).toBe(false);
    expect(matchesInventory("129978-01331", { part_code: "129978-01332", alt_part_code: null })).toBe(false);
  });
});