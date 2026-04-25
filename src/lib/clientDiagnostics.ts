/**
 * 클라이언트 오류/네트워크 실패 자동 수집기.
 * - window.onerror, unhandledrejection, console.error 가로채기
 * - fetch 실패(네트워크 에러 / HTTP 4xx,5xx) 가로채기
 * - 메모리 링버퍼(최대 200건) + localStorage 백업(최근 50건)
 * - subscribe()로 관리자 화면이 실시간 구독
 *
 * main.tsx에서 단 한 번 installClientDiagnostics() 호출.
 */

export type DiagEntryType = "error" | "promise" | "console" | "network";

export interface DiagEntry {
  id: string;
  type: DiagEntryType;
  timestamp: number;
  message: string;
  detail?: string;
  url?: string;
  status?: number;
  stack?: string;
}

const MAX_ENTRIES = 200;
const STORAGE_KEY = "client-diagnostics-v1";
const STORAGE_MAX = 50;

let entries: DiagEntry[] = [];
let installed = false;
const listeners = new Set<(list: DiagEntry[]) => void>();

function emit() {
  const snapshot = entries.slice();
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      // ignore
    }
  });
  // localStorage 백업 (최근 N건만)
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(-STORAGE_MAX))
    );
  } catch {
    // quota / private mode
  }
}

function push(entry: Omit<DiagEntry, "id" | "timestamp">) {
  const full: DiagEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  entries.push(full);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES);
  }
  emit();
}

function safeStringify(value: unknown): string {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function installClientDiagnostics() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // 이전 세션 백업 복원
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const restored = JSON.parse(raw) as DiagEntry[];
      if (Array.isArray(restored)) entries = restored.slice(-MAX_ENTRIES);
    }
  } catch {
    // ignore
  }

  // 1) 동기 오류
  window.addEventListener("error", (event) => {
    push({
      type: "error",
      message: event.message || "Unknown error",
      detail: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      stack: event.error?.stack,
    });
  });

  // 2) Promise rejection
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    push({
      type: "promise",
      message: reason instanceof Error ? reason.message : safeStringify(reason).slice(0, 300),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  // 3) console.error 가로채기 (원본은 그대로 호출)
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      push({
        type: "console",
        message: args.map(safeStringify).join(" ").slice(0, 1000),
      });
    } catch {
      // ignore
    }
    origError(...args);
  };

  // 4) fetch 가로채기 (네트워크 실패 + HTTP 에러)
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const url =
      typeof args[0] === "string"
        ? args[0]
        : args[0] instanceof URL
        ? args[0].toString()
        : (args[0] as Request).url;
    try {
      const res = await origFetch(...args);
      if (!res.ok) {
        push({
          type: "network",
          message: `HTTP ${res.status} ${res.statusText}`,
          url,
          status: res.status,
        });
      }
      return res;
    } catch (err) {
      push({
        type: "network",
        message: err instanceof Error ? err.message : "Network request failed",
        url,
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  };
}

export function getDiagEntries(): DiagEntry[] {
  return entries.slice();
}

export function clearDiagEntries() {
  entries = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  emit();
}

export function subscribeDiag(fn: (list: DiagEntry[]) => void): () => void {
  listeners.add(fn);
  fn(entries.slice());
  return () => {
    listeners.delete(fn);
  };
}
