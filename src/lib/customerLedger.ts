/**
 * 고객 거래 원장 (천년경영 「거래처 원장」과 같은 보기).
 * 천년경영에서 가져온 줄(ledger_entries) + 앱에서 새로 생긴 수리·부품 판매를 한 줄 목록으로 합쳐
 * 연·월로 잘라 보여 주고, 이월 잔액·합계·잔액을 계산한다.
 * 천년경영과 앱에 같은 거래가 두 번 잡히지 않도록, 앱 기록은 천년경영을 마지막으로 가져온 날 이후 것만 넣는다.
 */
import type { StatementDoc, StatementLine } from "./printPartSale";

/** adjust = 신천년 이월 조정 (화면에서만 만든다) */
export type LedgerKind = "sale" | "payment" | "discount" | "memo" | "carry" | "adjust";
export type LedgerSource = "mjsoft" | "repair" | "part_sale";
export type LedgerLine = {
  key: string;
  date: string;
  kind: LedgerKind;
  source: LedgerSource;
  /** 같은 전표(수리 한 건·판매 한 건)를 묶는 값 */
  group: string;
  code: string | null;
  name: string;
  spec: string | null;
  qty: number | null;
  unit: string | null;
  unitPrice: number;
  supply: number;
  vat: number;
  /** 매출 합계 (무상이면 0) */
  total: number;
  paid: number;
  discount: number;
  isFree: boolean;
  /** 무상일 때 원래 금액 (알 수 있을 때만) */
  waived: number;
  time: string | null;
  /** 천년경영 장부 (구천년 장흥·강진 / 신천년) */
  book?: string | null;
  /** 장부 안의 거래처 계정 「장부:거래처코드」 — 한 사람이 계정을 여러 개 가질 수 있다 */
  account?: string | null;
};

const n = (v: unknown) => Number(v) || 0;
const splitVat = (total: number) => { const supply = Math.round(total / 1.1); return { supply, vat: total - supply }; };

export type LedgerEntryRow = {
  id: string; book?: string | null; legacy_customer_code?: string | null; source_key: string; entry_date: string; kind: LedgerKind; item_code: string | null; item_name: string; spec: string | null;
  quantity: number | null; unit: string | null; unit_price: number | null; supply_amount: number | null; vat_amount: number | null;
  total_amount: number | null; paid_amount: number | null; discount_amount: number | null; is_free: boolean | null; recorded_at: string | null;
};

export function fromLedgerEntries(rows: LedgerEntryRow[]): LedgerLine[] {
  return rows.map((r) => ({
    key: r.source_key, date: r.entry_date, kind: r.kind, source: "mjsoft",
    // 천년경영 전표번호는 「날짜-순번」이라 같은 날 매출은 하나로 묶는다
    group: r.kind === "sale" || r.kind === "memo" ? `mj:${r.book ?? ""}:${r.entry_date}` : r.source_key,
    code: r.item_code, name: r.item_name, spec: r.spec, qty: r.quantity, unit: r.unit, unitPrice: n(r.unit_price),
    supply: n(r.supply_amount), vat: n(r.vat_amount), total: r.kind === "carry" || r.kind === "sale" ? n(r.total_amount) : 0,
    paid: n(r.paid_amount), discount: n(r.discount_amount), isFree: !!r.is_free, waived: 0, time: r.recorded_at, book: r.book ?? null,
    account: `${r.book ?? ""}:${r.legacy_customer_code ?? ""}`,
  }));
}

export type AppRepair = {
  id: string; repair_date: string; repair_content: string | null; technician: string | null; labor_cost: number | null; total_cost: number | null;
  is_free_service?: boolean | null; free_reason?: string | null; waived_amount?: number | null; created_at?: string | null;
  machines?: { model_name: string | null } | null;
  repair_parts?: { quantity: number; unit_price: number; parts?: { part_number: string | null; part_name: string | null } | null }[];
};

