import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { dbToSheetRow, sheetRowToDb } from "./operationRows";

describe("작업현황판 앱 원본 변환", () => {
  it("완료 표시는 앱 기록과 시트 TRUE 사이에서 그대로 오간다", () => {
    const row = dbToSheetRow({ branch: "강진", row_index: 7, customer_name: "홍길동", is_completed: true });
    expect(row.전체완료).toBe("TRUE");
    expect(sheetRowToDb(row).is_completed).toBe(true);
  });
  it("시트에서 가져올 때 앱 전용 S/N은 덮어쓰지 않는다", () => {
    const row = dbToSheetRow({ branch: "장흥", row_index: 3, customer_name: "김", serial_number: "SN1" });
    expect("serial_number" in sheetRowToDb(row)).toBe(false);
  });
});
