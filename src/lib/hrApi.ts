import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/components/partReceipts/receiptData";
import { sendPush } from "@/lib/appPush";
import { fmtDays, type LeaveAdjustment, type LeaveKind, type LeaveRequest } from "@/lib/hr";

/** 인사카드 (관리자는 전원, 직원은 RLS 로 자기 것만) */
export type HrEmployee = {
  id: string; name: string; team: string | null; position: string | null; employment_type: string | null; branch: string | null;
  join_date: string | null; birth_date: string | null; phone: string | null; emergency_contact: string | null; address: string | null;
  notes: string | null; user_id: string | null; is_active: boolean | null; resigned_at: string | null;
};
export const HR_FIELDS = "id, name, team, position, employment_type, branch, join_date, birth_date, phone, emergency_contact, address, notes, user_id, is_active, resigned_at";

export function useHrEmployees(includeResigned = false) {
  return useQuery({
    queryKey: ["hr-employees", includeResigned],
    staleTime: 60_000,
    queryFn: async () => {
      let q = db.from("employees").select(HR_FIELDS).order("team").order("name");
      if (!includeResigned) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as HrEmployee[];
    },
  });
}

/** 휴가 신청 목록 (관리자: 전원, 직원: 자기 것) */
export function useLeaveRequests(employeeId?: string | null) {
  return useQuery({
    queryKey: ["leave-requests", employeeId ?? "all"],
    staleTime: 30_000,
    queryFn: async () => {
      let q = db.from("leave_requests").select("*").order("start_date", { ascending: false }).limit(1000);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: LeaveRequest) => ({ ...r, days: Number(r.days) })) as LeaveRequest[];
    },
  });
}

export function useLeaveAdjustments(employeeId?: string | null) {
  return useQuery({
    queryKey: ["leave-adjustments", employeeId ?? "all"],
    staleTime: 60_000,
    queryFn: async () => {
      let q = db.from("leave_adjustments").select("*").order("created_at", { ascending: false });
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: LeaveAdjustment) => ({ ...r, days: Number(r.days) })) as LeaveAdjustment[];
    },
  });
}

export type CalendarLeave = { id: string; employee_id: string; name: string; team: string | null; kind: LeaveKind; start_date: string; end_date: string; days: number; status: "신청" | "승인" };

/** 휴가 달력: 직원 누구나 이름·날짜만 (사유는 안 보인다) */
export function useLeaveCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ["leave-calendar", from, to],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.rpc("leave_calendar", { _from: from, _to: to });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: CalendarLeave) => ({ ...r, days: Number(r.days) })) as CalendarLeave[];
    },
  });
}

const period = (s: string, e: string) => (s === e ? s.slice(5).replace("-", "/") : `${s.slice(5).replace("-", "/")}~${e.slice(5).replace("-", "/")}`);

function invalidateLeave(qc: ReturnType<typeof useQueryClient>) {
  ["leave-requests", "leave-calendar", "leave-adjustments"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

/** 휴가 신청 (employeeId 를 주면 관리자가 대신 등록 → 바로 승인) */
export function useRequestLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { kind: LeaveKind; start: string; end: string; reason: string; employeeId?: string; myName?: string }) => {
      const { error } = await db.rpc("request_leave", { _kind: v.kind, _start: v.start, _end: v.end, _reason: v.reason || null, _employee_id: v.employeeId ?? null });
      if (error) throw new Error(error.message);
      if (!v.employeeId) {
        void sendPush("general", { admins: true }, {
          title: `휴가 신청 · ${v.myName ?? "직원"}`,
          body: `${v.kind} ${period(v.start, v.end)}${v.reason ? ` · ${v.reason.slice(0, 60)}` : ""}`,
          url: "/hr?tab=leave", tag: `leave-${v.start}`,
        });
      }
    },
    onSuccess: () => invalidateLeave(qc),
  });
}

export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("cancel_leave", { _id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateLeave(qc),
  });
}

/** 승인/반려 → 신청한 사람에게 알림 */
export function useDecideLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { req: LeaveRequest; approve: boolean; note?: string; employeeName?: string }) => {
      const { error } = await db.rpc("decide_leave", { _id: v.req.id, _approve: v.approve, _note: v.note || null });
      if (error) throw new Error(error.message);
      if (v.employeeName) {
        void sendPush("general", { employee_names: [v.employeeName] }, {
          title: v.approve ? "휴가가 승인됐어요" : "휴가가 반려됐어요",
          body: `${v.req.kind} ${period(v.req.start_date, v.req.end_date)} (${fmtDays(v.req.days)})${v.note ? ` · ${v.note}` : ""}`,
          url: "/leave", tag: `leave-${v.req.id}`,
        });
      }
    },
    onSuccess: () => invalidateLeave(qc),
  });
}

export function useSaveEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<HrEmployee> & { id: string }) => {
      const { id, ...rest } = v;
      const clean = Object.fromEntries(Object.entries(rest).map(([k, x]) => [k, typeof x === "string" ? (x.trim() || null) : x]));
      const { error } = await db.from("employees").update(clean).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-employees"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

export function useAddAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { employee_id: string; period_start: string; days: number; reason: string }) => {
      const { error } = await db.from("leave_adjustments").insert(v);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateLeave(qc),
  });
}

export function useDeleteAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("leave_adjustments").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateLeave(qc),
  });
}

/** 한 달 출퇴근 기록 (관리자: 전원) */
export function useMonthAttendance(month: string) {
  return useQuery({
    queryKey: ["hr-month-attendance", month],
    staleTime: 60_000,
    queryFn: async () => {
      const [y, m] = month.split("-").map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const { data, error } = await supabase.from("attendance_records")
        .select("employee_id, date, clock_in, clock_out, overtime_minutes, break_minutes")
        .gte("date", `${month}-01`).lte("date", `${month}-${String(last).padStart(2, "0")}`).limit(5000);
      if (error) throw new Error(error.message);
      return (data ?? []) as { employee_id: string; date: string; clock_in: string | null; clock_out: string | null; overtime_minutes: number | null; break_minutes: number | null }[];
    },
  });
}
