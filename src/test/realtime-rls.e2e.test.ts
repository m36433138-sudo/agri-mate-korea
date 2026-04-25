// @vitest-environment node
/**
 * Realtime RLS 실제 WebSocket e2e 테스트
 *
 * 사전 준비:
 *   bun scripts/seed-e2e-users.mjs <password>
 *   → /dev-server/.test-credentials.json 생성 (admin/employee/customer 자격증명 + 매핑)
 *
 * supabase/migrations/20260425015025_*.sql 의 realtime.messages 정책을
 * 실제 ws 구독으로 검증한다. private:true 채널만이 RLS 게이팅을 받는다.
 */

import { describe, it, expect, afterAll, afterEach } from "vitest";
import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// ── 진단 리포트 수집 ─────────────────────────────────────────
type ProbeOutcome = "subscribed" | "blocked";
type FailureCause =
  | "LOGIN_FAILED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED"
  | "UNEXPECTED_SUBSCRIBE"
  | "UNEXPECTED_BLOCK"
  | "MISSING_CREDENTIALS"
  | "UNKNOWN";

interface DiagnosticEntry {
  testName: string;
  role: "admin" | "employee" | "customer";
  topic: string;
  expected: ProbeOutcome;
  actual: ProbeOutcome | "error";
  passed: boolean;
  cause?: FailureCause;
  detail?: string;
  nextAction?: string;
  durationMs: number;
  timestamp: string;
}

const REPORT_DIR = path.resolve(process.cwd(), "public");
const REPORTS_SUBDIR = path.join(REPORT_DIR, "realtime-rls-reports");
const LATEST_PATH = path.join(REPORT_DIR, "realtime-rls-report.json");
const INDEX_PATH = path.join(REPORTS_SUBDIR, "index.json");
const MAX_REPORTS = 20;
const diagnostics: DiagnosticEntry[] = [];
let currentExpected: ProbeOutcome = "subscribed";
let currentRole: "admin" | "employee" | "customer" = "admin";
let currentTopic = "";
let lastFailureCause: FailureCause | undefined;
let lastFailureDetail: string | undefined;

const NEXT_ACTIONS: Record<FailureCause, string> = {
  LOGIN_FAILED: "scripts/seed-e2e-users.mjs로 테스트 계정을 다시 시드하거나 .test-credentials.json의 password 값을 확인하세요.",
  CHANNEL_ERROR: "supabase/migrations 의 realtime.messages RLS 정책이 해당 topic 패턴을 허용하는지 확인하세요. (의도된 차단이라면 expected를 'blocked'로 수정)",
  TIMED_OUT: "Supabase Realtime 서버 응답이 지연되었습니다. cloud_status로 백엔드 상태를 점검하고 네트워크/방화벽을 확인하세요.",
  CLOSED: "WebSocket이 조기 종료되었습니다. anon key 만료 또는 JWT 갱신 실패를 확인하세요.",
  UNEXPECTED_SUBSCRIBE: "차단되어야 할 topic이 허용되었습니다. RLS 정책에 누락된 거부 규칙이 있는지 점검하세요. (보안 위험)",
  UNEXPECTED_BLOCK: "허용되어야 할 topic이 차단되었습니다. RLS 정책의 USING 절과 사용자 role/employee_id 매핑을 확인하세요.",
  MISSING_CREDENTIALS: ".test-credentials.json이 없습니다. `bun scripts/seed-e2e-users.mjs <password>` 실행 후 재시도하세요.",
  UNKNOWN: "원인 불명. ws 라이브러리 버전·네트워크·Supabase 프로젝트 상태(cloud_status)를 순서대로 점검하세요.",
};

import WebSocket from "ws";
// @ts-expect-error global polyfill — supabase-js realtime은 글로벌 WebSocket을 사용
globalThis.WebSocket = WebSocket;

const CREDS_PATH = path.resolve(process.cwd(), ".test-credentials.json");
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

const hasCreds = fs.existsSync(CREDS_PATH) && SUPABASE_URL && ANON_KEY;
const d = hasCreds ? describe : describe.skip;

interface Creds {
  password: string;
  users: {
    admin: { email: string; authUid: string };
    employee: { email: string; authUid: string; employeeId: string };
    customer: { email: string; authUid: string };
  };
}

