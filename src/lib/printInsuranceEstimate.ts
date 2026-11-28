import { estimateTotals, lineAmount, type EstimateItem } from "./insuranceEstimate";

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const won = (n: number) => Math.round(n).toLocaleString("ko-KR");

export const YANMAR_RED = "#E60012";

export type EstimateCompany = {
  company_name?: string | null;
  business_number?: string | null;
  ceo_name?: string | null;
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  stamp_url?: string | null;
};

/** 도면 한 장: 견적 줄 번호(no)를 붙여 형광펜으로 칠할 자리들 (x,y,w,h는 그림 대비 %) */
export type EstimateDiagramSheet = {
  id: string;
  title: string;
  model?: string | null;
  imageUrl: string;
  marks: { no: number; x: number; y: number; w: number; h: number; round?: boolean }[];
};

export type BranchStock = { location: string; qty: number };
export type PartLocations = Record<string, Partial<Record<"장흥" | "강진", BranchStock>>>;
export const LOCATION_BRANCHES = ["장흥", "강진"] as const;

/** 창고 칸 글자: 위치 · 수량. 재고 줄이 없으면 「-」 */
export function stockCell(s: BranchStock | undefined): string {
  if (!s) return "-";
  return `${s.location || "위치 없음"} · ${s.qty}개`;
}

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
  company?: EstimateCompany | null;
  /** 견적 번호 (없으면 날짜로 만든다) */
  docNumber?: string | null;
  diagrams?: EstimateDiagramSheet[];
  /** 도면 옆 부품표에 장흥·강진 창고 위치를 붙인다 (부품번호 대문자 → 지점별 위치) */
  partLocations?: PartLocations | null;
  printedAt?: Date;
};

const DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const SMALL = ["", "십", "백", "천"];
const BIG = ["", "만", "억", "조"];

/** 109813 → "일십만구천팔백일십삼" (견적서 금액 한글 표기, 일십·일백·일천처럼 「일」을 쓴다) */
export function koreanAmount(n: number): string {
  let v = Math.floor(Math.abs(n));
  if (v === 0) return "영";
  const groups: string[] = [];
  for (let g = 0; v > 0 && g < BIG.length; g++) {
    const chunk = v % 10000;
    v = Math.floor(v / 10000);
    if (!chunk) continue;
    let s = "";
    for (let i = 3; i >= 0; i--) {
      const d = Math.floor(chunk / 10 ** i) % 10;
      if (d) s += DIGITS[d] + SMALL[i];
    }
    groups.unshift(s + BIG[g]);
  }
  return groups.join("");
}

/** 부가세 포함 금액을 공급가액·부가세로 나눈다 (원 단위 반올림, 합은 항상 원래 금액) */
export function vatSplit(total: number) {
  const supply = Math.round(total / 1.1);
  return { supply, vat: total - supply };
}

const ymd = (d: Date) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;

