import { describe, expect, it } from "vitest";
import { insuranceEstimateHtml, koreanAmount, vatSplit } from "./printInsuranceEstimate";
import type { EstimateItem } from "./insuranceEstimate";

describe("견적서 금액", () => {
  it("한글 금액 (일십·일백처럼 일을 붙인다)", () => {
    expect(koreanAmount(109813)).toBe("일십만구천팔백일십삼");
    expect(koreanAmount(14203519)).toBe("일천사백이십만삼천오백일십구");
    expect(koreanAmount(100000000)).toBe("일억");
    expect(koreanAmount(1005)).toBe("일천오");
    expect(koreanAmount(0)).toBe("영");
  });
  it("부가세 포함 금액을 공급가액+부가세로 나누고 합이 맞는다", () => {
    expect(vatSplit(109813)).toEqual({ supply: 99830, vat: 9983 }); // 얀마 견적서와 같은 값
    const s = vatSplit(14203519);
    expect(s.supply + s.vat).toBe(14203519);
  });
});

describe("견적서 HTML", () => {
  const items: EstimateItem[] = [
    { key: "a", item_type: "부품", part_code: "1E6680-14200", part_name: "체인 <415X226>", quantity: 1, unit_price: 109813, diagram_id: "d1", diagram_title: "주행 체인" },
    { key: "b", item_type: "공임", part_code: "", part_name: "수리 공임", quantity: 1, unit_price: 50000 },
  ];
  const html = insuranceEstimateHtml(items, {
    customerName: "김영수", insuranceCompany: "NH농협손해보험", docNumber: "INS-261123-01",
    company: { company_name: "주식회사 광문", ceo_name: "안정미", business_number: "415-81-53203", stamp_url: "data:image/png;base64,AAA" },
    diagrams: [{ id: "d1", title: "주행 체인", model: "YH7140", imageUrl: "https://x/img.jpg", marks: [{ no: 1, x: 10, y: 20, w: 5, h: 3 }] }],
    printedAt: new Date(2026, 10, 23),
  });
  it("선택한 사업장·대표 (인)·도장·한글 금액이 들어간다", () => {
    expect(html).toContain("주식회사 광문");
    expect(html).toContain("415-81-53203");
    expect(html).toContain('안정미<em>(인)<img src="data:image/png;base64,AAA" alt="직인"></em>');
    expect(html).toContain("일금 일십오만구천팔백일십삼원정");
    expect(html).toContain("YANMAR");
    expect(html).toContain("2026.12.23까지");
  });
  it("도면 쪽에 견적 줄 번호로 형광펜 표시를 하고, 글자는 이스케이프한다", () => {
    expect(html).toContain('class="hl" style="left:10%;top:20%;width:5%;height:3%"><i>1</i>');
    expect(html).toContain("부품 위치 도면 1/1");
    expect(html).toContain("도면 1 · 주행 체인");
    expect(html).toContain("체인 &lt;415X226&gt;");
    expect(html).not.toContain("<415X226>");
  });
  it("도면이 없으면 도면 쪽이 없다", () => {
    const h = insuranceEstimateHtml(items, { customerName: "x" });
    expect(h).not.toContain('class="sheet"');
    expect(h).toContain("<em>(인)</em>");
  });
});
