import { describe, expect, it } from "vitest";
import { buildRecordIndex, catalogHaystack, matchesCatalogQuery, type CatalogEntry } from "./errorCodeCatalog";

const entry = (code: string, part = ""): CatalogEntry => ({
  id: code, code, machine_types: ["콤바인"], series: "테스트", controller: null, part, symptom: null,
  cause: null, remedy: null, recovery: null, source: "TTS", source_url: null, sort_order: 0,
});

describe("manual codes find our repair records", () => {
  const records = [
    { id: "a", error_code: "84 04610.12" },
    { id: "b", error_code: "8506530.03" },
    { id: "c", error_code: "C1-220" },
  ];
  const lookup = buildRecordIndex(records);
  it("a ** manual code collects every FMI recorded for it", () => {
    expect(lookup("84 04610.**").map((r) => r.id)).toEqual(["a"]);
  });
  it("a code typed without spaces is still found", () => {
    expect(lookup("85 06530.03").map((r) => r.id)).toEqual(["b"]);
  });
  it("a code nobody has recorded returns nothing", () => {
    expect(lookup("85 06530.04")).toEqual([]);
  });
});

describe("catalogue search", () => {
  it("finds a code by its last digits only", () => {
    expect(matchesCatalogQuery(catalogHaystack(entry("84 04610.**")), "04610")).toBe(true);
  });
  it("finds a spaced code typed the way it appears on the meter", () => {
    expect(matchesCatalogQuery(catalogHaystack(entry("03 02000.03")), "02000 03")).toBe(true);
  });
  it("finds by part name in Korean", () => {
    expect(matchesCatalogQuery(catalogHaystack(entry("C1-220", "UFO 미세 조정볼륨")), "조정볼륨")).toBe(true);
  });
  it("does not match an unrelated code", () => {
    expect(matchesCatalogQuery(catalogHaystack(entry("03 02000.03")), "07400")).toBe(false);
  });
});

import { machineFitScore, searchCatalogForMachine } from "./errorCodeCatalog";

describe("수리 등록 에러코드 검색", () => {
  const e = (code: string, series: string, types: string[], part = "", order = 0) =>
    ({ id: code + series, code, series, machine_types: types, controller: null, part, symptom: null, cause: null, remedy: null, recovery: null, source: "", source_url: null, sort_order: order });
  const yh = e("00 00CAA.04", "YH1150 콤바인", ["콤바인"], "DPF입구온도센서", 2);
  const yt = e("28 00083.09", "YT 시리즈 트랙터", ["트랙터"], "METER 버스오프", 1);
  const aw = e("84 03500.**", "AW6114·AW7114 / YH6115·YH7115 콤바인", ["콤바인"], "예취포지션센서", 3);

  it("모델명 → 계열 → 기계 종류 순으로 맞춘다", () => {
    expect(machineFitScore(yh, "YH1150", null)).toBe(3);
    expect(machineFitScore(aw, "YH7115", null)).toBe(3);
    expect(machineFitScore(yt, "YT5113A", null)).toBe(2);
    expect(machineFitScore(aw, "YH1150", null)).toBe(2); // 같은 YH 계열
    expect(machineFitScore(e("엔진램프", "GS400 콤바인", ["콤바인"]), "YH1150", null)).toBe(1); // 같은 콤바인
    expect(machineFitScore(yt, "YH1150", null)).toBe(0);
  });
  it("코드 조각·증상으로 찾고, 내 기계 코드를 먼저", () => {
    expect(searchCatalogForMachine([yt, yh, aw], "00caa", "YH1150").map((r) => r.entry.code)).toEqual(["00 00CAA.04"]);
    expect(searchCatalogForMachine([yt, yh, aw], "센서", "YH7115").map((r) => r.entry.code)).toEqual(["84 03500.**", "00 00CAA.04"]);
    expect(searchCatalogForMachine([yt, yh, aw], "", "YH1150")).toEqual([]);
  });
});
