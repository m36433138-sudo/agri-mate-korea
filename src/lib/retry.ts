import type { PostgrestError, AuthError } from "@supabase/supabase-js";

export type TransientErrorReason =
  | "timeout"
  | "gateway"
  | "network"
  | "rate_limit"
  | null;

/**
 * 백엔드/게이트웨이 계열 일시적 오류 여부와 원인을 판별합니다.
 * 인증 실패(잘못된 비밀번호 등) 같은 논리 오류는 재시도하지 않습니다.
 */
export function classifyTransient(err: unknown): TransientErrorReason {
  if (!err) return null;
  const anyErr = err as any;
  const status: number | undefined = anyErr.status ?? anyErr.statusCode;
  const code: string | undefined = anyErr.code;
  const msg = String(anyErr.message ?? anyErr).toLowerCase();

  if (status === 504 || msg.includes("504") || msg.includes("timeout") || msg.includes("timed out")) return "timeout";
  if (status === 502 || status === 503 || msg.includes("502") || msg.includes("503") || msg.includes("bad gateway") || msg.includes("service unavailable")) return "gateway";
  if (status === 429 || msg.includes("rate limit")) return "rate_limit";
  if (
    code === "network_error" ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed")
  ) return "network";
  return null;
}

export function describeReason(reason: TransientErrorReason): string {
  switch (reason) {
    case "timeout": return "서버 응답 시간 초과(504)입니다.";
    case "gateway": return "백엔드 게이트웨이가 일시적으로 응답하지 않습니다.";
    case "network": return "네트워크 연결이 불안정합니다.";
    case "rate_limit": return "요청이 너무 잦습니다. 잠시 후 다시 시도됩니다.";
    default: return "일시적인 오류가 발생했습니다.";
  }
}

export interface RetryOptions {
  retries?: number;      // 재시도 횟수 (기본 3)
  baseDelayMs?: number;  // 첫 재시도 지연 (기본 800ms)
  maxDelayMs?: number;   // 재시도 지연 상한 (기본 5s)
  onAttempt?: (attempt: number, reason: TransientErrorReason) => void;
}

/**
 * fn을 실행하다가 일시적(네트워크/게이트웨이/타임아웃) 오류가 나면 지수 백오프로 재시도합니다.
 * fn은 { data, error } 형태(Supabase)나 값을 그대로 반환할 수 있습니다.
 * - Supabase 스타일 결과에서 error가 transient면 재시도.
 * - throw 방식 오류도 동일하게 처리.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 800;
  const max = opts.maxDelayMs ?? 5000;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let transientReason: TransientErrorReason = null;
    try {
      const result = await fn();
      // Supabase 스타일 { data, error } 감지
      const maybe = result as unknown as { error?: PostgrestError | AuthError | null };
      if (maybe && typeof maybe === "object" && "error" in maybe && maybe.error) {
        transientReason = classifyTransient(maybe.error);
        if (!transientReason) return result;
      } else {
        return result;
      }
    } catch (e) {
      transientReason = classifyTransient(e);
      if (!transientReason) throw e;
    }

    if (attempt >= retries) {
      // 최종 실패: 원본 결과/에러를 그대로 다시 돌려주기 위해 fn을 한 번 더 호출하지 않고 throw
      const err = new Error(describeReason(transientReason)) as Error & { reason: TransientErrorReason };
      err.reason = transientReason;
      throw err;
    }
    attempt += 1;
    opts.onAttempt?.(attempt, transientReason);
    const delay = Math.min(base * 2 ** (attempt - 1), max);
    await new Promise((r) => setTimeout(r, delay));
  }
}
