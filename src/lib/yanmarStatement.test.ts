import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/yanmar-statement-vkt16954.json";
import { isYanmarStatement, parseYanmarStatement, type PdfTextPage } from "./yanmarStatement";

const pages = fixture as PdfTextPage[];

describe("얀마 거래명세서 읽기 (실제 VKT16954, 2쪽 21줄)", () => {
  const s = parseYanmarStatement(pages);

  it("얀마 명세서로 알아본다", () => {
    expect(isYanmarStatement(pages)).toBe(true);
    expect(isYanmarStatement([{ width: 595, height: 842, items: [{ x: 10, y: 10, str: "주유소 영수증" }] }])).toBe(false);
  });

  it("문서번호·날짜·합계를 읽는다", () => {
    expect(s.docNumber).toBe("VKT16954");
    expect(s.date).toBe("2026-11-20");
    expect(s.supplyTotal).toBe(12912290);
    expect(s.vatTotal).toBe(1291229);
    expect(s.grandTotal).toBe(14203519);
  });

  it("21줄 모두 부품번호·위치·수량·단가·금액을 읽고 합계가 맞는다", () => {
    expect(s.lines).toHaveLength(21);
    expect(s.problems).toEqual([]);
    expect(s.lines[0]).toMatchObject({ lineNo: 1, orderNo: "CKT28427-001-001", partCode: "129F01-19800", nameHint: "SENSOR, NOX", location: "J2", quantity: 3, unitPrice: 671110, amount: 2013330, vat: 201333, total: 2214663 });
    expect(s.lines[4]).toMatchObject({ partCode: "1E6684-17551", location: "U19-8", quantity: 50 });
    expect(s.lines[15]).toMatchObject({ partCode: "1E9441-26510", altCode: "1E9110-26510", location: "VV3-2", quantity: 10 });
    expect(s.lines[16]).toMatchObject({ lineNo: 17, partCode: "1J5255-30201", location: null, quantity: 1 });
    expect(s.lines[20]).toMatchObject({ lineNo: 21, partCode: "BAT-611451", location: "P0-5", quantity: 40, total: 3366440 });
  });

  it("수량×단가가 금액과 다르면 알려 준다", () => {
    const broken = structuredClone(pages);
    const it = broken[0].items.find((i) => i.str === "2,013,330")!;
    it.str = "2,000,000";
    const r = parseYanmarStatement(broken);
    expect(r.problems.some((p) => p.startsWith("1번 줄"))).toBe(true);
  });
});
