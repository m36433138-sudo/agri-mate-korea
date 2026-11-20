/** 입금 1건 → 미수금 후보 추천 (직원이 확인 후 승인) */

export interface OpenReceivable {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  outstanding: number;
  due_date: string | null;
  created_at: string;
  label: string;
}

export interface Allocation { finance_id: string; amount: number }

export interface MatchCandidate {
  customerId: string | null;
  customerName: string;
  score: number;
  reasons: string[];
  allocations: Allocation[];
  unallocated: number;
  outstandingTotal: number;
}

/** 「(도암)김창용」, 「김창용님」, 「김 창용」 → 「김창용」 */
export function normalizePersonName(v: string | null | undefined): string {
  return (v ?? "")
    .replace(/[(（][^)）]*[)）]/g, "")
    .replace(/님$/, "")
    .replace(/[^가-힣A-Za-z]/g, "")
    .toLowerCase();
}

export function nameScore(depositor: string | null, customer: string | null): number {
  const a = normalizePersonName(depositor);
  const b = normalizePersonName(customer);
  if (a.length < 2 || b.length < 2) return 0;
  if (a === b) return 60;
  // 은행 문자는 이름이 잘리는 경우가 있다 (예: 「김창」)
  if (b.startsWith(a) || a.startsWith(b)) return 40;
  if (a.includes(b) || b.includes(a)) return 30;
  return 0;
}

const byOldest = (x: OpenReceivable, y: OpenReceivable) =>
  (x.due_date ?? x.created_at).localeCompare(y.due_date ?? y.created_at);

/** 고른 미수금부터 채우고, 남으면 같은 고객의 오래된 미수금 순으로 나눠 넣는다 */
export function allocateDeposit(amount: number, records: OpenReceivable[], preferredId?: string): { allocations: Allocation[]; unallocated: number } {
  const ordered = [...records].filter((r) => r.outstanding > 0).sort(byOldest);
  if (preferredId) {
    const i = ordered.findIndex((r) => r.id === preferredId);
    if (i > 0) ordered.unshift(...ordered.splice(i, 1));
  }
  let left = Math.max(0, Math.round(amount));
  const allocations: Allocation[] = [];
  for (const r of ordered) {
    if (left <= 0) break;
    const take = Math.min(left, r.outstanding);
    allocations.push({ finance_id: r.id, amount: take });
    left -= take;
  }
  return { allocations, unallocated: left };
}

export function suggestMatches(
  deposit: { amount: number; depositorName: string | null },
  receivables: OpenReceivable[],
  limit = 5,
): MatchCandidate[] {
  const groups = new Map<string, OpenReceivable[]>();
  for (const r of receivables) {
    if (r.outstanding <= 0) continue;
    const key = r.customer_id ?? `none:${r.id}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out: MatchCandidate[] = [];
  for (const rows of groups.values()) {
    const name = rows[0].customer_name ?? "고객 미지정";
    const total = rows.reduce((s, r) => s + r.outstanding, 0);
    const reasons: string[] = [];
    let score = nameScore(deposit.depositorName, rows[0].customer_name);
    if (score >= 60) reasons.push("입금자 이름 일치");
    else if (score > 0) reasons.push("입금자 이름 비슷함");

    const exact = rows.find((r) => r.outstanding === deposit.amount);
    let preferred: string | undefined;
    if (exact) { score += 40; reasons.push("미수금 한 건과 금액 일치"); preferred = exact.id; }
    else if (rows.length > 1 && total === deposit.amount) { score += 35; reasons.push("미수금 합계와 금액 일치"); }
    else if (score > 0 && deposit.amount < total) { score += 10; reasons.push("일부 입금으로 보임"); }
    else if (score > 0 && deposit.amount > total) { score += 5; reasons.push("미수금보다 많이 입금"); }

    // 이름이 전혀 다르면 금액이 딱 맞을 때만 후보로 (가족·농장 이름 입금 대비)
    if (score === 40 && !reasons.some((r) => r.startsWith("입금자"))) { score = 25; reasons.push("이름 다름 · 금액만 일치"); }
    if (score <= 0) continue;

    const { allocations, unallocated } = allocateDeposit(deposit.amount, rows, preferred);
    out.push({ customerId: rows[0].customer_id, customerName: name, score, reasons, allocations, unallocated, outstandingTotal: total });
  }
  return out.sort((a, b) => b.score - a.score || a.unallocated - b.unallocated).slice(0, limit);
}

export const confidenceOf = (score: number) => (score >= 90 ? "확실" : score >= 60 ? "유력" : "확인 필요");
