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

import { describe, it, expect, afterAll } from "vitest";
import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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
async function probe(role: "admin" | "employee" | "customer", topic: string, timeoutMs = 6000): Promise<"subscribed" | "blocked"> {
  const client = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  allClients.push(client);
  const email = creds.users[role].email;
  const { error } = await client.auth.signInWithPassword({ email, password: creds.password });
  if (error) throw new Error(`login ${email}: ${error.message}`);

  return await new Promise<"subscribed" | "blocked">((resolve) => {
    let settled = false;
    const finish = (r: "subscribed" | "blocked") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => finish("blocked"), timeoutMs);

    const ch: RealtimeChannel = client.channel(topic, {
      config: { private: true, broadcast: { self: false } },
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") finish("subscribed");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") finish("blocked");
    });
  });
}

afterAll(async () => {
  await Promise.all(allClients.map(async (c) => {
    try { await c.removeAllChannels(); } catch { /* noop */ }
    try { await c.auth.signOut(); } catch { /* noop */ }
  }));
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
