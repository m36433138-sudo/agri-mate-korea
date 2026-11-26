import { describe, expect, it } from "vitest";
import { mergeMjExports, groupNewCustomers, guessMjBook, ledgerBalance, matchCustomers, mjNumber, parseMjLedger } from "./mjLedger";

// 천년경영 거래처원장 엑셀과 같은 칸 이름 (값은 예시)
const H = ["ccode", "거래처명", "거래일자", "상품코드", "상  품  명", "규  격", "수량", "단위", "단가", "공급가액", "부가세", "면세", "합계액", "입금액", "할인", "잔액", "휴대폰", "주소", "우편번호", "전표번호", "사업자번호", "TIME"];
const row = (o: Record<string, string>) => H.map((h) => o[h] ?? "");
const C = { ccode: "000167", 거래처명: "홍길동", 휴대폰: "010-1111-2222", 주소: "전남 강진군", 우편번호: "59254", 사업자번호: "800101-1234567" };
const rows = [
  H,
  row({ ...C, 거래일자: "[전기이월]", 잔액: "1,000,000 " }),
  row({ ...C, 거래일자: "2026-02-22", 상품코드: "000000", "상  품  명": "트랙터출장수리-", 수량: "1 ", 단가: "0 ", 공급가액: "0 ", 부가세: "0 ", 전표번호: "260222001200", TIME: "2026-02-23 12:59" }),
  row({ ...C, 거래일자: "2026-02-22", 상품코드: "000200", "상  품  명": "EGR가스온도센서", "규  격": "129A00-13752", 수량: "1 ", 단위: "EA", 단가: "110,000 ", 공급가액: "100,000 ", 부가세: "10,000 ", 합계액: "110,000 ", 전표번호: "260222001300" }),
  row({ ...C, 거래일자: "2026-02-22", 상품코드: "000000", "상  품  명": "출장비", "규  격": "이재현", 수량: "1 ", 공급가액: "63,637 ", 부가세: "6,363 ", 전표번호: "260222001400" }),
  row({ ...C, 거래일자: "2026-02-22", 상품코드: "002269", "상  품  명": "리프트실린더-R", 수량: "1 ", 단가: "0 ", 공급가액: "0 ", 부가세: "0 ", 전표번호: "260222001500" }),
  row({ ...C, 거래일자: "2026-02-22", "상  품  명": "【 일계 】", 공급가액: "163,637 " }),
  row({ ...C, 거래일자: "2026-03-01", "상  품  명": "입금(통장)", "규  격": "농협", 입금액: "100,000 ", TIME: "2026-03-01 09:00" }),
  row({ ...C, 거래일자: "2026-03-02", "상  품  명": "입금(할인)", 입금액: "0 ", 할인: "10,000 ", TIME: "2026-03-02 09:00" }),
  row({ ...C, 거래일자: "2026-03-03", 상품코드: "000000", "상  품  명": "할인", 단가: "(5,000)", 공급가액: "(4,545)", 부가세: "(455)", 합계액: "(5,000)", 전표번호: "260303000100" }),
  row({ ...C, 거래일자: "【 03월계 】" }),
  row({ ...C, 거래일자: "【 업체계 】", 잔액: "1,065,000 " }),
  row({ ccode: "", 거래처명: "", 거래일자: "【 총 합 계 】" }),
];

