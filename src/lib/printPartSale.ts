import { koreanAmount, vatSplit, YANMAR_RED, type EstimateCompany } from "./printInsuranceEstimate";
import type { PartSaleRow } from "@/components/partSales/types";
import { buyerOf, PAYMENT_MODE_LABELS } from "@/components/partSales/types";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const won = (n: number) => Math.round(Number(n) || 0).toLocaleString("ko-KR");
const dot = (iso: string) => (iso || "").slice(0, 10).replace(/-/g, ".");

export type PartSalePrintOptions = {
  company?: EstimateCompany | null;
  /** 공급자 보관용까지 2장 */
  withSupplierCopy?: boolean;
};

/** 거래번호: PS-YYMMDD-ID앞4자리 (같은 날 여러 건도 구분) */
export function partSaleDocNumber(s: Pick<PartSaleRow, "sale_date" | "id">) {
  return `PS-${s.sale_date.replace(/-/g, "").slice(2, 8)}-${s.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

/** 부품 판매 거래명세서 HTML (YANMAR 빨강 마크, 공급자 직인, 금액 한글 표기, 공급가액·부가세) */
export function partSaleHtml(s: PartSaleRow, opt: PartSalePrintOptions = {}) {
  const c = opt.company ?? {};
  const items = s.part_sale_items ?? [];
  const total = Number(s.total_amount) || 0;
  const paid = Number(s.paid_amount) || 0;
  const due = Math.max(0, total - paid);
  const { supply, vat } = vatSplit(total);
  const docNo = partSaleDocNumber(s);
  const companyName = c.company_name || `광문농기 ${s.branch}`;
  const buyer = buyerOf(s);
  const phone = s.customers?.phone ?? s.buyer_phone ?? "";
  const address = s.customers?.address ?? "";

  const rows = items.map((it, i) => `<tr>
<td class="c">${i + 1}</td><td class="m">${esc(it.part_code)}</td><td>${esc(it.part_name)}</td>
<td class="r">${it.quantity}</td><td class="r">${won(it.unit_price)}</td><td class="r b">${won(it.quantity * it.unit_price)}</td></tr>`).join("");
  // 빈 줄을 채워 표 모양을 맞춘다 (손으로 추가 기입하는 곳)
  const blanks = Array.from({ length: Math.max(0, 8 - items.length) }, () => `<tr class="blank"><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");

  const kv = (k: string, v: string | null | undefined) => `<div class="kv"><span>${k}</span><b>${esc(v || "-")}</b></div>`;
  const footer = [companyName, c.address, c.phone && `TEL ${c.phone}`, c.fax && `FAX ${c.fax}`].filter(Boolean).map((x) => esc(x as string)).join("  ·  ");
  const payLabel = PAYMENT_MODE_LABELS[s.payment_mode] + (s.payment_method ? ` · ${s.payment_method}` : "");

  const sheet = (copy: string | null) => `<section class="page">
<div class="bar"></div>
<div class="head">
  <div class="title"><h1>거 래 명 세 서</h1><p>TRANSACTION STATEMENT · 부품 판매</p></div>
  <div><div class="brand">YANMAR</div><div class="dealer">얀마 농기계 공식 대리점 · ${esc(companyName)}</div></div>
</div>
${copy ? `<div class="copy">${copy}</div>` : ""}
<div class="meta">
  <div><span>거래번호</span><b>${esc(docNo)}</b></div>
  <div><span>거래일</span><b>${esc(dot(s.sale_date))}</b></div>
  <div><span>판매 지점</span><b>${esc(s.branch)}</b></div>
  <div><span>결제</span><b class="${due > 0 ? "due" : ""}">${esc(payLabel)}</b></div>
</div>
<div class="cards">
  <div class="card"><h3>공 급 받 는 자</h3>
    <div class="kv"><span>성명·상호</span><b class="big">${esc(buyer)} <small>귀하</small></b></div>
    ${kv("연락처", phone)}
    ${kv("주소", address)}
  </div>
  <div class="card"><h3>공 급 자</h3>
    ${kv("상호", companyName)}
    ${kv("사업자번호", c.business_number)}
    <div class="kv"><span>대표</span><b class="seal">${esc(c.ceo_name || "")}<em>(인)${c.stamp_url ? `<img src="${esc(c.stamp_url)}" alt="직인">` : ""}</em></b></div>
    ${kv("주소", c.address)}
    ${kv("연락처", [c.phone, c.fax && `FAX ${c.fax}`].filter(Boolean).join(" · "))}
  </div>
</div>
<div class="amount">
  <div><span>합계금액 (부가세 포함)</span><div class="ko">일금 ${koreanAmount(total)}원정</div></div>
  <div class="num">₩${won(total)}</div>
</div>
<table class="items"><thead><tr><th style="width:34px">No</th><th style="width:130px">부품번호</th><th>품명</th><th style="width:44px">수량</th><th style="width:84px">단가</th><th style="width:94px">금액</th></tr></thead>
<tbody>${rows}${blanks}</tbody></table>
<div class="bottom">
  <div class="left">
    <div class="pay">
      <div><span>결제 방법</span><b>${esc(payLabel)}</b></div>
      <div><span>받은 금액</span><b>${won(paid)}원</b></div>
      <div class="${due > 0 ? "due" : ""}"><span>미수금</span><b>${won(due)}원</b></div>
    </div>
    ${s.notes ? `<div class="note"><h3>비 고</h3>${esc(s.notes)}</div>` : ""}
  </div>
  <div class="sum">
    <div><span>소계</span><b>${won(s.subtotal)}원</b></div>
    ${Number(s.discount) > 0 ? `<div><span>할인</span><b>-${won(s.discount)}원</b></div>` : ""}
    <div><span>공급가액</span><b>${won(supply)}원</b></div>
    <div><span>부가세 (10%)</span><b>${won(vat)}원</b></div>
    <div class="total"><span>합계</span><b>${won(total)}원</b></div>
  </div>
</div>
<div class="sign">
  <span>위 금액을 정히 ${due > 0 ? "청구" : "영수"}합니다.</span>
  <span class="who">인수자 <i></i> (인)</span>
</div>
<div class="foot"><span>${footer}</span><span>${esc(docNo)}</span></div>
</section>`;

  const pages = opt.withSupplierCopy ? sheet("공급받는자 보관용") + sheet("공급자 보관용") : sheet(null);

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>거래명세서 ${esc(docNo)} - ${esc(buyer)}</title>
<style>
@page{size:A4;margin:11mm 12mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#111827;margin:0;font-size:11.5px;line-height:1.45}
.page+.page{break-before:page}
.bar{height:6px;background:${YANMAR_RED};border-radius:3px}
.head{display:flex;justify-content:space-between;align-items:flex-end;margin:14px 0 12px}
.title h1{font-size:30px;letter-spacing:10px;margin:0;font-weight:800}
.title p{margin:2px 0 0;color:#6b7280;letter-spacing:3px;font-size:10px;font-weight:600}
.brand{font-family:"Arial Black","Helvetica Neue",Arial,sans-serif;font-weight:900;font-style:italic;color:${YANMAR_RED};font-size:34px;letter-spacing:-1px;line-height:1;text-align:right}
.dealer{font-size:10px;color:#374151;text-align:right;margin-top:3px;font-weight:600}
.copy{display:inline-block;margin:-4px 0 8px;padding:2px 10px;border-radius:999px;border:1px solid ${YANMAR_RED};color:${YANMAR_RED};font-size:10px;font-weight:700;letter-spacing:1px}
.meta{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:10px}
.meta div{padding:7px 10px;border-right:1px solid #e5e7eb}.meta div:last-child{border-right:0}
.meta span{display:block;font-size:9.5px;color:#6b7280}.meta b{font-size:12px}
.due{color:${YANMAR_RED}}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px}
.card h3{margin:0 0 6px;font-size:10px;letter-spacing:2px;color:${YANMAR_RED};font-weight:800}
.kv{display:flex;gap:8px;padding:2.5px 0;border-bottom:1px dashed #f1f5f9}.kv:last-child{border-bottom:0}
.kv span{width:62px;flex-shrink:0;color:#6b7280}.kv b{font-weight:600;word-break:keep-all}
.kv b.big{font-size:15px;font-weight:800}.kv b.big small{font-size:11px;font-weight:500;color:#6b7280}
.seal em{position:relative;display:inline-block;font-style:normal;color:#9ca3af;font-weight:500;margin-left:20px}
.seal em img{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-4deg);width:46px;height:46px;object-fit:contain;mix-blend-mode:multiply;opacity:.92}
.amount{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 10px;padding:12px 16px;border-radius:12px;background:#fff5f5;border-left:6px solid ${YANMAR_RED}}
.amount span{font-size:10px;color:#6b7280;display:block}
.amount .ko{font-size:14px;font-weight:700}
.amount .num{font-size:24px;font-weight:800;letter-spacing:-.5px;white-space:nowrap}
table{width:100%;border-collapse:collapse}
.items th{background:#111827;color:#fff;font-weight:600;font-size:10.5px;padding:6px;text-align:center}
.items th:first-child{border-top-left-radius:8px}.items th:last-child{border-top-right-radius:8px}
.items td{padding:6px;border-bottom:1px solid #eef0f3;vertical-align:top}
.items tbody tr:nth-child(even) td{background:#fafafa}
.items tr.blank td{height:26px}
td.c{text-align:center}td.r{text-align:right;white-space:nowrap}td.b{font-weight:700}td.m{font-family:ui-monospace,Menlo,Consolas,monospace;white-space:nowrap;font-size:11px}
.bottom{display:grid;grid-template-columns:1fr 250px;gap:12px;margin-top:10px;align-items:start}
.left{display:grid;gap:8px}
.pay{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
.pay div{display:flex;justify-content:space-between;padding:5px 12px;border-bottom:1px solid #f1f5f9}.pay div:last-child{border-bottom:0}
.pay span{color:#6b7280}.pay .due b{color:${YANMAR_RED};font-size:13px}
.note{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;white-space:pre-wrap}
.note h3{margin:0 0 4px;font-size:10px;letter-spacing:2px;color:${YANMAR_RED};font-weight:800}
.sum{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
.sum div{display:flex;justify-content:space-between;padding:5px 12px;border-bottom:1px solid #f1f5f9}
.sum div span{color:#6b7280}
.sum .total{background:#111827;color:#fff;border-bottom:0;padding:9px 12px}.sum .total span{color:#e5e7eb}.sum .total b{font-size:15px}
.sign{display:flex;justify-content:space-between;align-items:flex-end;margin-top:18px;font-size:12px;font-weight:600}
.sign .who i{display:inline-block;width:110px;border-bottom:1px solid #111827;margin:0 6px;vertical-align:bottom}
.foot{margin-top:14px;padding-top:8px;border-top:2px solid ${YANMAR_RED};display:flex;justify-content:space-between;font-size:9.5px;color:#374151}
tr{page-break-inside:avoid}
</style></head><body>${pages}</body></html>`;
}
