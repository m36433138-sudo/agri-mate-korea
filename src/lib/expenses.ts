/** 지출 분류 (AI 판독 함수와 같은 목록) */
export const EXPENSE_CATEGORIES = [
  "부품 매입", "유류비", "차량 유지", "공구·장비", "소모품", "식대", "운송·택배",
  "통신비", "전기·수도·가스", "임대료", "보험료", "세금·수수료", "광고·인쇄", "기타",
] as const;

export type Expense = {
  id: string;
  expense_date: string;
  vendor: string | null;
  business_number: string | null;
  category: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  vat: number | null;
  payment_method: string | null;
  branch: string | null;
  notes: string | null;
  receipt_path: string | null;
  receipt_group: string | null;
  source: string;
  created_at: string;
};

export type ReceiptRead = {
  vendor: string | null;
  business_number: string | null;
  date: string | null;
  payment_method: string | null;
  total: number | null;
  vat: number | null;
  items: { description: string; quantity: number | null; unit_price: number | null; amount: number; category: string }[];
};

const isDate = (s: string | null | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * AI가 읽은 영수증 → 저장할 지출 줄. 금액 0원 줄(메모·안내문)은 빼고,
 * 줄이 하나도 없으면 합계로 한 줄 만든다. 날짜를 못 읽으면 오늘.
 */
export function receiptToRows(r: ReceiptRead, today: string, extra: { receipt_path: string | null; receipt_group: string }) {
  const date = isDate(r.date) ? r.date! : today;
  const cat = (c: string) => ((EXPENSE_CATEGORIES as readonly string[]).includes(c) ? c : "기타");
  let items = r.items.filter((i) => Number.isFinite(i.amount) && i.amount !== 0);
  if (items.length === 0 && r.total) items = [{ description: r.vendor ? `${r.vendor} 결제` : "영수증", quantity: null, unit_price: null, amount: r.total, category: "기타" }];
  return items.map((i) => ({
    expense_date: date,
    vendor: r.vendor,
    business_number: r.business_number,
    payment_method: r.payment_method,
    category: cat(i.category),
    description: i.description.trim(),
    quantity: i.quantity,
    unit_price: i.unit_price,
    amount: Math.round(i.amount),
    vat: null as number | null,
    source: "ai",
    ...extra,
  }));
}

/** 분류별 합계 (큰 순) */
export function totalsByCategory(rows: Pick<Expense, "category" | "amount">[]) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.category, (m.get(r.category) ?? 0) + Number(r.amount || 0));
  return [...m.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

/** 엑셀로 내보낼 표 (머리글 + 줄 + 합계) */
export function expenseSheet(rows: Expense[]): (string | number)[][] {
  const head = ["날짜", "거래처", "사업자번호", "분류", "내용", "수량", "단가", "금액", "결제수단", "지점", "메모"];
  const body = rows.map((r) => [
    r.expense_date, r.vendor ?? "", r.business_number ?? "", r.category, r.description,
    r.quantity ?? "", r.unit_price ?? "", Number(r.amount), r.payment_method ?? "", r.branch ?? "", r.notes ?? "",
  ]);
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  return [head, ...body, ["합계", "", "", "", "", "", "", total, "", "", ""]];
}
