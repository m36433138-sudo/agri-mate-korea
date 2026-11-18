import { estimateTotals, lineAmount, type EstimateItem } from "./insuranceEstimate";

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const won = (n: number) => n.toLocaleString("ko-KR");

export type EstimatePrintInfo = {
  customerName: string;
  customerPhone?: string | null;
  machine?: string | null;
  insuranceCompany?: string | null;
  claimNumber?: string | null;
  accidentDate?: string | null;
  technician?: string | null;
  branch?: string | null;
  description?: string | null;
  company?: { company_name?: string | null; business_number?: string | null; ceo_name?: string | null; address?: string | null; phone?: string | null; fax?: string | null; stamp_url?: string | null } | null;
  printedAt?: Date;
};

/** 보험사 제출용 수리 견적서 HTML */
export function insuranceEstimateHtml(items: EstimateItem[], info: EstimatePrintInfo) {
  const d = info.printedAt ?? new Date();
  const date = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  const t = estimateTotals(items);
  const c = info.company;
  const rows = items
    .map((it, i) => `<tr><td class="c">${i + 1}</td><td class="c">${esc(it.item_type)}</td><td class="m">${esc(it.part_code)}</td><td>${esc(it.part_name)}${it.diagram_title ? `<div class="s">${esc(it.diagram_title)}</div>` : ""}</td><td class="r">${it.quantity}</td><td class="r">${won(Number(it.unit_price) || 0)}</td><td class="r">${won(lineAmount(it))}</td></tr>`)
    .join("");
  const kv = (k: string, v: string | null | undefined) => (v ? `<tr><th>${k}</th><td>${esc(v)}</td></tr>` : "");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>보험수리 견적서 - ${esc(info.customerName)}</title>
<style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box}body{font-family:"Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif;color:#111;margin:0;font-size:12px}
h1{text-align:center;font-size:24px;letter-spacing:8px;margin:0 0 4px}.sub{text-align:center;color:#555;margin:0 0 14px}
.top{display:flex;gap:12px;align-items:stretch}.top table{flex:1}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}
.info th{width:78px;background:#f1f5f9;font-weight:600;white-space:nowrap}
.items{margin-top:12px}.items th{background:#f1f5f9;text-align:center}
td.c{text-align:center}td.r{text-align:right;white-space:nowrap}td.m{font-family:monospace;white-space:nowrap}
.s{font-size:10px;color:#666}
.sum{margin-top:8px;width:50%;margin-left:auto}.sum th{background:#f1f5f9;width:40%}.sum td{text-align:right}
.sum tr.total th,.sum tr.total td{font-size:14px;font-weight:700}
.stamp{position:relative}.stamp img{position:absolute;right:4px;top:-6px;width:52px;opacity:.85}
.note{margin-top:12px;border:1px solid #999;padding:6px;min-height:40px;white-space:pre-wrap}
tr{page-break-inside:avoid}
</style></head><body>
<h1>견 적 서</h1><p class="sub">보험수리 · ${date}</p>
<div class="top">
<table class="info"><tbody>
${kv("고객", info.customerName + (info.customerPhone ? ` (${info.customerPhone})` : ""))}
${kv("기계", info.machine)}
${kv("보험사", info.insuranceCompany)}
${kv("접수번호", info.claimNumber)}
${kv("사고일", info.accidentDate)}
${kv("담당 기사", info.technician)}
</tbody></table>
<table class="info"><tbody>
<tr><th>상호</th><td class="stamp">${esc(c?.company_name || "광문농기")}${info.branch ? ` ${esc(info.branch)}점` : ""}${c?.stamp_url ? `<img src="${esc(c.stamp_url)}" alt="">` : ""}</td></tr>
${kv("대표", c?.ceo_name)}
${kv("사업자번호", c?.business_number)}
${kv("주소", c?.address)}
${kv("전화", c?.phone)}
${kv("팩스", c?.fax)}
</tbody></table>
</div>
<table class="items"><thead><tr><th style="width:32px">No</th><th style="width:44px">구분</th><th style="width:120px">부품번호</th><th>품명</th><th style="width:44px">수량</th><th style="width:80px">단가</th><th style="width:90px">금액</th></tr></thead>
<tbody>${rows || `<tr><td colspan="7" class="c">항목 없음</td></tr>`}</tbody></table>
<table class="sum"><tbody>
<tr><th>부품비</th><td>${won(t.parts)}원</td></tr>
<tr><th>공임</th><td>${won(t.labor)}원</td></tr>
${t.other ? `<tr><th>기타</th><td>${won(t.other)}원</td></tr>` : ""}
<tr class="total"><th>합계</th><td>${won(t.total)}원</td></tr>
</tbody></table>
${info.description ? `<div class="note"><b>수리 내용</b>\n${esc(info.description)}</div>` : ""}
</body></html>`;
}

export function printInsuranceEstimate(items: EstimateItem[], info: EstimatePrintInfo) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(insuranceEstimateHtml(items, info));
  doc.close();
  const img = doc.querySelector("img");
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  if (img && !img.complete) { img.onload = go; img.onerror = go; } else setTimeout(go, 50);
}
