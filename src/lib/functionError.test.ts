import { describe, expect, it } from "vitest";
import { functionErrorMessage } from "./functionError";
import { aiErrorMessage, aiStatusOf } from "../../supabase/functions/_shared/aiError";

describe("AI 크레딧 부족 안내", () => {
  it("AI SDK가 감싼 오류 안의 402를 찾는다", () => {
    const wrapped = Object.assign(new Error("No output generated"), { cause: { statusCode: 402, message: "Payment Required" } });
    expect(aiStatusOf(wrapped)).toBe(402);
  });
  it("402는 크레딧 부족 문구로 바뀐다", () => {
    expect(aiErrorMessage(402)).toContain("AI 크레딧이 부족합니다");
  });
  it("화면은 서버가 보낸 안내 문구를 그대로 보여준다", async () => {
    const err = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: { json: async () => ({ error: "AI 크레딧이 부족합니다." }) },
    });
    expect(await functionErrorMessage(err)).toBe("AI 크레딧이 부족합니다.");
  });
});
