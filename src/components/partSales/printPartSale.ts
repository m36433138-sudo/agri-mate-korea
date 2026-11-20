import type { PartSaleRow } from "./types";
import { buyerOf, PAYMENT_MODE_LABELS } from "./types";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const won = (n: number) => `${Math.round(Number(n) || 0).toLocaleString("ko-KR")}원`;

/** 부품 판매 거래명세서를 새 창으로 열어 인쇄 */
export function printPartSale(s: PartSaleRow) {
  const items = s.part_sale_items ?? [];
  const rows = items
    .map(
      (it, i) => `<tr><td>${i + 1}</td><td class="mono">${esc(it.part_code)}</td><td>${esc(it.part_name)}</td>
      <td class="r">${it.quantity}</td><td class="r">${won(it.unit_price)}</td><td class="r">${won(it.quantity * it.unit_price)}</td></tr>`,
    )
    .join("");
  const phone = s.customers?.phone ?? s.buyer_phone ?? "";
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>거래명세서 ${esc(s.sale_date)} ${esc(buyerOf(s))}</title>
<style>
  body{font-family:'Pretendard Variable',Pretendard,'Malgun Gothic',sans-serif;color:#111;margin:32px;font-size:13px}
  h1{text-align:center;font-size:24px;letter-spacing:8px;margin:0 0 20px}
  .meta{display:flex;justify-content:space-between;gap:24px;margin-bottom:16px}
  .meta div{line-height:1.7}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #444;padding:6px 8px}
  th{background:#eee}
  .r{text-align:right}.mono{font-family:monospace}
  .sum td{font-weight:700}
  .foot{margin-top:16px;color:#555}
  @media print{body{margin:12mm}}
</style></head><body>
<h1>거 래 명 세 서</h1>
<div class="meta">
  <div><b>공급받는 자</b><br>${esc(buyerOf(s))} 귀하${phone ? `<br>연락처 ${esc(phone)}` : ""}${s.customers?.address ? `<br>${esc(s.customers.address)}` : ""}</div>
  <div style="text-align:right"><b>공급자</b><br>광문농기 ${esc(s.branch)}점<br>거래일 ${esc(s.sale_date)}</div>
</div>
<table>
  <thead><tr><th style="width:36px">No</th><th>부품번호</th><th>품명</th><th style="width:56px">수량</th><th>단가</th><th>금액</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr><td colspan="5" class="r">소계</td><td class="r">${won(s.subtotal)}</td></tr>
    ${Number(s.discount) > 0 ? `<tr><td colspan="5" class="r">할인</td><td class="r">-${won(s.discount)}</td></tr>` : ""}
    <tr class="sum"><td colspan="5" class="r">합계 (부가세 포함)</td><td class="r">${won(s.total_amount)}</td></tr>
    <tr><td colspan="5" class="r">결제 (${esc(PAYMENT_MODE_LABELS[s.payment_mode])}${s.payment_method ? ` · ${esc(s.payment_method)}` : ""})</td><td class="r">${won(s.paid_amount)}</td></tr>
    ${Number(s.total_amount) - Number(s.paid_amount) > 0 ? `<tr class="sum"><td colspan="5" class="r">미수금</td><td class="r">${won(Number(s.total_amount) - Number(s.paid_amount))}</td></tr>` : ""}
  </tfoot>
</table>
${s.notes ? `<p class="foot">비고: ${esc(s.notes)}</p>` : ""}
<script>window.onload=()=>{window.print()}</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
