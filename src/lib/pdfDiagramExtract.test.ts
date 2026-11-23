import { describe, it, expect } from "vitest";
import { extractPageHotspots, extractPageTable, diagnosePdf, type PageText } from "./pdfDiagramExtract";

const t = (str: string, x: number, y: number, w = 40, h = 7): PageText => ({ str, x, y, w, h });

describe("PDF 부품표 읽기", () => {
  const page = [
    t("번호", 440, 60, 14), t("부품번호", 500, 60, 28),
    t("1", 446, 80, 4), t("1C7100-51013", 495, 80), t("컨트롤레버", 560, 80),
    t("2", 446, 90, 4), t("1C7100-51050", 495, 90), t("칼러", 560, 90),
    t("2", 300, 300, 5, 8), // 그림 속 번호
  ];
  it("번호표·표 왼쪽 끝·글자 높이를 알려 준다 (그림 아래 문서번호가 있어도 표 왼쪽은 그대로)", () => {
    const r = extractPageTable([...page, t("0CNP7-M01460", 20, 20, 50)], 842, 595);
    expect([...r.refs]).toEqual([["1", "1C7100-51013"], ["2", "1C7100-51050"]]);
    expect(r.tableLeft).toBe(436);
    expect(r.textHeight).toBe(7);
    expect(r.textCallouts).toBe(1);
  });
  it("부품번호 옆 이름과 같은 줄을 붙인다", () => {
    const h = extractPageHotspots(page, 842, 595).filter((x) => !x.callout_no);
    expect(h.map((x) => [x.part_code, x.part_name])).toEqual([["1C7100-51013", "컨트롤레버"], ["1C7100-51050", "칼러"]]);
  });
  it("그림 속 번호 2는 부품표 2번 부품으로 연결된다", () => {
    const c = extractPageHotspots(page, 842, 595).filter((x) => x.callout_no);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ callout_no: "2", part_code: "1C7100-51050" });
  });
  it("타사 번호(하이픈 없는 8자리)는 「타사 형식」을 켰을 때 머리글 칸에서만 읽는다", () => {
    const ls = [t("부품번호", 500, 60, 28), t("40250012", 495, 80), t("오일필터", 560, 80), t("2026", 100, 20)];
    expect(extractPageHotspots(ls, 842, 595)).toHaveLength(0);
    expect(extractPageHotspots(ls, 842, 595, { loose: true }).map((x) => x.part_code)).toEqual(["40250012"]);
  });
  it("글자 없는 스캔본이면 스캔본이라고 알려 준다", () => {
    expect(diagnosePdf([{ page: 1, textCount: 0, yanmarCodes: 0, looseCodes: 0 }, { page: 2, textCount: 1, yanmarCodes: 0, looseCodes: 0 }]).kind).toBe("scan");
  });
});
