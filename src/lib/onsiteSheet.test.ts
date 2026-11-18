import { describe, it, expect } from "vitest";
import { buildOnsiteValues, parseOnsiteRows } from "./onsiteSheet";

const header = ["분류 ", "업무 분류", "우선순위", "요구 날짜  ", "손님 ", "전화번호", "Column 15", "주소", "에러  혹은 요구사항 ", "기계", "기계 품목", "출장기사", "완료날짜"];
const row = ["50시간 A/S", "강진", "한가할 때", "내년에", "김정균", "010-9261-3103", "", "대구면 백사1길 72", "엔진오일", "트랙터", "YT470", "이재현", ""];

describe("출장 탭", () => {
  it("reads customer, phone, request and machine from the 출장 columns", () => {
    const { rows } = parseOnsiteRows([header, row]);
    expect(rows[0]).toMatchObject({ 진행사항: "50시간 A/S", 지점: "강진", 손님성함: "김정균", 전화번호: "010-9261-3103", 내역: "엔진오일", 기계: "트랙터", 품목: "YT470", 출장기사: "이재현", _rowIndex: 2 });
  });
  it("editing keeps priority and request date untouched", () => {
    const { layout } = parseOnsiteRows([header, row]);
    const out = buildOnsiteValues(layout, { detail: "엔진오일 교환 완료", status: "완료" }, row);
    expect(out[2]).toBe("한가할 때");
    expect(out[3]).toBe("내년에");
    expect(out[8]).toBe("엔진오일 교환 완료");
    expect(out[0]).toBe("완료");
  });
  it("new row puts the name in the 손님 column, not column B", () => {
    const { layout } = parseOnsiteRows([header]);
    const out = buildOnsiteValues(layout, { name: "홍길동" });
    expect(out[4]).toBe("홍길동");
    expect(out[1]).toBe("");
  });
});