const creds: Creds = hasCreds ? JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) : ({} as Creds);
const allClients: SupabaseClient[] = [];

/**
 * 매 호출마다 새 client를 생성·로그인 후 단 하나의 private 채널만 구독한다.
 * → 채널 간 race condition 제거, 각 케이스가 깨끗한 상태에서 평가된다.
 */
async function probe(role: "admin" | "employee" | "customer", topic: string, timeoutMs = 10_000): Promise<"subscribed" | "blocked"> {
  currentRole = role;
  currentTopic = topic;
  lastFailureCause = undefined;
  lastFailureDetail = undefined;

  const client = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  allClients.push(client);
  const email = creds.users[role].email;
  const { error } = await client.auth.signInWithPassword({ email, password: creds.password });
  if (error) {
    lastFailureCause = "LOGIN_FAILED";
    lastFailureDetail = `${email}: ${error.message}`;
    throw new Error(`login ${email}: ${error.message}`);
  }

  return await new Promise<"subscribed" | "blocked">((resolve) => {
    let settled = false;
    const finish = (r: "subscribed" | "blocked") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => {
      lastFailureCause = "TIMED_OUT";
      lastFailureDetail = `${timeoutMs}ms 내 SUBSCRIBED 응답 없음`;
      finish("blocked");
    }, timeoutMs);

    const ch: RealtimeChannel = client.channel(topic, {
      config: { private: true, broadcast: { self: false } },
    });
    ch.subscribe((status, err) => {
      if (status === "SUBSCRIBED") finish("subscribed");
      else if (status === "CHANNEL_ERROR") {
        lastFailureCause = "CHANNEL_ERROR";
        lastFailureDetail = err?.message ?? "RLS 정책에 의해 거부됨";
        finish("blocked");
      } else if (status === "TIMED_OUT") {
        lastFailureCause = "TIMED_OUT";
        lastFailureDetail = err?.message ?? "Phoenix join timeout";
        finish("blocked");
      } else if (status === "CLOSED") {
        lastFailureCause = "CLOSED";
        lastFailureDetail = err?.message ?? "WebSocket closed before join";
        finish("blocked");
      }
    });
  });
}

function recordResult(testName: string, expected: ProbeOutcome, actual: ProbeOutcome | "error", durationMs: number, errorMessage?: string) {
  const passed = actual === expected;
  let cause: FailureCause | undefined;
  let detail: string | undefined = lastFailureDetail;

  if (!passed) {
    if (lastFailureCause) {
      cause = lastFailureCause;
    } else if (actual === "subscribed" && expected === "blocked") {
      cause = "UNEXPECTED_SUBSCRIBE";
      detail = "RLS가 통과시켰지만 차단되어야 하는 topic";
    } else if (actual === "blocked" && expected === "subscribed") {
      cause = "UNEXPECTED_BLOCK";
      detail = detail ?? "이유 없이 차단됨 (cause 미캡처)";
    } else if (actual === "error") {
      cause = "UNKNOWN";
      detail = errorMessage;
    } else {
      cause = "UNKNOWN";
    }
  }

  diagnostics.push({
    testName,
    role: currentRole,
    topic: currentTopic,
    expected,
    actual,
    passed,
    cause,
    detail,
    nextAction: cause ? NEXT_ACTIONS[cause] : undefined,
    durationMs,
    timestamp: new Date().toISOString(),
  });
}

afterEach((ctx) => {
  const name = ctx.task.name;
  // expected 추론: 테스트명에 "차단"이 있으면 blocked, 그 외엔 subscribed
  const expected: ProbeOutcome = /차단/.test(name) ? "blocked" : "subscribed";
  const state = ctx.task.result?.state;
  const duration = ctx.task.result?.duration ?? 0;
  if (state === "pass") {
    recordResult(name, expected, expected, duration);
  } else {
    const actual: ProbeOutcome | "error" = expected === "subscribed" ? "blocked" : "subscribed";
    const err = ctx.task.result?.errors?.[0]?.message;
    recordResult(name, expected, actual, duration, err);
  }
});

