import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { repairNotice } from "./repairNotify";

describe("수리 완료 알림 글", () => {
  it("고객·기계, 내용, 담당, 금액·미수", () => {
    const n = repairNotice({ id: "r1", customer: "김영수", machine: "YT5113A", content: "엔진오일  교환\n필터 교체", technician: "김영일", total: 185000, receivable: 50000 });
    expect(n.title).toBe("수리 완료 · 김영수 · YT5113A");
    expect(n.body).toBe("엔진오일 교환 필터 교체\n담당 김영일 · 185,000원 · 미수 50,000원");
    expect(n).toMatchObject({ url: "/repairs", tag: "repair-r1" });
  });
  it("무상은 금액 대신 무상(서비스)", () => {
    expect(repairNotice({ id: "r2", content: "점검", total: 0, free: true }).body).toBe("점검\n무상(서비스)");
  });
});
