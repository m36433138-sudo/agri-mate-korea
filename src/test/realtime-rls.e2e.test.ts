// @vitest-environment node
/**
 * Realtime RLS 실제 WebSocket e2e 테스트
 *
 * 사전 준비:
 *   bun scripts/seed-e2e-users.mjs <password>
 *   → /dev-server/.test-credentials.json 생성 (admin/employee/customer 자격증명 + 매핑)
 *
 * supabase/migrations/20260425015025_*.sql 의 realtime.messages 정책을
 * 실제 ws 구독으로 검증한다.
 *
 * 검증 매트릭스:
 *   - employee: operations:* 같은 업무 토픽 OK / 타인 user:<uid>·내부 토픽 BLOCK
 *   - customer: 본인 user:<uid> OK / 모든 내부·업무 토픽 BLOCK
 *   - admin: 임의 토픽 OK
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// supabase-js의 realtime은 브라우저 WebSocket을 가정 — Node 환경에서는 ws 폴리필 필요
import WebSocket from "ws";
// @ts-expect-error global polyfill
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

let creds: Creds;
const clients: SupabaseClient[] = [];

function newClient() {
  const c = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.push(c);
  return c;
}

async function login(email: string): Promise<SupabaseClient> {
  const c = newClient();
  const { error } = await c.auth.signInWithPassword({ email, password: creds.password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

/**
 * 채널 구독을 시도하고 SUBSCRIBED / CHANNEL_ERROR / 타임아웃 결과를 반환한다.
 * RLS로 차단된 토픽은 CHANNEL_ERROR 또는 타임아웃으로 떨어진다.
 */
async function trySubscribe(
  client: SupabaseClient,
  topic: string,
  timeoutMs = 5000,
): Promise<"subscribed" | "blocked"> {
  return new Promise((resolve) => {
    let settled = false;
    // private:true → realtime.messages RLS가 토픽 단위 인가를 강제한다.
    // 일반(public) 채널은 RLS를 우회하므로 정책 검증에는 반드시 private 모드를 써야 한다.
    const channel: RealtimeChannel = client.channel(topic, {
      config: { private: true, broadcast: { self: false } },
    });

    const finish = (r: "subscribed" | "blocked") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { client.removeChannel(channel); } catch { /* noop */ }
      resolve(r);
    };

    const timer = setTimeout(() => finish("blocked"), timeoutMs);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") finish("subscribed");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") finish("blocked");
    });
  });
}

if (hasCreds) {
  creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8"));
}

d("Realtime RLS — 실제 WebSocket 구독 (e2e)", () => {
  let adminClient: SupabaseClient;
  let employeeClient: SupabaseClient;
  let customerClient: SupabaseClient;

  beforeAll(async () => {
    [adminClient, employeeClient, customerClient] = await Promise.all([
      login(creds.users.admin.email),
      login(creds.users.employee.email),
      login(creds.users.customer.email),
    ]);
  }, 30_000);

  afterAll(async () => {
    await Promise.all(clients.map(async (c) => {
      try { await c.removeAllChannels(); } catch { /* noop */ }
      try { await c.auth.signOut(); } catch { /* noop */ }
    }));
  });

  // ── employee ────────────────────────────────────────────────
  it("employee: operations:장흥 구독 성공", async () => {
    expect(await trySubscribe(employeeClient, "operations:장흥")).toBe("subscribed");
  }, 15_000);

  it("employee: repairs:any 구독 성공", async () => {
    expect(await trySubscribe(employeeClient, "repairs:any")).toBe("subscribed");
  }, 15_000);

  it("employee: inventory:장흥 구독 성공", async () => {
    expect(await trySubscribe(employeeClient, "inventory:장흥")).toBe("subscribed");
  }, 15_000);

  it("employee: 본인 attendance:<empId> 구독 성공", async () => {
    expect(await trySubscribe(employeeClient, `attendance:${creds.users.employee.employeeId}`)).toBe("subscribed");
  }, 15_000);

  it("employee: 본인 user:<uid> 구독 성공", async () => {
    expect(await trySubscribe(employeeClient, `user:${creds.users.employee.authUid}`)).toBe("subscribed");
  }, 15_000);

  it("employee: 타인 user:<admin uid> 구독 차단", async () => {
    expect(await trySubscribe(employeeClient, `user:${creds.users.admin.authUid}`)).toBe("blocked");
  }, 15_000);

  it("employee: 타인 attendance:<other> 구독 차단", async () => {
    expect(await trySubscribe(employeeClient, "attendance:00000000-0000-0000-0000-000000000000")).toBe("blocked");
  }, 15_000);

  it("employee: 정의되지 않은 내부 토픽 user_roles:all 구독 차단", async () => {
    expect(await trySubscribe(employeeClient, "user_roles:all")).toBe("blocked");
  }, 15_000);

  it("employee: 임의 random_topic 구독 차단", async () => {
    expect(await trySubscribe(employeeClient, "random_topic")).toBe("blocked");
  }, 15_000);

  // ── customer ────────────────────────────────────────────────
  it("customer: 본인 user:<uid> 구독 성공", async () => {
    expect(await trySubscribe(customerClient, `user:${creds.users.customer.authUid}`)).toBe("subscribed");
  }, 15_000);

  it("customer: 업무 토픽 operations:장흥 구독 차단", async () => {
    expect(await trySubscribe(customerClient, "operations:장흥")).toBe("blocked");
  }, 15_000);

  it("customer: 타인 user:<employee uid> 구독 차단", async () => {
    expect(await trySubscribe(customerClient, `user:${creds.users.employee.authUid}`)).toBe("blocked");
  }, 15_000);

  it("customer: attendance 토픽 구독 차단", async () => {
    expect(await trySubscribe(customerClient, `attendance:${creds.users.employee.employeeId}`)).toBe("blocked");
  }, 15_000);

  // ── admin ───────────────────────────────────────────────────
  it("admin: 임의 토픽 anything:goes 구독 성공", async () => {
    expect(await trySubscribe(adminClient, "anything:goes")).toBe("subscribed");
  }, 15_000);

  it("admin: 타인 user:<customer uid> 구독 성공", async () => {
    expect(await trySubscribe(adminClient, `user:${creds.users.customer.authUid}`)).toBe("subscribed");
  }, 15_000);

  it("admin: 타인 attendance 구독 성공", async () => {
    expect(await trySubscribe(adminClient, `attendance:${creds.users.employee.employeeId}`)).toBe("subscribed");
  }, 15_000);
});
