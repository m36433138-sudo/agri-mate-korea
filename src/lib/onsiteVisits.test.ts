import { describe, expect, it } from "vitest";
import { parseOnsiteRows, buildOnsiteValues, onsiteLayout } from "./onsiteSheet";
import { findSheetRow, parseLooseDate, sheetClassOf, sheetRowToVisit, statusFromSheet, visitToSheetFields } from "./onsiteVisits";
import { geocodeQueries, nearestOrder, navLinks } from "./onsiteRoute";

const header = ["분류 ", "업무 분류", "우선순위", "요구 날짜  ", "손님 ", "전화번호", "Column 15", "주소", "에러  혹은 요구사항 ", "기계", "기계 품목", "출장기사", "완료날짜"];
const row = ["50시간 A/S", "강진", "한가할 때", "내년에", "김정균", "010-9261-3103", "메모", "대구면 백사1길 72", "엔진오일", "트랙터", "YT470", "이재현", ""];

describe("시트 「분류」 ↔ 상태", () => {
  it("분류 칸의 상태와 종류를 나눈다", () => {
    expect(statusFromSheet("50시간 A/S", "")).toEqual({ status: "대기", category: "50시간 A/S" });
    expect(statusFromSheet("출장", "")).toEqual({ status: "대기", category: "출장" });
    expect(statusFromSheet("진행중", "")).toEqual({ status: "진행중", category: null });
    expect(statusFromSheet("완료", "")).toEqual({ status: "완료", category: null });
    expect(statusFromSheet("출장", "11/20")).toEqual({ status: "완료", category: "출장" });
  });
  it("대기는 종류를, 나머지는 상태 이름을 시트에 쓴다", () => {
    expect(sheetClassOf({ status: "대기", category: "50시간 A/S" })).toBe("50시간 A/S");
    expect(sheetClassOf({ status: "대기", category: null })).toBe("출장");
    expect(sheetClassOf({ status: "완료", category: "출장" })).toBe("완료");
  });
  it("날짜 읽기", () => {
    const now = new Date("2026-11-24T00:00:00");
    expect(parseLooseDate("2026.11.3", now)).toBe("2026-11-03");
    expect(parseLooseDate("11/25", now)).toBe("2026-11-25");
    expect(parseLooseDate("내년에", now)).toBeNull();
  });
});

describe("시트 줄 ↔ 앱 기록", () => {
  const { rows, layout } = parseOnsiteRows([header, row]);
  it("우선순위·요구 날짜까지 읽는다", () => {
    expect(sheetRowToVisit(rows[0])).toMatchObject({
      sheet_row: 2, status: "대기", category: "50시간 A/S", branch: "강진", priority: "한가할 때", requested: "내년에",
      customer_name: "김정균", address: "대구면 백사1길 72", technician: "이재현", completed_on: null,
    });
  });
  it("완료로 바꿔 백업해도 시트에만 있는 칸(Column 15)은 그대로", () => {
    const v = { ...sheetRowToVisit(rows[0]), status: "완료" as const, completed_on: "2026-11-24" };
    const out = buildOnsiteValues(layout, visitToSheetFields(v), row);
    expect(out[0]).toBe("완료");
    expect(out[6]).toBe("메모");
    expect(out[12]).toBe("2026-11-24");
    expect(out[2]).toBe("한가할 때");
  });
  it("누가 시트에서 줄을 지워 번호가 밀려도 이름+전화로 다시 찾는다", () => {
    const moved = parseOnsiteRows([header, ["출장", "장흥", "", "", "다른분", "010-1111-2222"], row]).rows;
    const hit = findSheetRow(moved, { sheet_row: 2, customer_name: "김정균", phone: "01092613103" });
    expect(hit?._rowIndex).toBe(3);
    expect(findSheetRow(moved, { sheet_row: 2, customer_name: "없는분", phone: null })).toBeUndefined();
  });
  it("이름을 고친 뒤에도 예전 이름으로 원래 줄을 찾는다", () => {
    expect(findSheetRow(rows, { sheet_row: 2, customer_name: "김정균 님", phone: null }, "김정균")?._rowIndex).toBe(2);
  });
  it("완료날짜 칸 위치를 머리글로 찾는다", () => {
    expect(onsiteLayout(header)).toMatchObject({ priority: 2, requested: 3, completed: 12 });
  });
});

describe("길찾기", () => {
  it("시·군이 없는 주소는 지점의 군을 붙이고 점점 넓혀 찾는다", () => {
    expect(geocodeQueries("대구면 백사1길 72", "강진")).toEqual([
      "전라남도 강진군 대구면 백사1길 72", "전라남도 강진군 대구면 백사1길", "전라남도 강진군 대구면",
    ]);
    expect(geocodeQueries("전남 보성군 회천면 율포리 123-4", "장흥")[0]).toBe("전남 보성군 회천면 율포리 123-4");
    expect(geocodeQueries("", "장흥")).toEqual([]);
  });
  it("가까운 곳부터 차례로, 좌표 없는 곳은 뺀다", () => {
    const from = { lat: 34.68, lng: 126.9 };
    const order = nearestOrder(from, [
      { id: "far", lat: 34.5, lng: 126.6 }, { id: "near", lat: 34.69, lng: 126.91 }, { id: "none", lat: null as unknown as number },
    ]);
    expect(order.map((o) => (o.stop as { id: string }).id)).toEqual(["near", "far"]);
  });
  it("좌표가 없으면 주소 검색 링크", () => {
    expect(navLinks({ customer_name: "김정균", address: "대구면 백사1길 72", lat: null, lng: null }).kakao).toContain("/link/search/");
    expect(navLinks({ customer_name: "김정균", address: null, lat: 34.6, lng: 126.7 }).kakao).toBe("https://map.kakao.com/link/to/%EA%B9%80%EC%A0%95%EA%B7%A0,34.6,126.7");
  });
});
