/**
 * 천년경영(MJ soft) 「거래처 원장」 엑셀 → 원장 줄.
 * 일계·월계·업체계·총합계 같은 합계 줄은 버리고, 매출(상품) 줄·입금 줄·할인 줄만 남긴다.
 * 「사업자번호」 칸(개인은 주민번호)은 읽지 않는다.
 */

export type MjCustomer = { code: string; name: string; phone: string; address: string; zip: string };
export type MjKind = "sale" | "payment" | "discount" | "memo" | "carry";
export type MjEntry = {
  source_key: string;
  legacy_customer_code: string;
  entry_date: string;
  kind: MjKind;
  item_code: string | null;
  item_name: string;
  spec: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  paid_amount: number;
  discount_amount: number;
  is_free: boolean;
  recorded_at: string | null;
};
export type MjParseResult = {
  customers: MjCustomer[];
  entries: MjEntry[];
  periodStart: string | null;
  periodEnd: string | null;
  skipped: number;
  /** 거래처별 천년경영 최종 잔액 (가져온 뒤 맞는지 확인용) */
  closingBalance: Map<string, number>;
};

const REQUIRED = ["ccode", "거래처명", "거래일자", "상  품  명"];

/** "27,000,000 " → 27000000, "(3,764,280)" → -3764280, "" → 0 */
export function mjNumber(v: unknown): number {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  const n = Number(s.replace(/[(),\s-]/g, ""));
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

const t = (v: unknown) => String(v ?? "").trim();
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 시트의 머리글 줄을 찾아 칸 위치를 잡는다 (천년경영 버전마다 칸 순서가 조금 달라도 이름으로 찾는다) */
function headerIndex(header: unknown[]) {
  const h = header.map((x) => t(x));
  const missing = REQUIRED.filter((n) => !h.includes(n));
  if (missing.length) throw new Error(`천년경영 거래처원장 엑셀이 아니에요 (없는 칸: ${missing.join(", ")})`);
  const at = (...names: string[]) => { for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; } return -1; };
  return {
    code: at("ccode"), name: at("거래처명"), date: at("거래일자"), itemCode: at("상품코드"), item: at("상  품  명", "상품명"),
    spec: at("규  격", "규격"), qty: at("수량"), unit: at("단위"), price: at("단가"), supply: at("공급가액"), vat: at("부가세"),
    taxFree: at("면세"), total: at("합계액"), paid: at("입금액"), discount: at("할인"), balance: at("잔액"), slip: at("전표번호"),
    time: at("TIME"), mobile: at("휴대폰"), tel: at("전화번호"), address: at("주소"), zip: at("우편번호"),
  };
}

