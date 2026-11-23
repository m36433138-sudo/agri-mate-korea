/**
 * 얀마 부품 거래명세서(PDF) 읽기.
 * PDF 글자층에 부품번호·위치·수량·단가·금액이 정확히 들어 있어서 AI 없이 칸 위치로 읽는다.
 * (한글 품명은 글꼴이 빠져 있어 글자층에 없다 → 품명은 재고 목록에서 채운다)
 */

export type PdfTextItem = { x: number; y: number; str: string };
export type PdfTextPage = { width: number; height: number; items: PdfTextItem[] };

export type YanmarLine = {
  lineNo: number;
  orderNo: string;
  partCode: string;
  altCode: string | null;
  nameHint: string;
  location: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  vat: number;
  total: number;
};

export type YanmarStatement = {
  docNumber: string | null;
  date: string | null; // YYYY-MM-DD
  lines: YanmarLine[];
  supplyTotal: number | null;
  vatTotal: number | null;
  grandTotal: number | null;
  /** 줄 금액이 수량×단가와 다르거나 합계가 안 맞는 등 사람이 확인할 것 */
  problems: string[];
};

const ORDER_NO = /^[A-Z]{3}\d{4,}-\d{3}-\d{3}$/;
const DOC_NO = /^[A-Z]{3}\d{5,}$/;
const MONEY = /^-?[\d,]+$/;
const PART_CODE = /^[0-9A-Z]{2,}[0-9A-Z]*(?:-[0-9A-Z]+)+$/;
const LOCATION = /^[A-Z]{1,3}\d{0,2}(?:-[0-9A-Z]+)?$/;

const num = (s: string) => Number(s.replace(/,/g, ""));

/** 얀마 명세서처럼 보이는지: 주문번호(CKT…-001-001) 줄이 있고 문서번호가 있다 */
export function isYanmarStatement(pages: PdfTextPage[]): boolean {
  const all = pages.flatMap((p) => p.items.map((i) => i.str.trim()));
  return all.some((s) => ORDER_NO.test(s)) && all.some((s) => DOC_NO.test(s) && !ORDER_NO.test(s));
}

