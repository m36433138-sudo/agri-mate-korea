/**
 * 서버 기능(Edge Function)이 오류 상태로 끝났을 때, 본문에 담긴 안내 문구
 * (예: 「AI 크레딧이 부족합니다…」)를 꺼낸다. 없으면 기본 오류 메시지.
 */
export async function functionErrorMessage(error: unknown, fallback = "처리하지 못했습니다."): Promise<string> {
  const ctx = (error as { context?: { json?: () => Promise<any> } } | null)?.context;
  try {
    const body = typeof ctx?.json === "function" ? await ctx.json() : null;
    if (body && typeof body.error === "string" && body.error) return body.error;
  } catch { /* 본문 없음 */ }
  return error instanceof Error && error.message ? error.message : fallback;
}