/** 앱 수리 → 부품 줄 + 공임 줄 + (받은 돈 줄). outstanding = 이 수리로 남은 미수금 */
export function fromRepair(r: AppRepair, outstanding = 0): LedgerLine[] {
  const free = !!r.is_free_service;
  const g = `repair:${r.id}`;
  const base = { date: r.repair_date, source: "repair" as const, group: g, spec: null, unit: null, paid: 0, discount: 0, time: r.created_at ?? null };
  const lines: LedgerLine[] = (r.repair_parts ?? []).map((p, i) => {
    const amount = n(p.quantity) * n(p.unit_price);
    return {
      ...base, key: `${g}:p${i}`, kind: "sale", code: p.parts?.part_number ?? null, name: p.parts?.part_name || p.parts?.part_number || "부품",
      qty: n(p.quantity), unitPrice: n(p.unit_price), ...splitVat(free ? 0 : amount), total: free ? 0 : amount, isFree: free, waived: free ? amount : 0,
    };
  });
  const labor = n(r.labor_cost);
  if (labor > 0) {
    lines.push({
      ...base, key: `${g}:labor`, kind: "sale", code: null, name: `공임 · ${[r.machines?.model_name, r.repair_content].filter(Boolean).join(" ")}`.slice(0, 80),
      qty: 1, unitPrice: labor, ...splitVat(free ? 0 : labor), total: free ? 0 : labor, isFree: free, waived: free ? labor : 0,
    });
  }
  // 부품·공임 합과 총액이 다르면 (직접 고친 총액) 차액을 한 줄로
  const billed = lines.reduce((s, l) => s + l.total, 0);
  const total = free ? 0 : n(r.total_cost);
  if (!free && total !== billed) {
    lines.push({ ...base, key: `${g}:adj`, kind: "sale", code: null, name: "수리비 조정", qty: null, unitPrice: 0, ...splitVat(total - billed), total: total - billed, isFree: false, waived: 0 });
  }
  if (!lines.length) {
    lines.push({ ...base, key: `${g}:memo`, kind: "memo", code: null, name: `수리 · ${r.repair_content ?? ""}`, qty: null, unitPrice: 0, supply: 0, vat: 0, total: 0, isFree: free, waived: 0 });
  }
  if (free && r.free_reason) {
    lines.push({ ...base, key: `${g}:reason`, kind: "memo", code: null, name: `무상(서비스) 사유: ${r.free_reason}`, qty: null, unitPrice: 0, supply: 0, vat: 0, total: 0, isFree: true, waived: 0 });
  }
  const paid = Math.max(0, total - outstanding);
  if (paid > 0) lines.push({ ...base, key: `${g}:paid`, kind: "payment", code: null, name: "입금(수리비)", qty: null, unitPrice: 0, supply: 0, vat: 0, total: 0, paid, isFree: false, waived: 0 });
  return lines;
}

export type AppPartSale = {
  id: string; sale_date: string; subtotal: number; discount: number; total_amount: number; paid_amount: number; payment_method: string | null;
  created_at?: string | null; part_sale_items?: { part_code: string; part_name: string; quantity: number; unit_price: number }[];
};

export function fromPartSale(s: AppPartSale): LedgerLine[] {
  const g = `sale:${s.id}`;
  const base = { date: s.sale_date, source: "part_sale" as const, group: g, spec: null, unit: null, paid: 0, discount: 0, isFree: false, waived: 0, time: s.created_at ?? null };
  const lines: LedgerLine[] = (s.part_sale_items ?? []).map((it, i) => {
    const amount = n(it.quantity) * n(it.unit_price);
    return { ...base, key: `${g}:${i}`, kind: "sale", code: it.part_code, name: it.part_name, qty: n(it.quantity), unitPrice: n(it.unit_price), ...splitVat(amount), total: amount, isFree: amount === 0 };
  });
  if (n(s.discount) > 0) lines.push({ ...base, key: `${g}:disc`, kind: "discount", code: null, name: "할인", qty: null, unitPrice: 0, supply: 0, vat: 0, total: 0, discount: n(s.discount) });
  if (n(s.paid_amount) > 0) lines.push({ ...base, key: `${g}:paid`, kind: "payment", code: null, name: `입금${s.payment_method ? `(${s.payment_method})` : ""}`, qty: null, unitPrice: 0, supply: 0, vat: 0, total: 0, paid: n(s.paid_amount) });
  return lines;
}

/** 이 줄이 잔액을 얼마나 바꾸는지 */
export const lineDelta = (l: LedgerLine) => (l.kind === "sale" || l.kind === "adjust" ? l.total : 0) - l.paid - l.discount;

export type LedgerDay = { date: string; lines: (LedgerLine & { balance: number })[] };
export type LedgerView = {
  opening: number;
  closing: number;
  days: LedgerDay[];
  sum: { supply: number; vat: number; total: number; paid: number; discount: number; free: number; freeAmount: number };
};

const ORDER: Record<LedgerKind, number> = { carry: 0, adjust: 0, sale: 1, memo: 1, discount: 2, payment: 3 };
const sortLines = (a: LedgerLine, b: LedgerLine) =>
  a.date.localeCompare(b.date) || a.group.localeCompare(b.group) || ORDER[a.kind] - ORDER[b.kind] || a.key.localeCompare(b.key);

/**
 * 기간 [from, to] (YYYY-MM-DD, to 포함)의 원장.
 * 이월 = 가장 이른 전기이월 + 그 뒤 기간 전까지의 증감. (천년경영 파일마다 붙는 전기이월은 첫 것만 쓴다.
 * 신천년 전기이월은 구천년 2025-10-31 잔액을 옮긴 것이라, 구천년 기록이 있는 고객은 구천년 이월이 더 이르러 자연히 한 번만 센다)
 */