describe("천년경영 거래처원장 가져오기", () => {
  const r = parseMjLedger(rows);
  it("괄호 금액은 음수", () => {
    expect(mjNumber("(3,764,280)")).toBe(-3764280);
    expect(mjNumber("27,000,000 ")).toBe(27000000);
    expect(mjNumber("")).toBe(0);
  });
  it("합계 줄은 버리고 매출·메모·무상·입금·할인·이월로 나눈다", () => {
    expect(r.entries.map((e) => [e.kind, e.item_name])).toEqual([
      ["memo", "트랙터출장수리-"], ["sale", "EGR가스온도센서"], ["sale", "출장비"], ["sale", "리프트실린더-R"],
      ["payment", "입금(통장)"], ["discount", "입금(할인)"], ["discount", "할인"], ["carry", "전기이월"],
    ]);
    expect(r.entries.find((e) => e.item_name === "출장비")?.total_amount).toBe(70000); // 합계 칸이 비면 공급가+부가세
    expect(r.entries.find((e) => e.item_name === "리프트실린더-R")?.is_free).toBe(true);
    expect(r.entries.find((e) => e.item_name === "EGR가스온도센서")).toMatchObject({ source_key: "new:mj:260222001300", book: "new", item_code: "000200", unit: "EA", quantity: 1 });
  });
  it("주민번호 칸은 어디에도 남지 않는다", () => {
    expect(JSON.stringify(r)).not.toContain("1234567");
  });
  it("원장 잔액이 천년경영 업체계 잔액과 같다", () => {
    expect(ledgerBalance(r.entries)).toBe(r.closingBalance.get("000167"));
    expect(r.closingBalance.get("000167")).toBe(1065000);
  });
  it("다시 가져와도 같은 식별값", () => {
    expect(parseMjLedger(rows).entries.map((e) => e.source_key)).toEqual(r.entries.map((e) => e.source_key));
    expect(new Set(r.entries.map((e) => e.source_key)).size).toBe(r.entries.length);
  });
  it("거래처 맞추기: 코드 → 휴대폰 → 이름", () => {
    const bc = r.customers.map((c) => ({ ...c, book: "new" as const }));
    const m = matchCustomers(bc, [
      { id: "a", name: "홍길동", phone: "01011112222" },
      { id: "b", name: "홍길동", phone: "01099998888" },
    ]);
    expect(m[0]).toMatchObject({ by: "phone", match: { id: "a" } });
    expect(matchCustomers(bc, [{ id: "c", name: "김철수", phone: null }], [{ book: "new", code: "000167", customer_id: "c" }])[0].by).toBe("code");
    // 다른 장부의 같은 코드는 다른 사람
    expect(matchCustomers(bc, [{ id: "c", name: "김철수", phone: null }], [{ book: "old-jh", code: "000167", customer_id: "c" }])[0].match).toBeNull();
    expect(matchCustomers(bc, [{ id: "d", name: "홍길동", phone: null }])[0].by).toBe("name");
    expect(matchCustomers(bc, [])[0].match).toBeNull();
  });

  it("장부: 구천년은 2025-10-31까지만, 식별값에 장부가 붙는다", () => {
    const old = [H,
      row({ ...C, 거래일자: "2025-10-31", 상품코드: "000200", "상  품  명": "필터", 합계액: "11,000 ", 공급가액: "10,000 ", 부가세: "1,000 ", 전표번호: "251031000100" }),
      row({ ...C, 거래일자: "2025-11-03", 상품코드: "000200", "상  품  명": "필터", 합계액: "11,000 ", 공급가액: "10,000 ", 부가세: "1,000 ", 전표번호: "251103000100" }),
    ];
    const o = parseMjLedger(old, "old-gj");
    expect(o.entries.map((e) => e.source_key)).toEqual(["old-gj:mj:251031000100"]);
    expect(o.afterCutoff).toBe(1);
    expect(parseMjLedger(old, "new").entries).toHaveLength(2);
    expect(guessMjBook(o)).toBe("old-gj"); // 주소가 강진
    expect(guessMjBook(r)).toBe("new"); // 2026년 줄
  });
  it("새 고객은 장부가 달라도 같은 휴대폰이면 한 명", () => {
    const g = groupNewCustomers([
      { code: "1", name: "홍길동", phone: "010-1111-2222", address: "", zip: "", book: "old-jh" },
      { code: "9", name: "홍길동(신)", phone: "01011112222", address: "", zip: "", book: "new" },
      { code: "2", name: "김철수", phone: "", address: "", zip: "", book: "old-gj" },
    ]);
    expect(g.map((x) => x.map((c) => c.code))).toEqual([["9", "1"], ["2"]]);
  });
  it("겹치는 파일은 더 늦게까지 뽑은 쪽이 이긴다 (그 사이 지운 전표는 남지 않는다)", () => {
    const e = (key: string, date: string, code = "1") => ({ source_key: key, book: "new" as const, legacy_customer_code: code, entry_date: date } as any);
    const c = (code: string) => ({ code, name: "", phone: "", address: "", zip: "" });
    const m = mergeMjExports([
      { book: "new", periodStart: "2026-01-01", periodEnd: "2026-06-16", entries: [e("a", "2026-02-01"), e("deleted", "2026-03-01"), e("other", "2026-03-01", "2")], customers: [c("1"), c("2")] },
      { book: "new", periodStart: "2026-01-01", periodEnd: "2026-11-26", entries: [e("a", "2026-02-01"), e("b", "2026-08-01")], customers: [c("1")] },
    ]);
    expect(m.entries.map((x) => x.source_key).sort()).toEqual(["a", "b", "other"]);
    expect(m.ranges[0]).toMatchObject({ start: "2026-01-01", end: "2026-11-26", codes: ["1"] });
  });
});