afterAll(async () => {
  await Promise.all(allClients.map(async (c) => {
    try { await c.removeAllChannels(); } catch { /* noop */ }
    try { await c.auth.signOut(); } catch { /* noop */ }
  }));

  // 리포트 기록
  if (!hasCreds) {
    diagnostics.push({
      testName: "(setup)",
      role: "admin",
      topic: "-",
      expected: "subscribed",
      actual: "error",
      passed: false,
      cause: "MISSING_CREDENTIALS",
      detail: ".test-credentials.json 또는 SUPABASE 환경변수 누락",
      nextAction: NEXT_ACTIONS.MISSING_CREDENTIALS,
      durationMs: 0,
      timestamp: new Date().toISOString(),
    });
  }
  try {
    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
    const report = {
      generatedAt: new Date().toISOString(),
      total: diagnostics.length,
      passed: diagnostics.filter((d) => d.passed).length,
      failed: diagnostics.filter((d) => !d.passed).length,
      entries: diagnostics,
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    // eslint-disable-next-line no-console
    console.log(`\n[e2e] 리포트 기록됨: ${REPORT_PATH}\n`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[e2e] 리포트 기록 실패:", e);
  }
});

d("Realtime RLS — 실제 WebSocket 구독 (e2e)", () => {
  // ── employee ────────────────────────────────────────────────
  it("employee: operations:장흥 구독 성공", async () => {
    expect(await probe("employee", "operations:장흥")).toBe("subscribed");
  }, 20_000);

  it("employee: repairs:any 구독 성공", async () => {
    expect(await probe("employee", "repairs:any")).toBe("subscribed");
  }, 20_000);

  it("employee: inventory:장흥 구독 성공", async () => {
    expect(await probe("employee", "inventory:장흥")).toBe("subscribed");
  }, 20_000);

  it("employee: 본인 attendance:<empId> 구독 성공", async () => {
    expect(await probe("employee", `attendance:${creds.users.employee.employeeId}`)).toBe("subscribed");
  }, 20_000);

  it("employee: 본인 user:<uid> 구독 성공", async () => {
    expect(await probe("employee", `user:${creds.users.employee.authUid}`)).toBe("subscribed");
  }, 20_000);

  it("employee: 타인 user:<admin uid> 구독 차단", async () => {
    expect(await probe("employee", `user:${creds.users.admin.authUid}`)).toBe("blocked");
  }, 20_000);

  it("employee: 타인 attendance 구독 차단", async () => {
    expect(await probe("employee", "attendance:00000000-0000-0000-0000-000000000000")).toBe("blocked");
  }, 20_000);

  it("employee: 내부 토픽 user_roles:all 구독 차단", async () => {
    expect(await probe("employee", "user_roles:all")).toBe("blocked");
  }, 20_000);

  it("employee: 임의 random_topic 구독 차단", async () => {
    expect(await probe("employee", "random_topic")).toBe("blocked");
  }, 20_000);

  // ── customer ────────────────────────────────────────────────
  it("customer: 본인 user:<uid> 구독 성공", async () => {
    expect(await probe("customer", `user:${creds.users.customer.authUid}`)).toBe("subscribed");
  }, 20_000);

  it("customer: 업무 토픽 operations:장흥 구독 차단", async () => {
    expect(await probe("customer", "operations:장흥")).toBe("blocked");
  }, 20_000);

  it("customer: 타인 user:<employee uid> 구독 차단", async () => {
    expect(await probe("customer", `user:${creds.users.employee.authUid}`)).toBe("blocked");
  }, 20_000);

  it("customer: attendance 토픽 구독 차단", async () => {
    expect(await probe("customer", `attendance:${creds.users.employee.employeeId}`)).toBe("blocked");
  }, 20_000);

  // ── admin ───────────────────────────────────────────────────
  it("admin: 임의 토픽 anything:goes 구독 성공", async () => {
    expect(await probe("admin", "anything:goes")).toBe("subscribed");
  }, 20_000);

  it("admin: 타인 user:<customer uid> 구독 성공", async () => {
    expect(await probe("admin", `user:${creds.users.customer.authUid}`)).toBe("subscribed");
  }, 20_000);

  it("admin: 타인 attendance 구독 성공", async () => {
    expect(await probe("admin", `attendance:${creds.users.employee.employeeId}`)).toBe("subscribed");
  }, 20_000);
});
