import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { buildEstimateSheets } from "./estimateDiagrams";
import type { EstimateItem } from "./insuranceEstimate";

const it_ = (code: string, diagram: string | null, type: EstimateItem["item_type"] = "부품"): EstimateItem =>
  ({ key: code, item_type: type, part_code: code, part_name: code, quantity: 1, unit_price: 1, diagram_id: diagram });

describe("견적 도면 묶기", () => {
  const diagrams = [
    { id: "d1", title: "주행 체인", model_name: "YH7140", image_path: "a.jpg" },
    { id: "d2", title: "엔진", model_name: "YH7140", image_path: "b.jpg" },
  ];
  const hotspots = [
    { diagram_id: "d1", part_code: "1e6680-14200", x: 10, y: 20, w: 5, h: 3 },
    { diagram_id: "d1", part_code: "1A1040-26060", x: 40, y: 50, w: 2, h: 2, callout_no: "7" },
    { diagram_id: "d1", part_code: "NOT-IN-ESTIMATE", x: 1, y: 1, w: 1, h: 1 },
    { diagram_id: "d1", part_code: "1E6680-14200", x: 0, y: 0, w: 9, h: 9, target_diagram_id: "d9" },
    { diagram_id: "d2", part_code: "129F01-19800", x: 70, y: 30, w: 4, h: 4 },
  ];
  const url = (p: string) => `https://img/${p}`;

  it("견적 줄 번호로 자기 도면 위 자리를 표시하고, 같은 도면의 다른 견적 부품도 칠한다", () => {
    const items = [it_("1E6680-14200", "d1"), it_("", null, "공임"), it_("129F01-19800", "d2"), it_("1A1040-26060", null)];
    const s = buildEstimateSheets(items, diagrams, hotspots, url);
    expect(s.map((x) => x.id)).toEqual(["d1", "d2"]);
    expect(s[0].marks).toEqual([
      { no: 1, x: 10, y: 20, w: 5, h: 3, round: false },
      { no: 4, x: 40, y: 50, w: 2, h: 2, round: true },
    ]);
    expect(s[1]).toMatchObject({ title: "엔진", imageUrl: "https://img/b.jpg", marks: [{ no: 3 }] });
  });

  it("그림 주소가 없거나 표시할 자리가 없는 도면은 뺀다", () => {
    expect(buildEstimateSheets([it_("1E6680-14200", "d1")], diagrams, hotspots, () => null)).toEqual([]);
    expect(buildEstimateSheets([it_("ZZZ", "d2")], diagrams, hotspots, url)).toEqual([]);
  });
});
