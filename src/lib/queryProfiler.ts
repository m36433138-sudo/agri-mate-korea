/**
 * 쿼리 실행 시간 + 응답 크기를 측정해 콘솔에 표 형태로 출력.
 * localStorage에 주기적으로 저장하여 페이지 새로고침/배포 후에도 유지.
 *
 * 사용법:
 *   const data = await measureQuery("machines-stats", () =>
 *     supabase.from("machines").select("...")
 *   );
 *
 * 콘솔 명령:
 *   __queryProfiler.print()         // 현재 세션 누적 통계 표
 *   __queryProfiler.printSlowest()  // 최근 배포 후 가장 느린 쿼리 요약
 *   __queryProfiler.reset()         // 현재 세션 초기화
 *   __queryProfiler.clearStorage()  // 저장된 모든 이력 삭제
 */

type Stat = {
  label: string;
  durationMs: number;
  bytes: number;
  rows: number;
  at: string;          // 표시용 시간
  ts: number;          // epoch ms (저장/필터용)
  buildId?: string;    // 배포 식별자
};

const STORAGE_KEY = "lovable:queryProfiler:v1";
const MAX_STORED = 500;            // 너무 커지지 않도록 cap
const FLUSH_INTERVAL_MS = 10_000;  // 10초마다 localStorage flush

// 빌드 식별자: 페이지 로드 시점에 한 번 결정 (배포 시 새 번들로 갱신됨)
const BUILD_ID =
  typeof document !== "undefined"
    ? `${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`
    : "ssr";

const stats: Stat[] = [];
let pendingFlush: Stat[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function approxByteSize(value: unknown): number {
  if (value == null) return 0;
  try {
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
  if (ms < 200) return "color:#10b981";
  if (ms < 600) return "color:#f59e0b";
  return "color:#ef4444;font-weight:bold";
}

function loadStored(): Stat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStored(all: Stat[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = all.slice(-MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable
  }
}

function flush() {
  if (pendingFlush.length === 0) return;
  const stored = loadStored();
  const merged = [...stored, ...pendingFlush];
  saveStored(merged);
  pendingFlush = [];
}

function ensureFlushTimer() {
  if (flushTimer || typeof window === "undefined") return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
  // 페이지 떠나기 전에 마지막 flush
  window.addEventListener("beforeunload", flush);
  window.addEventListener("pagehide", flush);
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
  const now = Date.now();

  const entry: Stat = {
    label,
    durationMs: Math.round(dur),
    bytes,
    rows,
    at: new Date(now).toLocaleTimeString(),
    ts: now,
    buildId: BUILD_ID,
  };
  stats.push(entry);
  pendingFlush.push(entry);
  ensureFlushTimer();

  // eslint-disable-next-line no-console
  console.log(
    `%c[query] ${label.padEnd(20)} %c${entry.durationMs}ms%c · ${formatBytes(bytes)} · ${rows} rows`,
    "color:#6b7280",
    colorForMs(dur),
    "color:#9ca3af"
  );

  return result;
}

function aggregate(source: Stat[]) {
  const grouped = new Map<string, { calls: number; totalMs: number; totalBytes: number; maxMs: number }>();
  source.forEach((s) => {
    const g = grouped.get(s.label) ?? { calls: 0, totalMs: 0, totalBytes: 0, maxMs: 0 };
    g.calls += 1;
    g.totalMs += s.durationMs;
    g.totalBytes += s.bytes;
    g.maxMs = Math.max(g.maxMs, s.durationMs);
    grouped.set(s.label, g);
  });
  return Array.from(grouped.entries())
    .map(([label, g]) => ({
      쿼리: label,
      "호출수": g.calls,
      "평균(ms)": Math.round(g.totalMs / g.calls),
      "최대(ms)": g.maxMs,
      "총합(ms)": g.totalMs,
      "평균크기": formatBytes(Math.round(g.totalBytes / g.calls)),
    }))
    .sort((a, b) => b["평균(ms)"] - a["평균(ms)"]);
}

function print() {
  if (stats.length === 0) {
    console.log("[queryProfiler] 현재 세션에서 측정된 쿼리가 없습니다.");
    return;
  }
  console.log(`%c[queryProfiler] 현재 세션 (build: ${BUILD_ID})`, "color:#3b82f6;font-weight:bold");
  // eslint-disable-next-line no-console
  console.table(aggregate(stats));
}

/**
 * 최근 배포(현재 BUILD_ID)에 해당하는 저장된 쿼리만 집계.
 * localStorage에 저장된 이력 + 현재 세션 데이터 합산.
 */
function printSlowest(topN = 5) {
  flush(); // 최신 데이터 반영
  const stored = loadStored();
  const currentBuild = stored.filter((s) => s.buildId === BUILD_ID);

  if (currentBuild.length === 0) {
    console.log(`[queryProfiler] 현재 배포(${BUILD_ID})에 저장된 쿼리가 없습니다.`);
    return;
  }

  const aggregated = aggregate(currentBuild);
  const slowest = aggregated.slice(0, topN);

  const since = new Date(Math.min(...currentBuild.map((s) => s.ts))).toLocaleString();
  console.log(
    `%c[queryProfiler] 🐌 최근 배포 후 가장 느린 쿼리 TOP ${topN}`,
    "color:#ef4444;font-weight:bold;font-size:13px"
  );
  console.log(
    `%c빌드: ${BUILD_ID} · 측정 시작: ${since} · 총 ${currentBuild.length}회 호출`,
    "color:#9ca3af;font-size:11px"
  );
  // eslint-disable-next-line no-console
  console.table(slowest);

  return slowest;
}

function reset() {
  stats.length = 0;
  console.log("[queryProfiler] 세션 통계 초기화 완료");
}

function clearStorage() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  pendingFlush = [];
  console.log("[queryProfiler] 저장된 모든 이력 삭제 완료");
}

if (typeof window !== "undefined") {
  (window as any).__queryProfiler = {
    print,
    printSlowest,
    reset,
    clearStorage,
    stats,
    buildId: BUILD_ID,
  };
}

export const queryProfiler = { print, printSlowest, reset, clearStorage, stats, buildId: BUILD_ID };
