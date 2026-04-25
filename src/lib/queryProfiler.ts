/**
 * 쿼리 실행 시간 + 응답 크기를 측정해 콘솔에 표 형태로 출력.
 * 페이지가 마운트되어 있는 동안 누적 통계를 보여준다.
 *
 * 사용법:
 *   const data = await measureQuery("machines-stats", () =>
 *     supabase.from("machines").select("...")
 *   );
 *
 * 콘솔 명령:
 *   __queryProfiler.print()  // 누적 통계 표
 *   __queryProfiler.reset()  // 초기화
 */

type Stat = {
  label: string;
  durationMs: number;
  bytes: number;
  rows: number;
  at: string;
};

const stats: Stat[] = [];

function approxByteSize(value: unknown): number {
  if (value == null) return 0;
  try {
    // JSON 직렬화 길이를 byte 근사치로 사용 (ASCII 가정 + 한글은 ~3배)
    const s = JSON.stringify(value);
    return new Blob([s]).size;
  } catch {
    return 0;
  }
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function colorForMs(ms: number): string {
  if (ms < 200) return "color:#10b981"; // green
  if (ms < 600) return "color:#f59e0b"; // amber
  return "color:#ef4444;font-weight:bold"; // red
}

export async function measureQuery<R extends { data: any; error: any; count?: number | null }>(
  label: string,
  fn: () => PromiseLike<R>
): Promise<R> {
  const t0 = performance.now();
  const result = await fn();
  const dur = performance.now() - t0;

  const data = result.data;
  const bytes = approxByteSize(data);
  const rows = Array.isArray(data) ? data.length : data ? 1 : 0;

  const entry: Stat = {
    label,
    durationMs: Math.round(dur),
    bytes,
    rows,
    at: new Date().toLocaleTimeString(),
  };
  stats.push(entry);

  // eslint-disable-next-line no-console
  console.log(
    `%c[query] ${label.padEnd(20)} %c${entry.durationMs}ms%c · ${formatBytes(bytes)} · ${rows} rows`,
    "color:#6b7280",
    colorForMs(dur),
    "color:#9ca3af"
  );

  return result;
}

function print() {
  if (stats.length === 0) {
    console.log("[queryProfiler] 측정된 쿼리가 없습니다.");
    return;
  }
  // 라벨별 집계
  const grouped = new Map<string, { calls: number; totalMs: number; totalBytes: number; maxMs: number }>();
  stats.forEach((s) => {
    const g = grouped.get(s.label) ?? { calls: 0, totalMs: 0, totalBytes: 0, maxMs: 0 };
    g.calls += 1;
    g.totalMs += s.durationMs;
    g.totalBytes += s.bytes;
    g.maxMs = Math.max(g.maxMs, s.durationMs);
    grouped.set(s.label, g);
  });

  const rows = Array.from(grouped.entries())
    .map(([label, g]) => ({
      쿼리: label,
      "호출수": g.calls,
      "평균(ms)": Math.round(g.totalMs / g.calls),
      "최대(ms)": g.maxMs,
      "총합(ms)": g.totalMs,
      "평균크기": formatBytes(Math.round(g.totalBytes / g.calls)),
    }))
    .sort((a, b) => b["총합(ms)"] - a["총합(ms)"]);

  // eslint-disable-next-line no-console
  console.table(rows);
}

function reset() {
  stats.length = 0;
  console.log("[queryProfiler] 통계 초기화 완료");
}

// 브라우저 콘솔에서 접근 가능
if (typeof window !== "undefined") {
  (window as any).__queryProfiler = { print, reset, stats };
}

export const queryProfiler = { print, reset, stats };
