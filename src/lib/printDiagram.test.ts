import { describe, it, expect } from "vitest";
import { checkedDiagramHtml } from "./printDiagram";

describe("체크 도면 인쇄", () => {
  const html = checkedDiagramHtml({
    title: "Fig.236 엔진실커버(1)", model: "AW695", imageUrl: "https://x/y.jpg",
    boxes: [{ x: 10, y: 20, w: 2, h: 1.5, round: true }],
    parts: [{ code: "1E8940-76011", name: "엔진실커버A", no: "3" }],
  });
  it("체크한 부품만 표시 상자로 그린다", () => {
    expect(html.match(/class="mk/g)?.length).toBe(1);
  });
  it("체크한 부품번호와 그림 번호가 목록에 들어간다", () => {
    expect(html).toContain("<td>3</td><td class=\"m\">1E8940-76011</td>");
  });
});
