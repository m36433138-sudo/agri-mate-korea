import { describe, it, expect } from "vitest";
import { rankRepairDiagrams, bookMatchesMachine } from "./repairDiagrams";

const diagrams = new Map([
  ["a", { id: "a", title: "Fig.10 미션", model_name: "YT490 / YT5101 / YT5113" }],
  ["b", { id: "b", title: "Fig.341 탱크커버", model_name: "YH6140 / YH7140" }],
  ["c", { id: "c", title: "Fig.12 엔진", model_name: "YH6140 / YH7140" }],
]);

describe("수리 부품 → 도면 찾기", () => {
  it("YH7140DXK 기계는 YH6140 / YH7140 책과 같은 기종", () => {
    expect(bookMatchesMachine("YH6140 / YH7140", "YH7140DXK")).toBe(true);
    expect(bookMatchesMachine("YT490 / YT5101 / YT5113", "YH7140")).toBe(false);
  });
  it("같은 기종 도면을 먼저, 같은 기종끼리는 겹치는 부품이 많은 순", () => {
    const r = rankRepairDiagrams(
      [
        { diagram_id: "a", part_code: "1" }, { diagram_id: "a", part_code: "2" }, { diagram_id: "a", part_code: "3" },
        { diagram_id: "b", part_code: "1" },
        { diagram_id: "c", part_code: "1" }, { diagram_id: "c", part_code: "2" },
      ],
      diagrams,
      "YH7140",
    );
    expect(r.map((x) => x.diagramId)).toEqual(["c", "b", "a"]);
  });
});
