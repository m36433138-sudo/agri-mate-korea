type Box = { x: number; y: number; w: number; h: number; round?: boolean };
type Part = { code: string; name: string | null; no: string | null };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** 체크한 부품을 초록 동그라미로 표시한 도면 한 장 + 부품 목록을 인쇄용 HTML로 만든다 */
export function checkedDiagramHtml(opts: { title: string; model: string | null; imageUrl: string; boxes: Box[]; parts: Part[]; printedAt?: Date }) {
  const d = opts.printedAt ?? new Date();
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const boxes = opts.boxes
    .map((b) => `<div class="mk${b.round ? " r" : ""}" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%"></div>`)
    .join("");
  const rows = opts.parts
    .map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.no ?? "")}</td><td class="m">${esc(p.code)}</td><td>${esc(p.name ?? "")}</td><td class="c">☐</td></tr>`)
    .join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
<style>
@page{size:A4 landscape;margin:8mm}
*{box-sizing:border-box}body{font-family:"Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif;color:#111;margin:0}
h1{font-size:15px;margin:0 0 2px}p.s{font-size:11px;color:#555;margin:0 0 6px}
.wrap{position:relative;width:100%;border:1px solid #ccc}.wrap img{display:block;width:100%;height:auto}
.mk{position:absolute;border:3px solid #16a34a;background:rgba(22,163,74,.18);border-radius:4px}
.mk.r{border-radius:999px;transform:scale(1.35)}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px;page-break-inside:auto}
th,td{border:1px solid #bbb;padding:3px 6px;text-align:left}th{background:#f1f5f9}td.m{font-family:monospace}td.c{text-align:center;width:40px}
tr{page-break-inside:avoid}
</style></head><body>
<h1>${esc(opts.title)}</h1><p class="s">${esc(opts.model ?? "")} · 체크 ${opts.parts.length}개 · ${date} 광문농기</p>
<div class="wrap"><img src="${esc(opts.imageUrl)}" alt="">${boxes}</div>
${opts.parts.length ? `<table><thead><tr><th>#</th><th>그림번호</th><th>부품번호</th><th>부품명</th><th>확인</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
</body></html>`;
}

/** 화면 안에 숨긴 틀에서 인쇄 창을 띄운다 (팝업 차단에 안 걸림) */
export function printCheckedDiagram(opts: Parameters<typeof checkedDiagramHtml>[0]) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(checkedDiagramHtml(opts));
  doc.close();
  const img = doc.querySelector("img");
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  if (img && !img.complete) { img.onload = go; img.onerror = go; } else go();
}