export function parseMjLedger(rows: unknown[][]): MjParseResult {
  const hi = rows.findIndex((r) => r.some((c) => t(c) === "ccode"));
  if (hi < 0) throw new Error("천년경영 거래처원장 엑셀이 아니에요 (ccode 머리글이 없어요)");
  const c = headerIndex(rows[hi]);
  const get = (r: unknown[], i: number) => (i >= 0 ? t(r[i]) : "");

  const customers = new Map<string, MjCustomer>();
  const entries: MjEntry[] = [];
  const carries: { code: string; amount: number }[] = [];
  const closingBalance = new Map<string, number>();
  const seen = new Map<string, number>();
  let skipped = 0;

  for (const r of rows.slice(hi + 1)) {
    const code = get(r, c.code);
    const date = get(r, c.date);
    const name = get(r, c.item);
    if (!code) { skipped++; continue; }
    if (!customers.has(code)) {
      customers.set(code, {
        code, name: get(r, c.name), phone: (get(r, c.mobile) || get(r, c.tel)).replace(/[^\d-]/g, ""),
        address: get(r, c.address), zip: get(r, c.zip),
      });
    }
    if (date === "[전기이월]") { carries.push({ code, amount: mjNumber(r[c.balance]) }); continue; }
    if (date.startsWith("【") && date.includes("업체계")) { closingBalance.set(code, mjNumber(r[c.balance])); continue; }
    if (!DATE.test(date) || name.startsWith("【")) { skipped++; continue; }

    const slip = get(r, c.slip);
    const time = get(r, c.time);
    const recorded_at = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(time) ? `${time.slice(0, 16)}:00+09:00` : null;
    const base = {
      legacy_customer_code: code, entry_date: date, item_code: null as string | null, spec: get(r, c.spec) || null,
      quantity: null as number | null, unit: null as string | null, unit_price: 0, supply_amount: 0, vat_amount: 0,
      total_amount: 0, paid_amount: 0, discount_amount: 0, is_free: false, recorded_at,
    };

    if (!slip && /^입금/.test(name)) {
      // 입금(현금)·입금(통장)·입금(카드)·입금(할인): 전표번호가 없어 내용으로 식별값을 만든다
      const paid = mjNumber(r[c.paid]), disc = mjNumber(r[c.discount]);
      const k = `mjp:${code}:${date}:${time}:${name}:${paid}:${disc}`;
      const n = (seen.get(k) ?? 0) + 1; seen.set(k, n);
      entries.push({ ...base, source_key: n > 1 ? `${k}#${n}` : k, kind: disc && !paid ? "discount" : "payment", item_name: name, paid_amount: paid, discount_amount: disc });
      continue;
    }
    if (!slip) { skipped++; continue; }

    const supply = mjNumber(r[c.supply]), vat = mjNumber(r[c.vat]), taxFree = mjNumber(r[c.taxFree]);
    const totalCell = get(r, c.total);
    const total = totalCell ? mjNumber(totalCell) : supply + vat + taxFree;
    const itemCode = get(r, c.itemCode);
    const qty = get(r, c.qty) ? mjNumber(r[c.qty]) : null;
    const common = {
      ...base, source_key: `mj:${slip}`, item_code: itemCode && itemCode !== "000000" ? itemCode : null, item_name: name,
      quantity: qty, unit: get(r, c.unit) || null, unit_price: mjNumber(r[c.price]), supply_amount: supply, vat_amount: vat,
    };
    if (name === "할인" || (total < 0 && /할인/.test(name))) {
      entries.push({ ...common, kind: "discount", discount_amount: -total, total_amount: 0 });
    } else if (total === 0 && !common.item_code) {
      // 값 없는 글 줄: 「출고완료」·「사장님통화-서비스해주기로함」 같은 메모
      entries.push({ ...common, kind: "memo", total_amount: 0 });
    } else {
      // 상품코드가 있는데 값이 0이면 무상으로 나간 부품
      entries.push({ ...common, kind: "sale", total_amount: total, is_free: total === 0 && !!common.item_code });
    }
  }

  const dates = entries.map((e) => e.entry_date).sort();
  const periodStart = dates[0] ?? null, periodEnd = dates[dates.length - 1] ?? null;
  // 전기이월: 이 파일 기간이 시작되기 전까지의 잔액. 기간 첫날로 남겨, 가장 이른 이월만 잔액 계산에 쓴다.
  if (periodStart) {
    for (const { code, amount } of carries) {
      entries.push({
        source_key: `mjc:${code}:${periodStart}`, legacy_customer_code: code, entry_date: periodStart, kind: "carry",
        item_code: null, item_name: "전기이월", spec: null, quantity: null, unit: null, unit_price: 0, supply_amount: 0,
        vat_amount: 0, total_amount: amount, paid_amount: 0, discount_amount: 0, is_free: false, recorded_at: null,
      });
    }
  }
  return { customers: [...customers.values()], entries, periodStart, periodEnd, skipped, closingBalance };
}

/** 원장 잔액: 가장 이른 전기이월 + 그 뒤 매출 − 입금 − 할인 */
export function ledgerBalance(entries: Pick<MjEntry, "kind" | "entry_date" | "total_amount" | "paid_amount" | "discount_amount">[]): number {
  const carries = entries.filter((e) => e.kind === "carry").sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const start = carries[0];
  let bal = start ? start.total_amount : 0;
  for (const e of entries) {
    if (e.kind === "carry") continue;
    if (start && e.entry_date < start.entry_date) continue;
    bal += (e.kind === "sale" ? e.total_amount : 0) - e.paid_amount - e.discount_amount;
  }
  return bal;
}

export type AppCustomer = { id: string; name: string; phone: string | null; legacy_code: string | null };
export type CustomerMatch = { customer: MjCustomer; match: AppCustomer | null; by: "code" | "phone" | "name" | null };

const digits = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "");

/** 천년경영 거래처 → 앱 고객: 거래처코드 → 휴대폰(한 명일 때) → 이름(한 명일 때) */
export function matchCustomers(list: MjCustomer[], app: AppCustomer[]): CustomerMatch[] {
  const byCode = new Map(app.filter((a) => a.legacy_code).map((a) => [a.legacy_code!, a]));
  const byPhone = new Map<string, AppCustomer[]>();
  const byName = new Map<string, AppCustomer[]>();
  for (const a of app) {
    const p = digits(a.phone);
    if (p.length >= 10 && !/^010(0{8}|12345678)$/.test(p)) byPhone.set(p, [...(byPhone.get(p) ?? []), a]);
    byName.set(a.name.trim(), [...(byName.get(a.name.trim()) ?? []), a]);
  }
  return list.map((customer) => {
    const coded = byCode.get(customer.code);
    if (coded) return { customer, match: coded, by: "code" as const };
    const ph = byPhone.get(digits(customer.phone));
    if (ph?.length === 1) return { customer, match: ph[0], by: "phone" as const };
    const nm = byName.get(customer.name.trim());
    if (nm?.length === 1) return { customer, match: nm[0], by: "name" as const };
    return { customer, match: null, by: null };
  });
}