/** 장부마다 가장 이른 전기이월. 구천년 기록이 있으면 신천년 이월(구천년 잔액을 옮긴 것)은 빼야 두 번 세지 않는다. */
const acct = (l: LedgerLine) => l.account ?? l.book ?? "";

export function openingCarries(all: LedgerLine[]): Map<string, LedgerLine> {
  const first = new Map<string, LedgerLine>();
  for (const l of all) {
    if (l.kind !== "carry") continue;
    const cur = first.get(acct(l));
    if (!cur || l.date < cur.date) first.set(acct(l), l);
  }
  if (all.some((l) => l.book?.startsWith("old"))) for (const [k, l] of first) if (l.book === "new") first.delete(k);
  return first;
}

/** 구천년 마지막 날(이 날까지 구천년, 다음 날부터 신천년) */
export const OLD_BOOKS_UNTIL = "2025-10-31";

const adjustLine = (key: string, date: string, name: string, total: number, book: string | null): LedgerLine => ({
  key, date, kind: "adjust", source: "mjsoft", group: "adjust", code: null, name, spec: null, qty: null, unit: null,
  unitPrice: 0, supply: 0, vat: 0, total, paid: 0, discount: 0, isFree: false, waived: 0, time: null, book,
});
const won = (v: number) => v.toLocaleString("ko-KR");

/**
 * 「이월 조정」 줄 (화면에서만 만든다)
 * 1) 같은 장부의 다음 해 파일 전기이월이 앞 해 마감 잔액과 다르면(연초에 잔액을 고친 경우) 그날 차이를 한 줄로.
 * 2) 구천년과 신천년이 함께 있으면: 신천년 첫 이월은 구천년 10-31 잔액을 옮긴 것이라 빼고, 옮길 때 달라진 만큼을 2025-11-01에 한 줄로.
 * 이렇게 하면 지금 잔액이 언제나 지금 쓰는 장부의 잔액과 같다.
 */
export function carryAdjustments(all: LedgerLine[]): LedgerLine[] {
  const out: LedgerLine[] = [];
  const accounts = [...new Set(all.filter((l) => l.kind === "carry").map(acct))];
  const endBal = new Map<string, (upTo: string) => number>();
  const firstCarry = new Map<string, LedgerLine>();
  for (const b of accounts) {
    const carries = [...new Map(all.filter((l) => l.kind === "carry" && acct(l) === b).map((l) => [l.date, l])).values()]
      .sort((x, y) => x.date.localeCompare(y.date));
    firstCarry.set(b, carries[0]);
    const book = carries[0].book ?? null;
    const lines = all.filter((l) => l.kind !== "carry" && acct(l) === b && l.date >= carries[0].date);
    const adj: LedgerLine[] = [];
    const balBefore = (date: string, inclusive: boolean) =>
      carries[0].total
      + lines.reduce((t, l) => t + ((inclusive ? l.date <= date : l.date < date) ? lineDelta(l) : 0), 0)
      + adj.reduce((t, l) => t + ((inclusive ? l.date <= date : l.date < date) ? l.total : 0), 0);
    for (const c of carries.slice(1)) {
      const diff = c.total - balBefore(c.date, false);
      if (diff) adj.push({ ...adjustLine(`adjust:${b}:${c.date}`, c.date, `이월 조정 (장부 이월 ${won(c.total)} − 앞 기간 마감 ${won(c.total - diff)})`, diff, book), account: b });
    }
    out.push(...adj);
    endBal.set(b, (upTo) => balBefore(upTo, true));
  }
  const oldAcc = accounts.filter((b) => firstCarry.get(b)!.book?.startsWith("old"));
  const newAcc = accounts.filter((b) => firstCarry.get(b)!.book === "new");
  const hasOld = all.some((l) => l.book?.startsWith("old"));
  const hasNew = all.some((l) => l.book === "new");
  if (hasOld) {
    // 구천년 10/31 잔액: 이월이 있는 계정은 이월부터, 없는 계정은 줄 합계로
    const noCarry = all.filter((l) => l.kind !== "carry" && l.book?.startsWith("old") && !firstCarry.has(acct(l)) && l.date <= OLD_BOOKS_UNTIL);
    const old = oldAcc.reduce((t, b) => t + endBal.get(b)!(OLD_BOOKS_UNTIL), 0) + noCarry.reduce((t, l) => t + lineDelta(l), 0);
    if (hasNew) {
      const nw = newAcc.reduce((t, b) => t + firstCarry.get(b)!.total, 0);
      const diff = nw - old;
      // 신천년 첫 이월은 빼고 계산하니, 이 줄이 「신천년 이월 − 구천년 잔액」 만큼을 맞춘다
      if (diff) out.push(adjustLine("adjust:new-carry", "2025-11-01", `신천년 이월 조정 (신천년 이월 ${won(nw)} − 구천년 10/31 잔액 ${won(old)})`, diff, "new"));
    } else if (old) {
      // 미수는 신천년 기준: 신천년으로 넘어오지 않은 구천년 잔액은 정리한다 (거래 기록은 그대로 보인다)
      out.push(adjustLine("adjust:old-close", "2025-11-01", `구천년 잔액 정리 (신천년으로 넘어오지 않은 10/31 잔액 ${won(old)})`, -old, "old"));
    }
  }
  return out;
}

