import { describe, expect, it } from "vitest";
import { isSearchTerm, searchDiagrams, type PartHit, type SearchableDiagram } from "./diagramSearch";

const dg = (
  id: string,
  title: string,
  model_name: string | null,
  kind: SearchableDiagram["kind"] = "diagram",
): SearchableDiagram => ({ id, title, model_name, kind });

const ALL = { kind: "diagram" as const, model: "전체" };

describe("isSearchTerm", () => {
  it("1글자는 검색하지 않고 2글자부터 검색한다", () => {
    expect(isSearchTerm("1")).toBe(false);
    expect(isSearchTerm(" 1 ")).toBe(false);
    expect(isSearchTerm("12")).toBe(true);
    expect(isSearchTerm(" YH ")).toBe(true);
  });
});

describe("searchDiagrams", () => {
  const diagrams = [
    dg("a", "YH1150 엔진 Fig.1 실린더블럭", "YH1150"),
    dg("b", "YH1150 예취부 Fig.3", "YH1150"),
    dg("c", "YT490/YT5101/YT5113 엔진 Fig.1", "YT490/YT5101/YT5113"),
    dg("d", "YH1150 좌측면", "YH1150", "photo"),
  ];

  it("용어가 없으면 필터만 적용해 전체 도면을 순서대로 돌려준다", () => {
    const out = searchDiagrams(diagrams, "", new Map(), ALL);
    expect(out.map((h) => h.diagram.id)).toEqual(["a", "b", "c"]);
    expect(out.every((h) => h.partCount === 0)).toBe(true);
  });

  it("도면명으로 검색하면 그 도면만 남는다", () => {
    const out = searchDiagrams(diagrams, "예취", new Map(), ALL);
    expect(out.map((h) => h.diagram.id)).toEqual(["b"]);
    expect(out[0].matchedTitle).toBe(true);
    expect(out[0].matchedModel).toBe(false);
  });

  it("기종으로 검색하면 그 기종 도면이 남고 기종 일치로 표시된다", () => {
    const out = searchDiagrams(diagrams, "YH1150", new Map(), ALL);
    expect(out.map((h) => h.diagram.id)).toEqual(["a", "b"]);
    expect(out.every((h) => h.matchedModel)).toBe(true);
  });

  it("부품번호 검색 결과는 도면명·기종 결과보다 먼저 온다", () => {
    const hits = new Map<string, PartHit>([
      ["c", { codes: ["129978-01331"], count: 1 }],
      ["b", { codes: ["1A8060-42510"], count: 4 }],
    ]);
    const out = searchDiagrams(diagrams, "129978", hits, ALL);
    expect(out.map((h) => h.diagram.id)).toEqual(["b", "c"]);
    expect(out[0].partCodes).toEqual(["1A8060-42510"]);
    expect(out[0].partCount).toBe(4);
  });

  it("부품번호로만 걸린 도면도 결과에 남는다", () => {
    const hits = new Map<string, PartHit>([["c", { codes: ["129978-01331"], count: 2 }]]);
    const out = searchDiagrams(diagrams, "129978-01331", hits, ALL);
    expect(out.map((h) => h.diagram.id)).toEqual(["c"]);
    expect(out[0].matchedTitle).toBe(false);
    expect(out[0].matchedModel).toBe(false);
    expect(out[0].partCodes).toEqual(["129978-01331"]);
  });

  it("기종 칩과 사진/도면 탭 필터는 검색과 함께 적용된다", () => {
    const out = searchDiagrams(diagrams, "Fig", new Map(), { kind: "diagram", model: "YH1150" });
    expect(out.map((h) => h.diagram.id)).toEqual(["a", "b"]);

    const photo = searchDiagrams(diagrams, "좌측", new Map(), { kind: "photo", model: "전체" });
    expect(photo.map((h) => h.diagram.id)).toEqual(["d"]);

    const yt = searchDiagrams(diagrams, "Fig", new Map(), { kind: "diagram", model: "YT490 / YT5101 / YT5113" });
    expect(yt.map((h) => h.diagram.id)).toEqual(["c"]);
  });

  it("기종과 도면명을 띄어 써서 함께 검색할 수 있다", () => {
    const list = [
      dg("x", "YH6140 / YH7140 Fig.341. 탱크커버", "YH6140 / YH7140"),
      dg("y", "YH6115·YH7115 Fig.300 탱크커버", "YH6115 / YH7115"),
    ];
    const out = searchDiagrams(list, "YH7140 탱크커버", new Map(), ALL);
    expect(out.map((h) => h.diagram.id)).toEqual(["x"]);
    expect(out[0].matchedTitle).toBe(true);
    expect(out[0].matchedModel).toBe(true);
  });

  it("하나도 안 맞으면 빈 목록", () => {
    expect(searchDiagrams(diagrams, "없음", new Map(), ALL)).toEqual([]);
  });
});
