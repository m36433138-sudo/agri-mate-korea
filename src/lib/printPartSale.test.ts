import { describe, expect, it } from "vitest";
import { partSaleDocNumber, partSaleHtml } from "./printPartSale";
import type { PartSaleRow } from "@/components/partSales/types";

const sale: PartSaleRow = {
  id: "3f2a9c10-0000-0000-0000-000000000000", sale_date: "2026-11-24", branch: "강진", customer_id: "c1", buyer_name: null, buyer_phone: null,
  subtotal: 128000, discount: 8000, total_amount: 120000, payment_mode: "partial", paid_amount: 50000, payment_method: "계좌이체", notes: "<다음 주 추가 주문>",
  created_at: "2026-11-24T01:00:00Z",
  customers: { id: "c1", name: "김정균", phone: "010-9261-3103", address: "강진군 대구면 백사1길 72" },
  part_sale_items: [
    { id: "i1", sale_id: "s", branch: "강진", part_code: "119305-35170", part_name: "엔진오일 필터", quantity: 2, unit_price: 14000 },
    { id: "i2", sale_id: "s", branch: "강진", part_code: "1A8060-00600", part_name: "V벨트", quantity: 1, unit_price: 100000 },
  ],
};

describe("부품 판매 거래명세서", () => {
  it("거래번호는 날짜와 ID 앞자리", () => {
    expect(partSaleDocNumber(sale)).toBe("PS-261124-3F2A");
  });
  it("YANMAR 마크, 금액 한글, 공급가액·부가세, 미수금 청구", () => {
    const html = partSaleHtml(sale, { company: { company_name: "주식회사 광문지점", business_number: "415-85-23430", ceo_name: "안정미", stamp_url: "data:image/png;base64,AAA" } });
    expect(html).toContain(">YANMAR<");
    expect(html).toContain("일금 일십이만원정");
    expect(html).toContain("109,091원"); // 공급가액
    expect(html).toContain("10,909원"); // 부가세
    expect(html).toContain("70,000원"); // 미수금
    expect(html).toContain("정히 청구합니다");
    expect(html).toContain('alt="직인"');
    expect(html).toContain("&lt;다음 주 추가 주문&gt;");
    expect(html).not.toContain("보관용");
  });
  it("완납이면 영수, 보관용 2장 옵션", () => {
    const html = partSaleHtml({ ...sale, payment_mode: "paid", paid_amount: 120000 }, { withSupplierCopy: true });
    expect(html).toContain("정히 영수합니다");
    expect(html).toContain("공급받는자 보관용");
    expect(html).toContain("공급자 보관용");
    expect(html).toContain("광문농기 강진"); // 사업장을 못 고르면 지점 이름
  });
});
