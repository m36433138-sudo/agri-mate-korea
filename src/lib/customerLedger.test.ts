import { describe, expect, it } from "vitest";
import { buildLedger, fromLedgerEntries, fromPartSale, fromRepair, ledgerToStatement, ledgerYears, monthCounts, periodOf, type LedgerEntryRow } from "./customerLedger";

const row = (o: Partial<LedgerEntryRow> & Pick<LedgerEntryRow, "source_key" | "entry_date" | "kind">): LedgerEntryRow => ({
  id: o.source_key, item_code: null, item_name: "", spec: null, quantity: null, unit: null, unit_price: 0, supply_amount: 0, vat_amount: 0,
  total_amount: 0, paid_amount: 0, discount_amount: 0, is_free: false, recorded_at: null, ...o,
});

const mj = fromLedgerEntries([
  row({ source_key: "mjc:1:2025-01-02", entry_date: "2025-01-02", kind: "carry", item_name: "전기이월", total_amount: 100000 }),
  row({ source_key: "mjc:1:2026-01-05", entry_date: "2026-01-05", kind: "carry", item_name: "전기이월", total_amount: 999999 }), // 나중 파일 이월은 무시
  row({ source_key: "mj:250310-1", entry_date: "2025-03-10", kind: "sale", item_code: "A1", item_name: "엔진오일", quantity: 2, unit_price: 22000, supply_amount: 40000, vat_amount: 4000, total_amount: 44000 }),
  row({ source_key: "mj:250310-2", entry_date: "2025-03-10", kind: "sale", item_code: "B2", item_name: "필터", quantity: 1, total_amount: 0, is_free: true }),
  row({ source_key: "mjp:1:2025-03-12", entry_date: "2025-03-12", kind: "payment", item_name: "입금(통장)", paid_amount: 120000 }),
  row({ source_key: "mj:260105-1", entry_date: "2026-01-05", kind: "sale", item_name: "벨트", total_amount: 33000, supply_amount: 30000, vat_amount: 3000 }),
  row({ source_key: "mj:260105-2", entry_date: "2026-01-05", kind: "discount", item_name: "할인", discount_amount: 3000 }),
]);

describe("고객 거래 원장", () => {
  it("연도·월 목록과 이월·잔액", () => {
    expect(ledgerYears(mj)).toEqual([2026, 2025]);
    expect(monthCounts(mj, 2025)[2]).toBe(3);
    const y25 = buildLedger(mj, ...periodOf(2025, null));
    expect(y25.opening).toBe(100000);
    expect(y25.closing).toBe(100000 + 44000 - 120000);
    expect(y25.sum).toMatchObject({ total: 44000, supply: 40000, vat: 4000, paid: 120000, free: 1 });
    expect(y25.days.map((d) => d.date)).toEqual(["2025-03-10", "2025-03-12"]);
    const jan26 = buildLedger(mj, ...periodOf(2026, 1));
    expect(jan26.opening).toBe(24000);
    expect(jan26.closing).toBe(24000 + 33000 - 3000);
    expect(periodOf(2026, 2)).toEqual(["2026-02-01", "2026-02-28"]);
  });

  it("앱 수리: 부품·공임·입금, 무상이면 0원으로 원래 금액만 남김", () => {
    const r = { id: "r1", repair_date: "2026-11-20", repair_content: "오일 교환", technician: "김", labor_cost: 30000, total_cost: 74000,
      machines: { model_name: "YT5113" }, repair_parts: [{ quantity: 2, unit_price: 22000, parts: { part_number: "A1", part_name: "엔진오일" } }] };
    const lines = fromRepair(r, 24000);
    expect(lines.map((l) => [l.kind, l.total, l.paid])).toEqual([["sale", 44000, 0], ["sale", 30000, 0], ["payment", 0, 50000]]);
    const free = fromRepair({ ...r, total_cost: 0, is_free_service: true, waived_amount: 74000, free_reason: "보증" });
    expect(free.filter((l) => l.kind === "sale").every((l) => l.total === 0 && l.isFree)).toBe(true);
    expect(free.some((l) => l.name.includes("보증"))).toBe(true);
    const v = buildLedger(free, ...periodOf(2026, 11));
    expect(v.closing).toBe(0);
    expect(v.sum.freeAmount).toBe(74000);
  });

  it("앱 부품 판매와 거래명세서 만들기", () => {
    const s = fromPartSale({ id: "s1", sale_date: "2026-11-21", subtotal: 50000, discount: 5000, total_amount: 45000, paid_amount: 20000, payment_method: "현금",
      part_sale_items: [{ part_code: "C3", part_name: "호스", quantity: 1, unit_price: 50000 }] });
    expect(buildLedger(s, ...periodOf(2026, 11)).closing).toBe(25000);
    const d = ledgerToStatement([...mj.filter((l) => l.date === "2025-03-10")], { name: "김정균" }, 144000);
    expect(d.lines.map((l) => [l.name, l.amount, !!l.free])).toEqual([["엔진오일", 44000, false], ["필터", 0, true]]);
    expect(d).toMatchObject({ total: 44000, paid: 0, payLabel: "외상", date: "2025-03-10" });
    expect(d.notes).toContain("144,000");
  });
});
