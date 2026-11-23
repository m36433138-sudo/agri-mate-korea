/** AI 게이트웨이 오류에서 HTTP 상태를 찾는다 (AI SDK가 감싼 cause 포함) */
export function aiStatusOf(err: unknown): number | null {
  for (let e: any = err, i = 0; e && i < 5; e = e.cause, i++) {
    if (typeof e.statusCode === "number") return e.statusCode;
    if (typeof e.status === "number") return e.status;
    if (/payment required|not enough credits/i.test(String(e.message ?? ""))) return 402;
  }
  return null;
}

/** 크레딧 부족·요청 과다·차단은 직원이 알아볼 수 있는 말로 바꾼다. 그 외에는 null */
export function aiErrorMessage(status: number | null | undefined): string | null {
  if (status === 402) return "AI 크레딧이 부족합니다. 설정 → 요금제에서 충전 후 다시 시도해 주세요.";
  if (status === 429) return "AI 요청이 많아 잠시 후 다시 시도해 주세요.";
  if (status === 403) return "AI 사용이 막혀 있습니다. 관리자에게 문의해 주세요.";
  return null;
}
