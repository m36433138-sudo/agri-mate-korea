import { describe, it, expect } from "vitest";

/**
 * realtime.messages RLS 정책 시뮬레이터
 *
 * supabase/migrations/20260425015025_*.sql 의 정책을 그대로 미러링한다.
 * 실제 DB ws 연결 없이, 마이그레이션이 의도한 권한 매트릭스를 회귀 검증한다.
 *
 * 정책 요약:
 *  - admin: 모든 토픽 구독 가능
 *  - employee: 업무 토픽(operations:, repairs:, repair_logs:, repair_notes:,
 *              inventory:, parts:, machines:, sheet_assignments:, tasks:,
 *              customers:, vendors:) + 본인 attendance:<empId>, location:<empId>,
 *              user:<own auth uid>
 *  - customer: user:<own auth uid> 만
 */

type Role = "admin" | "employee" | "customer";

interface Ctx {
  role: Role;
  authUid: string;
  /** employees.id mapped to this auth user (employee 전용) */
  employeeId?: string;
}

const WORK_PREFIXES = [
  "operations:",
  "repairs:",
  "repair_logs:",
  "repair_notes:",
  "inventory:",
  "parts:",
  "machines:",
  "sheet_assignments:",
  "tasks:",
  "customers:",
  "vendors:",
];

function canSubscribe(ctx: Ctx, topic: string): boolean {
  if (ctx.role === "admin") return true;

  if (ctx.role === "employee") {
    if (WORK_PREFIXES.some((p) => topic.startsWith(p))) return true;
    if (ctx.employeeId && topic === `attendance:${ctx.employeeId}`) return true;
    if (ctx.employeeId && topic === `location:${ctx.employeeId}`) return true;
    if (topic === `user:${ctx.authUid}`) return true;
    return false;
  }

  if (ctx.role === "customer") {
    return topic === `user:${ctx.authUid}`;
  }

  return false;
}

const employee: Ctx = {
  role: "employee",
  authUid: "auth-emp-1",
  employeeId: "emp-1",
};
const otherEmployee: Ctx = {
  role: "employee",
  authUid: "auth-emp-2",
  employeeId: "emp-2",
};
const customer: Ctx = { role: "customer", authUid: "auth-cust-1" };
const admin: Ctx = { role: "admin", authUid: "auth-admin-1" };

describe("realtime.messages RLS — employee 업무 토픽 구독", () => {
  const allowedWorkTopics = [
    "operations:장흥",
    "repairs:abc",
    "repair_logs:42",
    "repair_notes:99",
    "inventory:장흥",
    "parts:all",
    "machines:abc",
    "sheet_assignments:장흥",
    "tasks:today",
    "customers:장흥",
    "vendors:all",
  ];

  it.each(allowedWorkTopics)("employee 는 %s 를 구독할 수 있다", (topic) => {
    expect(canSubscribe(employee, topic)).toBe(true);
  });

  it("employee 는 본인 attendance 토픽 구독 가능", () => {
    expect(canSubscribe(employee, "attendance:emp-1")).toBe(true);
  });

  it("employee 는 본인 location 토픽 구독 가능", () => {
    expect(canSubscribe(employee, "location:emp-1")).toBe(true);
  });

  it("employee 는 본인 user:<uid> 토픽 구독 가능", () => {
    expect(canSubscribe(employee, "user:auth-emp-1")).toBe(true);
  });
});

describe("realtime.messages RLS — employee 민감/타인 토픽 차단", () => {
  it("타 직원의 attendance 토픽 구독 불가", () => {
    expect(canSubscribe(employee, "attendance:emp-2")).toBe(false);
  });

  it("타 직원의 location 토픽 구독 불가", () => {
    expect(canSubscribe(employee, "location:emp-2")).toBe(false);
  });

  it("타인의 user:<uid> 토픽 구독 불가", () => {
    expect(canSubscribe(employee, "user:auth-emp-2")).toBe(false);
    expect(canSubscribe(otherEmployee, "user:auth-emp-1")).toBe(false);
  });

  it.each([
    "user_roles:all",
    "employee_permissions:emp-1",
    "profiles:all",
    "overtime_settlements:emp-2",
    "auth:internal",
    "admin:broadcast",
    "secrets:any",
    "random_topic",
    "",
  ])("내부/미정의 토픽 %s 구독 불가", (topic) => {
    expect(canSubscribe(employee, topic)).toBe(false);
  });
});

describe("realtime.messages RLS — customer 격리", () => {
  it("customer 는 본인 user 채널만 구독 가능", () => {
    expect(canSubscribe(customer, "user:auth-cust-1")).toBe(true);
  });

  it.each([
    "operations:장흥",
    "repairs:any",
    "inventory:any",
    "attendance:emp-1",
    "location:emp-1",
    "customers:장흥",
    "user:auth-emp-1",
    "user:auth-admin-1",
  ])("customer 는 내부/타인 토픽 %s 구독 불가", (topic) => {
    expect(canSubscribe(customer, topic)).toBe(false);
  });
});

describe("realtime.messages RLS — admin 전체 접근", () => {
  it.each([
    "operations:any",
    "attendance:emp-2",
    "location:emp-2",
    "user:auth-cust-1",
    "anything:goes",
  ])("admin 은 %s 구독 가능", (topic) => {
    expect(canSubscribe(admin, topic)).toBe(true);
  });
});
