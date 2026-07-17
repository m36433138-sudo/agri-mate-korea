import { forwardRef } from "react";
import type { Company, Quote, QuoteItem } from "@/lib/quoteTypes";
import { won } from "@/lib/quoteTypes";

type Props = {
  company: Company | null;
  quote: Partial<Quote>;
  items: QuoteItem[];
};

// A4 견적서 인쇄/이미지 캡처용 뷰. 흰 배경 + 검정 텍스트 (다크테마 무관)
export const QuotePrintView = forwardRef<HTMLDivElement, Props>(({ company, quote, items }, ref) => {
  const subtotal = items.reduce((s, i) => s + Number(i.line_total || 0), 0);
  const discount = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price) * (Number(i.discount_rate) / 100), 0);
  const tradeIn = Number(quote.trade_in_amount || 0);
  const total = subtotal - tradeIn;

  return (
    <div ref={ref} style={{
      width: "794px", background: "white", color: "black", padding: "40px",
      fontFamily: "Pretendard, sans-serif", fontSize: "13px",
    }}>
      <div style={{ textAlign: "center", fontSize: "28px", fontWeight: 700, letterSpacing: "0.5em", marginBottom: "24px" }}>
        견 적 서
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", marginBottom: "20px" }}>
        {/* 고객 정보 */}
        <div style={{ flex: 1, border: "1px solid #333", padding: "12px" }}>
          <div style={{ fontWeight: 700, marginBottom: "8px", borderBottom: "1px solid #999", paddingBottom: "4px" }}>수 신</div>
          <div style={{ lineHeight: 1.9 }}>
            <div><b>성명:</b> {quote.customer_name || ""} <span style={{ marginLeft: "12px" }}>귀하</span></div>
            <div><b>연락처:</b> {quote.customer_phone || ""}</div>
            <div><b>주소:</b> {quote.customer_address || ""}</div>
            {quote.customer_ssn && <div><b>주민번호:</b> {quote.customer_ssn}</div>}
            <div><b>견적일:</b> {quote.quote_date}</div>
            <div><b>견적번호:</b> {quote.quote_number}</div>
          </div>
        </div>

        {/* 자사 정보 */}
        <div style={{ flex: 1, border: "1px solid #333", padding: "12px", position: "relative" }}>
          <div style={{ fontWeight: 700, marginBottom: "8px", borderBottom: "1px solid #999", paddingBottom: "4px" }}>공 급 자</div>
          {company && (
            <div style={{ lineHeight: 1.9 }}>
              <div><b>상호:</b> {company.company_name}</div>
              {company.business_number && <div><b>사업자번호:</b> {company.business_number}</div>}
              {company.ceo_name && <div><b>대표자:</b> {company.ceo_name} <span style={{ marginLeft: 4 }}>(인)</span></div>}
              {company.address && <div><b>주소:</b> {company.address}</div>}
              {company.phone && <div><b>전화:</b> {company.phone}</div>}
              {company.fax && <div><b>팩스:</b> {company.fax}</div>}
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: "right", marginBottom: "8px", fontSize: "14px" }}>
        <b>합계금액:</b> <span style={{ fontSize: "18px", fontWeight: 700 }}>{won(total)}</span> (부가세 별도)
      </div>

      {/* 품목 테이블 */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
        <thead>
          <tr style={{ background: "#f3f4f6" }}>
            <th style={cellHead}>No</th>
            <th style={cellHead}>품 명</th>
            <th style={cellHead}>규 격</th>
            <th style={cellHead}>수량</th>
            <th style={cellHead}>단가</th>
            <th style={cellHead}>할인%</th>
            <th style={cellHead}>금액</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td style={cell}>{idx + 1}</td>
              <td style={{ ...cell, textAlign: "left" }}>{it.product_name}</td>
              <td style={{ ...cell, textAlign: "left" }}>{it.spec || ""}</td>
              <td style={{ ...cell, textAlign: "right" }}>{it.quantity}</td>
              <td style={{ ...cell, textAlign: "right" }}>{won(it.unit_price)}</td>
              <td style={{ ...cell, textAlign: "right" }}>{it.discount_rate}%</td>
              <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{won(it.line_total)}</td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
            <tr key={`e${i}`}><td style={cell}>&nbsp;</td><td style={cell}></td><td style={cell}></td><td style={cell}></td><td style={cell}></td><td style={cell}></td><td style={cell}></td></tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} style={{ ...cell, textAlign: "right", fontWeight: 600 }}>공급가액 합계</td>
            <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{won(subtotal)}</td>
          </tr>
          {discount > 0 && (
            <tr>
              <td colSpan={6} style={{ ...cell, textAlign: "right" }}>할인 합계</td>
              <td style={{ ...cell, textAlign: "right" }}>-{won(discount)}</td>
            </tr>
          )}
          {tradeIn > 0 && (
            <tr>
              <td colSpan={6} style={{ ...cell, textAlign: "right" }}>중고 인수가액</td>
              <td style={{ ...cell, textAlign: "right" }}>-{won(tradeIn)}</td>
            </tr>
          )}
          <tr style={{ background: "#f3f4f6" }}>
            <td colSpan={6} style={{ ...cell, textAlign: "right", fontWeight: 700, fontSize: "15px" }}>최종 합계</td>
            <td style={{ ...cell, textAlign: "right", fontWeight: 700, fontSize: "15px" }}>{won(total)}</td>
          </tr>
        </tfoot>
      </table>

      {/* 비고 + 서명 */}
      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ flex: 1, border: "1px solid #333", padding: "12px", minHeight: "140px" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px" }}>비 고</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{quote.memo || ""}</div>
        </div>
        <div style={{ flex: 1, border: "1px solid #333", padding: "12px", minHeight: "140px" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px" }}>서 명 / 필기</div>
          {quote.signature_data && (
            <img src={quote.signature_data} alt="signature" style={{ maxWidth: "100%", maxHeight: "110px" }} />
          )}
        </div>
      </div>

      <div style={{ marginTop: "24px", textAlign: "center", fontSize: "11px", color: "#666" }}>
        본 견적서의 유효기간은 발행일로부터 30일입니다.
      </div>
    </div>
  );
});

const cellHead: any = { border: "1px solid #333", padding: "6px 8px", fontWeight: 700, textAlign: "center" };
const cell: any = { border: "1px solid #ccc", padding: "6px 8px", textAlign: "center" };

QuotePrintView.displayName = "QuotePrintView";