export function parseYanmarStatement(pages: PdfTextPage[]): YanmarStatement {
  const problems: string[] = [];
  let docNumber: string | null = null;
  let date: string | null = null;
  let supplyTotal: number | null = null;
  let vatTotal: number | null = null;
  let grandTotal: number | null = null;
  const lines: YanmarLine[] = [];

  for (const page of pages) {
    const W = page.width || 595;
    const items = page.items.map((i) => ({ ...i, str: i.str.trim(), fx: i.x / W })).filter((i) => i.str);

    if (!docNumber) docNumber = items.find((i) => DOC_NO.test(i.str) && !ORDER_NO.test(i.str))?.str ?? null;
    if (!date) {
      const d = items.find((i) => /^\d{4}\/\d{2}\/\d{2}$/.test(i.str) && i.y < page.height * 0.12);
      if (d) date = d.str.replace(/\//g, "-");
    }

    // 표의 각 줄은 주문번호로 시작한다. 같은 줄(±2)과 바로 아래 줄(+5~+13)을 묶는다.
    const anchors = items.filter((i) => ORDER_NO.test(i.str) && i.fx < 0.2).sort((a, b) => a.y - b.y);
    for (const a of anchors) {
      const main = items.filter((i) => Math.abs(i.y - a.y) <= 2);
      const below = items.filter((i) => i.y - a.y > 4 && i.y - a.y <= 13);
      const inCol = (arr: typeof items, lo: number, hi: number) => arr.filter((i) => i.fx >= lo && i.fx < hi).sort((p, q) => p.x - q.x);

      const codeMain = inCol(main, 0.2, 0.52);
      const partCode = codeMain.find((i) => PART_CODE.test(i.str))?.str ?? codeMain[0]?.str ?? "";
      const alt = codeMain.map((i) => /\(\s*([0-9A-Z-]+)\s*\)/.exec(i.str)?.[1]).find(Boolean) ?? null;
      const nameHint = inCol(below, 0.2, 0.52).map((i) => i.str).join(" ").replace(/\s+/g, " ").replace(/^[,\s]+|[,\s]+$/g, "");
      const location = inCol(main, 0.52, 0.62).find((i) => LOCATION.test(i.str))?.str ?? null;
      const qty = inCol(main, 0.62, 0.69).find((i) => MONEY.test(i.str));
      const unit = inCol(main, 0.69, 0.77).find((i) => MONEY.test(i.str));
      const amount = inCol(main, 0.77, 0.865).find((i) => MONEY.test(i.str));
      const vat = inCol(below, 0.77, 0.865).find((i) => MONEY.test(i.str));
      const total = inCol(main, 0.865, 1).find((i) => MONEY.test(i.str));
      const lineNo = items.find((i) => i.fx < 0.08 && Math.abs(i.y - a.y) <= 5 && /^\d+$/.test(i.str));

      const line: YanmarLine = {
        lineNo: lineNo ? Number(lineNo.str) : lines.length + 1,
        orderNo: a.str,
        partCode,
        altCode: alt && alt !== partCode ? alt : null,
        nameHint,
        location,
        quantity: qty ? num(qty.str) : 0,
        unitPrice: unit ? num(unit.str) : 0,
        amount: amount ? num(amount.str) : 0,
        vat: vat ? num(vat.str) : 0,
        total: total ? num(total.str) : 0,
      };
      if (!line.partCode) problems.push(`${line.lineNo}번 줄: 부품번호를 읽지 못했어요`);
      if (!line.quantity) problems.push(`${line.lineNo}번 줄: 수량을 읽지 못했어요`);
      else if (line.unitPrice && Math.abs(line.quantity * line.unitPrice - line.amount) > 1) {
        problems.push(`${line.lineNo}번 줄: 수량×단가(${(line.quantity * line.unitPrice).toLocaleString("ko-KR")})가 금액(${line.amount.toLocaleString("ko-KR")})과 달라요`);
      }
      lines.push(line);
    }

    // 합계 칸: 「Total」 오른쪽의 공급가·부가세, 「Grand Total」 오른쪽의 총액
    const totalLabel = items.find((i) => i.str === "Total");
    if (totalLabel) {
      const row = items.filter((i) => i.fx > 0.75 && i.y >= totalLabel.y - 5 && i.y <= totalLabel.y + 10 && MONEY.test(i.str)).sort((p, q) => p.y - q.y || p.x - q.x);
      const supply = row.find((i) => i.fx < 0.865 && i.y <= totalLabel.y + 1);
      const v = row.find((i) => i.fx < 0.865 && i.y > totalLabel.y + 1);
      const t = row.find((i) => i.fx >= 0.865);
      if (supply) supplyTotal = num(supply.str);
      if (v) vatTotal = num(v.str);
      if (t) grandTotal = num(t.str);
    }
    const grand = items.find((i) => i.str === "Grand Total");
    if (grand) {
      const t = items.find((i) => i.fx >= 0.865 && Math.abs(i.y - grand.y) <= 3 && MONEY.test(i.str));
      if (t) grandTotal = num(t.str);
    }
  }

  lines.sort((a, b) => a.lineNo - b.lineNo);
  const sumAmount = lines.reduce((s, l) => s + l.amount, 0);
  const sumTotal = lines.reduce((s, l) => s + l.total, 0);
  if (supplyTotal != null && sumAmount !== supplyTotal) problems.push(`줄 금액 합(${sumAmount.toLocaleString("ko-KR")})이 공급가 합계(${supplyTotal.toLocaleString("ko-KR")})와 달라요`);
  if (grandTotal != null && sumTotal !== grandTotal) problems.push(`줄 합계(${sumTotal.toLocaleString("ko-KR")})가 총액(${grandTotal.toLocaleString("ko-KR")})과 달라요`);

  return { docNumber, date, lines, supplyTotal, vatTotal, grandTotal, problems };
}