/** 보험사 제출용 수리 견적서 HTML (1쪽 견적서 + 부품 위치 도면들) */
export function insuranceEstimateHtml(items: EstimateItem[], info: EstimatePrintInfo) {
  const d = info.printedAt ?? new Date();
  const until = new Date(d.getTime() + 30 * 86400_000);
  const t = estimateTotals(items);
  const { supply, vat } = vatSplit(t.total);
  const c = info.company ?? {};
  const docNo = info.docNumber || `EST-${d.getFullYear() % 100}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const sheets = (info.diagrams ?? []).filter((s) => s.marks.length);
  // 견적 줄 번호 → 어느 도면에 표시됐는지
  const onSheet = new Map<number, number>();
  sheets.forEach((s, si) => s.marks.forEach((m) => { if (!onSheet.has(m.no)) onSheet.set(m.no, si + 1); }));

  const rows = items.map((it, i) => {
    const no = i + 1;
    const sheet = onSheet.get(no);
    return `<tr>
<td class="c">${sheet ? `<span class="badge">${no}</span>` : no}</td>
<td class="c"><span class="tag tag-${it.item_type === "부품" ? "p" : it.item_type === "공임" ? "l" : "o"}">${esc(it.item_type)}</span></td>
<td class="m">${esc(it.part_code)}</td>
<td>${esc(it.part_name)}${sheet ? `<div class="s">도면 ${sheet} · ${esc(sheets[sheet - 1].title)}</div>` : it.diagram_title ? `<div class="s">${esc(it.diagram_title)}</div>` : ""}</td>
<td class="r">${it.quantity}</td>
<td class="r">${won(Number(it.unit_price) || 0)}</td>
<td class="r b">${won(lineAmount(it))}</td></tr>`;
  }).join("");

  const kv = (k: string, v: string | null | undefined) => `<div class="kv"><span>${k}</span><b>${esc(v || "-")}</b></div>`;
  const companyName = c.company_name || "광문농기";
  const footer = [companyName, c.address, c.phone && `TEL ${c.phone}`, c.fax && `FAX ${c.fax}`].filter(Boolean).map((x) => esc(x as string)).join("  ·  ");

  const locs = info.partLocations ?? null;
  const diagramPages = sheets.map((s, si) => {
    const marks = s.marks.map((m) => `<div class="hl${m.round ? " round" : ""}" style="left:${m.x}%;top:${m.y}%;width:${m.w}%;height:${m.h}%"><i>${m.no}</i></div>`).join("");
    const legend = [...new Set(s.marks.map((m) => m.no))].sort((a, b) => a - b).map((no) => {
      const it = items[no - 1];
      if (!it) return "";
      const loc = locs ? locs[it.part_code.trim().toUpperCase()] ?? {} : null;
      const locCells = loc ? LOCATION_BRANCHES.map((b) => `<td class="loc${loc[b] ? "" : " none"}">${esc(stockCell(loc[b]))}</td>`).join("") : "";
      return `<tr><td class="c"><span class="badge">${no}</span></td><td class="m">${esc(it.part_code)}</td><td>${esc(it.part_name)}</td><td class="r">${it.quantity}</td>${locCells}</tr>`;
    }).join("");
    return `<section class="sheet">
<div class="sheet-head"><div class="brand sm">YANMAR</div><div class="st">부품 위치 도면 ${si + 1}/${sheets.length}<b>${esc(s.title)}</b>${s.model ? `<span>${esc(s.model)}</span>` : ""}</div><div class="ref">견적 ${esc(docNo)} · ${esc(info.customerName)}</div></div>
<div class="sheet-body${locs ? " wide" : ""}"><div class="pic"><img src="${esc(s.imageUrl)}" alt="">${marks}</div>
<table class="legend"><thead><tr><th>No</th><th>부품번호</th><th>품명</th><th>수량</th>${locs ? LOCATION_BRANCHES.map((b) => `<th>${b} 창고</th>`).join("") : ""}</tr></thead><tbody>${legend}</tbody></table></div>
</section>`;
  }).join("");

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>견적서 ${esc(docNo)} - ${esc(info.customerName)}</title>
<style>
@page{size:A4;margin:11mm 12mm}
@page diagram{size:A4 landscape;margin:8mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#111827;margin:0;font-size:11.5px;line-height:1.45}
.bar{height:6px;background:${YANMAR_RED};border-radius:3px}
.head{display:flex;justify-content:space-between;align-items:flex-end;margin:14px 0 12px}
.title h1{font-size:30px;letter-spacing:10px;margin:0;font-weight:800}
.title p{margin:2px 0 0;color:#6b7280;letter-spacing:3px;font-size:10px;font-weight:600}
.brand{font-family:"Arial Black","Helvetica Neue",Arial,sans-serif;font-weight:900;font-style:italic;color:${YANMAR_RED};font-size:34px;letter-spacing:-1px;line-height:1;text-align:right}
.brand.sm{font-size:18px}
.dealer{font-size:10px;color:#374151;text-align:right;margin-top:3px;font-weight:600}
.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:10px}
.meta div{padding:7px 10px;border-right:1px solid #e5e7eb}.meta div:last-child{border-right:0}
.meta span{display:block;font-size:9.5px;color:#6b7280}.meta b{font-size:12px}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px}
.card h3{margin:0 0 6px;font-size:10px;letter-spacing:2px;color:${YANMAR_RED};font-weight:800}
.kv{display:flex;gap:8px;padding:2.5px 0;border-bottom:1px dashed #f1f5f9}.kv:last-child{border-bottom:0}
.kv span{width:62px;flex-shrink:0;color:#6b7280}.kv b{font-weight:600;word-break:keep-all}
.seal em{position:relative;display:inline-block;font-style:normal;color:#9ca3af;font-weight:500;margin-left:20px}
.seal em img{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-4deg);width:46px;height:46px;object-fit:contain;mix-blend-mode:multiply;opacity:.92}
.amount{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 10px;padding:12px 16px;border-radius:12px;background:#fff5f5;border-left:6px solid ${YANMAR_RED}}
.amount span{font-size:10px;color:#6b7280;display:block}
.amount .ko{font-size:14px;font-weight:700}
.amount .num{font-size:24px;font-weight:800;letter-spacing:-.5px;white-space:nowrap}
table{width:100%;border-collapse:collapse}
.items th{background:#111827;color:#fff;font-weight:600;font-size:10.5px;padding:6px 6px;text-align:center}
.items th:first-child{border-top-left-radius:8px}.items th:last-child{border-top-right-radius:8px}
.items td{padding:6px;border-bottom:1px solid #eef0f3;vertical-align:top}
.items tbody tr:nth-child(even) td{background:#fafafa}
td.c{text-align:center}td.r{text-align:right;white-space:nowrap}td.b{font-weight:700}td.m{font-family:ui-monospace,Menlo,Consolas,monospace;white-space:nowrap;font-size:11px}
.s{font-size:9.5px;color:#6b7280;margin-top:1px}
.badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:${YANMAR_RED};color:#fff;font-weight:800;font-size:10px}
.tag{display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:700}
.tag-p{background:#eff6ff;color:#1d4ed8}.tag-l{background:#f0fdf4;color:#15803d}.tag-o{background:#f3f4f6;color:#374151}
.bottom{display:grid;grid-template-columns:1fr 250px;gap:12px;margin-top:10px;align-items:start}
.note{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;white-space:pre-wrap;min-height:70px}
.note h3{margin:0 0 4px;font-size:10px;letter-spacing:2px;color:${YANMAR_RED};font-weight:800}
.sum{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
.sum div{display:flex;justify-content:space-between;padding:5px 12px;border-bottom:1px solid #f1f5f9}
.sum div span{color:#6b7280}
.sum .total{background:#111827;color:#fff;border-bottom:0;padding:9px 12px}.sum .total span{color:#e5e7eb}.sum .total b{font-size:15px}
.terms{margin-top:10px;font-size:9.5px;color:#6b7280}
.foot{margin-top:14px;padding-top:8px;border-top:2px solid ${YANMAR_RED};display:flex;justify-content:space-between;font-size:9.5px;color:#374151}
tr{page-break-inside:avoid}
.sheet{page:diagram;break-before:page}
.sheet-head{display:flex;align-items:center;gap:14px;border-bottom:3px solid ${YANMAR_RED};padding-bottom:6px;margin-bottom:8px}
.sheet-head .st{flex:1;font-size:11px;color:#374151}.sheet-head .st b{margin-left:8px;font-size:14px;color:#111827}.sheet-head .st span{margin-left:8px;color:#6b7280}
.sheet-head .ref{font-size:10px;color:#6b7280}
.sheet-body{display:grid;grid-template-columns:1fr 250px;gap:10px;align-items:start}
.sheet-body.wide{grid-template-columns:1fr 360px}
.legend td.loc{font-size:9.5px;color:#111827;white-space:nowrap}.legend td.loc.none{color:#9ca3af;text-align:center}
.pic{position:relative;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
.pic img{display:block;width:100%;height:auto;max-height:168mm;object-fit:contain}
.hl{position:absolute;background:rgba(255,230,0,.5);border:2px solid #f59e0b;border-radius:4px;mix-blend-mode:multiply}
.hl.round{border-radius:999px;transform:scale(1.4)}
.hl i{position:absolute;left:-9px;top:-11px;font-style:normal;min-width:17px;height:17px;padding:0 3px;border-radius:999px;background:${YANMAR_RED};color:#fff;font:800 10px/17px Arial,sans-serif;text-align:center;mix-blend-mode:normal}
.hl.round i{transform:scale(.72)}
.legend th{background:#f3f4f6;font-size:10px;padding:4px;text-align:left;white-space:nowrap}.legend td{padding:4px;border-bottom:1px solid #eef0f3;font-size:10.5px}
</style></head><body>
<div class="bar"></div>
<div class="head">
  <div class="title"><h1>견 적 서</h1><p>REPAIR ESTIMATE · 보험수리</p></div>
  <div><div class="brand">YANMAR</div><div class="dealer">얀마 농기계 공식 대리점 · ${esc(companyName)}</div></div>
</div>
<div class="meta">
  <div><span>견적번호</span><b>${esc(docNo)}</b></div>
  <div><span>견적일</span><b>${ymd(d)}</b></div>
  <div><span>유효기간</span><b>${ymd(until)}까지</b></div>
  <div><span>담당</span><b>${esc(info.technician || "-")}</b></div>
</div>
<div class="cards">
  <div class="card"><h3>수 신</h3>
    ${kv("보험사", info.insuranceCompany)}
    ${kv("고객", info.customerName + (info.customerPhone ? ` (${info.customerPhone})` : ""))}
    ${kv("기계", info.machine)}
    ${kv("접수번호", info.claimNumber)}
    ${kv("사고일", info.accidentDate)}
  </div>
  <div class="card"><h3>공 급 자</h3>
    <div class="kv"><span>상호</span><b>${esc(companyName)}${info.branch ? ` <small style="color:#6b7280;font-weight:500">(${esc(info.branch)})</small>` : ""}</b></div>
    ${kv("사업자번호", c.business_number)}
    <div class="kv"><span>대표</span><b class="seal">${esc(c.ceo_name || "")}<em>(인)${c.stamp_url ? `<img src="${esc(c.stamp_url)}" alt="직인">` : ""}</em></b></div>
    ${kv("주소", c.address)}
    ${kv("연락처", [c.phone, c.fax && `FAX ${c.fax}`].filter(Boolean).join(" · "))}
  </div>
</div>
<div class="amount">
  <div><span>견적금액 (부가세 포함)</span><div class="ko">일금 ${koreanAmount(t.total)}원정</div></div>
  <div class="num">₩${won(t.total)}</div>
</div>
<table class="items"><thead><tr><th style="width:34px">No</th><th style="width:46px">구분</th><th style="width:118px">부품번호</th><th>품명</th><th style="width:40px">수량</th><th style="width:76px">단가</th><th style="width:86px">금액</th></tr></thead>
<tbody>${rows || `<tr><td colspan="7" class="c">항목 없음</td></tr>`}</tbody></table>
<div class="bottom">
  <div class="note"><h3>수 리 내 용</h3>${esc(info.description || "")}${sheets.length ? `\n\n※ 빨간 번호가 붙은 부품은 뒤에 붙인 부품 위치 도면 ${sheets.length}장에 형광펜으로 표시했습니다.` : ""}</div>
  <div class="sum">
    <div><span>부품비</span><b>${won(t.parts)}원</b></div>
    <div><span>공임</span><b>${won(t.labor)}원</b></div>
    ${t.other ? `<div><span>기타</span><b>${won(t.other)}원</b></div>` : ""}
    <div><span>공급가액</span><b>${won(supply)}원</b></div>
    <div><span>부가세 (10%)</span><b>${won(vat)}원</b></div>
    <div class="total"><span>합계</span><b>${won(t.total)}원</b></div>
  </div>
</div>
<p class="terms">· 위 금액은 부가세가 포함된 금액입니다. · 본 견적은 견적일로부터 30일간 유효합니다. · 분해 점검 중 추가 손상이 확인되면 별도로 알려드립니다.</p>
<div class="foot"><span>${footer}</span><span>${esc(docNo)}</span></div>
${diagramPages}
</body></html>`;
}

/** 숨긴 틀에서 견적서 인쇄 창을 띄운다. */
export function printInsuranceEstimate(items: EstimateItem[], info: EstimatePrintInfo) {
  printHtmlDocument(insuranceEstimateHtml(items, info));
}

/** 숨긴 틀에 문서를 넣고 인쇄 창을 띄운다. 그림(도면·도장)이 다 뜬 뒤에 인쇄한다. 팝업 차단과 상관없다. */
export function printHtmlDocument(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const imgs = Array.from(doc.images);
  let printed = false;
  const go = () => {
    if (printed) return;
    printed = true;
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  const pending = imgs.filter((i) => !i.complete);
  if (!pending.length) { setTimeout(go, 50); return; }
  let left = pending.length;
  pending.forEach((i) => { const done = () => { if (--left <= 0) go(); }; i.onload = done; i.onerror = done; });
  setTimeout(go, 15_000); // 그림이 너무 늦으면 그냥 인쇄
}
