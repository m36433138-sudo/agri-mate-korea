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