export function buildLedger(input: LedgerLine[], from: string, to: string): LedgerView {
  const all = [...input, ...carryAdjustments(input)];
  const carries = openingCarries(all);
  // 장부의 이월보다 앞선 줄은 그 이월에 이미 들어 있다
  const live = all.filter((l) => {
    if (l.kind === "carry") return false;
    const c = carries.get(acct(l));
    return !c || l.date >= c.date;
  }).sort(sortLines);
  let bal = [...carries.values()].reduce((s, c) => s + c.total, 0);
  for (const l of live) if (l.date < from) bal += lineDelta(l);
  const opening = bal;
  const sum = { supply: 0, vat: 0, total: 0, paid: 0, discount: 0, free: 0, freeAmount: 0 };
  const days: LedgerDay[] = [];
  for (const l of live) {
    if (l.date < from || l.date > to) continue;
    bal += lineDelta(l);
    if (l.kind === "sale") { sum.supply += l.supply; sum.vat += l.vat; sum.total += l.total; }
    sum.paid += l.paid; sum.discount += l.discount;
    if (l.isFree && l.kind === "sale") { sum.free++; sum.freeAmount += l.waived; }
    const day = days[days.length - 1];
    if (day?.date === l.date) day.lines.push({ ...l, balance: bal });
    else days.push({ date: l.date, lines: [{ ...l, balance: bal }] });
  }
  return { opening, closing: bal, days, sum };
}

/** 거래가 있는 해 (최근 해 먼저) */
export function ledgerYears(all: LedgerLine[]): number[] {
  return [...new Set(all.filter((l) => l.kind !== "carry").map((l) => Number(l.date.slice(0, 4))))].sort((a, b) => b - a);
}

/** 월별 거래 건수 (1~12) */
export function monthCounts(all: LedgerLine[], year: number): number[] {
  const c = Array(12).fill(0);
  for (const l of all) if (l.kind !== "carry" && l.date.startsWith(`${year}-`)) c[Number(l.date.slice(5, 7)) - 1]++;
  return c;
}

export const periodOf = (year: number, month: number | null): [string, string] => {
  if (!month) return [`${year}-01-01`, `${year}-12-31`];
  const mm = String(month).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [`${year}-${mm}-01`, `${year}-${mm}-${last}`];
};

/** 원장에서 고른 줄 → 거래명세서 한 장 */
export function ledgerToStatement(
  lines: LedgerLine[],
  customer: { name: string; phone?: string | null; address?: string | null },
  balanceAfter?: number,
): StatementDoc {
  const sorted = [...lines].sort(sortLines);
  const items: StatementLine[] = sorted.filter((l) => l.kind === "sale").map((l) => ({
    code: l.code, name: l.name, spec: l.spec, qty: l.qty ?? 1, unit: l.unit, unitPrice: l.unitPrice,
    amount: l.total, free: l.isFree,
  }));
  const memos = sorted.filter((l) => l.kind === "memo").map((l) => l.name);
  const subtotal = items.reduce((s, l) => s + l.amount, 0);
  const discount = sorted.reduce((s, l) => s + l.discount, 0);
  const paid = sorted.reduce((s, l) => s + l.paid, 0);
  const total = subtotal - discount;
  const waived = sorted.reduce((s, l) => s + (l.kind === "sale" ? l.waived : 0), 0);
  const dates = sorted.map((l) => l.date);
  const first = dates[0] ?? "", last = dates[dates.length - 1] ?? first;
  return {
    docNo: `LG-${first.replace(/-/g, "").slice(2)}${last !== first ? `-${last.replace(/-/g, "").slice(4)}` : ""}`,
    date: last,
    subtitle: first === last ? "거래 원장" : `거래 원장 ${first} ~ ${last}`,
    buyerName: customer.name, buyerPhone: customer.phone, buyerAddress: customer.address,
    lines: items, subtotal, discount: discount || undefined, total, paid,
    payLabel: paid >= total ? "완납" : paid > 0 ? "일부 입금" : "외상",
    notes: [memos.length ? memos.join(" · ") : null, balanceAfter != null ? `거래 후 잔액 ${balanceAfter.toLocaleString("ko-KR")}원` : null].filter(Boolean).join("\n") || null,
    freeService: waived > 0 ? { waived } : null,
  };
}
