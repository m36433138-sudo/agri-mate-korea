import { describe, it, expect } from "vitest";
import { parseDepositSms, splitSmsBatch, pickSmsText } from "./depositSms";
import { suggestMatches, allocateDeposit, normalizePersonName, type OpenReceivable } from "./depositMatch";

const NOW = new Date("2026-11-20T12:00:00+09:00");
const NH = "농협 입금610,000원\n11/20 11:26 301-****-1052-31 최영필 잔액128,549,964원";

describe("입금 문자 읽기", () => {
  it("실제 농협 문자에서 금액·시각·입금자·잔액을 읽는다", () => {
    const p = parseDepositSms(NH, NOW)!;
    expect(p.bank).toBe("농협");
    expect(p.amount).toBe(610000);
    expect(p.depositorName).toBe("최영필");
    expect(p.depositedAt).toBe("2026-11-20T11:26:00+09:00");
    expect(p.balance).toBe(128549964);
  });
  it("[Web발신] 머리말이 붙어도 같다", () => {
    expect(parseDepositSms(`[Web발신]\n${NH}`, NOW)?.depositorName).toBe("최영필");
  });
  it("수협 문자 형식도 읽는다", () => {
    const p = parseDepositSms("[수협]11/19 09:05\n입금 1,250,000원\n김창용\n잔액 3,000,000원", NOW)!;
    expect(p).toMatchObject({ bank: "수협", amount: 1250000, depositorName: "김창용", depositedAt: "2026-11-19T09:05:00+09:00" });
  });
  it("출금 문자는 무시한다", () => {
    expect(parseDepositSms("농협 출금50,000원\n11/20 11:26 301-****-1052-31 잔액1,000원", NOW)).toBeNull();
  });
  it("1월에 받은 12월 문자는 작년으로 본다", () => {
    expect(parseDepositSms(NH.replace("11/20", "12/31"), new Date("2027-01-01T10:00:00+09:00"))?.depositedAt)
      .toBe("2026-12-31T11:26:00+09:00");
  });
  it("같은 문자는 같은 중복 키를 만든다", () => {
    expect(parseDepositSms(NH, NOW)!.dedupeKey).toBe(parseDepositSms(`[Web발신] ${NH}`, NOW)!.dedupeKey);
  });
  it("여러 문자를 빈 줄로 나눠 붙여넣을 수 있다", () => {
    expect(splitSmsBatch(`${NH}\n\n${NH.replace("610,000", "20,000")}`)).toHaveLength(2);
  });
});

const recv = (id: string, cid: string, name: string, outstanding: number, due: string): OpenReceivable =>
  ({ id, customer_id: cid, customer_name: name, outstanding, due_date: due, created_at: due, label: id });

describe("미수금 후보 추천", () => {
  const list = [
    recv("a1", "c1", "최영필", 400000, "2026-10-01"),
    recv("a2", "c1", "최영필", 210000, "2026-11-01"),
    recv("b1", "c2", "(도암)김창용", 610000, "2026-11-10"),
    recv("d1", "c3", "박말순", 90000, "2026-11-05"),
  ];
  it("이름이 같고 미수금 합계와 금액이 맞으면 그 고객이 1순위, 두 건 모두 채운다", () => {
    const [top] = suggestMatches({ amount: 610000, depositorName: "최영필" }, list);
    expect(top.customerId).toBe("c1");
    expect(top.allocations).toEqual([{ finance_id: "a1", amount: 400000 }, { finance_id: "a2", amount: 210000 }]);
    expect(top.unallocated).toBe(0);
  });
  it("이름이 달라도 금액이 딱 맞는 미수금은 낮은 순위 후보로 보인다", () => {
    const c = suggestMatches({ amount: 610000, depositorName: "최영필" }, list);
    expect(c.find((x) => x.customerId === "c2")?.score).toBe(25);
  });
  it("지역 괄호가 붙은 고객 이름도 같은 사람으로 본다", () => {
    expect(normalizePersonName("(도암)김창용")).toBe("김창용");
  });
  it("미수금보다 많이 들어오면 남는 금액을 따로 알려준다", () => {
    const r = allocateDeposit(700000, list.filter((x) => x.customer_id === "c1"));
    expect(r.unallocated).toBe(90000);
  });
  it("관계없는 이름·금액은 후보에 넣지 않는다", () => {
    expect(suggestMatches({ amount: 12345, depositorName: "홍길동" }, list)).toEqual([]);
  });
});

describe("pickSmsText (전달 앱마다 다른 본문 칸)", () => {
  const sms = "[Web발신]\n농협 입금610,000원\n11/20 11:26 301-****-1052-31 최영필 잔액128,549,964원";
  it("흔한 칸 이름", () => {
    expect(pickSmsText({ msg: sms })).toBe(sms);
    expect(pickSmsText({ smsBody: sms, from: "15882100" })).toBe(sms);
  });
  it("모르는 칸·안쪽 칸이어도 「입금」이 든 글자를 찾는다", () => {
    expect(pickSmsText({ from: "15882100", payload: { sms_text: sms } })).toBe(sms);
    expect(pickSmsText({ data: [{ content2: "광고" }, { c: sms }] })).toBe(sms);
  });
  it("평문은 그대로, 비었으면 빈 글자", () => {
    expect(pickSmsText(sms)).toBe(sms);
    expect(pickSmsText({ from: "15882100" })).toBe("");
    expect(pickSmsText({ from: "x" }, `{"broken": "${sms}`)).toContain("입금");
  });
  it("줄바꿈이 그대로 들어가 깨진 JSON이어도 문자 본문만 꺼낸다", () => {
    const broken = `{"from":"15882100","text":"${sms}","sentStamp":1795400000000}`;
    expect(pickSmsText(broken)).toBe(sms);
    expect(pickSmsText({ from: "x" }, broken)).toBe(sms);
  });
  it("한글 SMS Forwarder 앱이 붙이는 「보낸사람」 줄은 입금자명으로 읽지 않는다", () => {
    const fwd = "보낸사람 : 15882100()\n농협 입금1원\n11/24 10:38 301-****-9230-21 마준혁\n잔액112,741,834원";
    const p = parseDepositSms(fwd, new Date("2026-11-24T01:40:00Z"));
    expect(p?.depositorName).toBe("마준혁");
    expect(p?.amount).toBe(1);
    expect(p?.balance).toBe(112741834);
    expect(pickSmsText({ text: fwd })).toBe(fwd);
  });
  it("전달 앱 기록을 여러 건 붙여넣으면 「보낸사람」 줄마다 나눈다", () => {
    const two = "보낸사람 : 15882100()\n농협 입금1원\n11/24 10:38 301-****-9230-21 마준혁\n잔액5원\n보낸사람 : 15882100()\n농협 입금2원\n11/24 10:39 301-****-9230-21 홍길동\n잔액7원";
    expect(splitSmsBatch(two).map((t) => parseDepositSms(t, new Date("2026-11-24T02:00:00Z"))?.depositorName)).toEqual(["마준혁", "홍길동"]);
  });
});
