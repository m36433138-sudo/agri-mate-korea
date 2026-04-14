import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

// ── Korean public holidays 2025–2026 ──
const HOLIDAYS = new Set([
  // 2025
  "2025-01-01","2025-01-28","2025-01-29","2025-01-30",
  "2025-03-01","2025-05-01","2025-05-05","2025-05-06",
  "2025-06-06","2025-08-15","2025-10-03","2025-10-05",
  "2025-10-06","2025-10-07","2025-10-08","2025-10-09",
  "2025-12-25",
  // 2026
  "2026-01-01","2026-02-16","2026-02-17","2026-02-18",
  "2026-03-01","2026-03-02","2026-05-01","2026-05-05",
  "2026-05-24","2026-06-06","2026-08-15","2026-09-24",
  "2026-09-25","2026-09-26","2026-10-03","2026-10-09",
  "2026-12-25",
]);

export function isHolidayOrWeekend(dateStr: string): boolean {
  if (HOLIDAYS.has(dateStr)) return true;
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Calculate overtime minutes from clock_in / clock_out timestamps */
export function calcOvertime(
  clockIn: string,
  clockOut: string,
  isHoliday: boolean
): { total: number; morning: number; afternoon: number } {
  const inD = new Date(clockIn);
  const outD = new Date(clockOut);
  const totalWorkMs = outD.getTime() - inD.getTime();
  if (totalWorkMs <= 0) return { total: 0, morning: 0, afternoon: 0 };

  const totalWorkMin = Math.floor(totalWorkMs / 60000);

  if (isHoliday) {
    return { total: totalWorkMin, morning: 0, afternoon: totalWorkMin };
  }

  // 평일: 08:30 이전 = 오전초과, 18:00 이후 = 오후초과
  const dateStr = clockIn.slice(0, 10);
  const morningStart = new Date(`${dateStr}T08:30:00+09:00`);
  const eveningEnd = new Date(`${dateStr}T18:00:00+09:00`);

  let morning = 0;
  if (inD < morningStart) {
    morning = Math.floor((Math.min(morningStart.getTime(), outD.getTime()) - inD.getTime()) / 60000);
  }

  let afternoon = 0;
  if (outD > eveningEnd) {
    afternoon = Math.floor((outD.getTime() - Math.max(eveningEnd.getTime(), inD.getTime())) / 60000);
  }

  // 총 근무 8시간 미만이면 초과근무 0
  if (totalWorkMin < 480) {
    return { total: 0, morning: 0, afternoon: 0 };
  }

  const total = morning + afternoon;
  return { total, morning, afternoon };
}

export function minutesToHM(min: number): string {
  if (min <= 0) return "0:00";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  overtime_minutes: number;
  morning_ot_minutes: number;
  afternoon_ot_minutes: number;
  is_holiday: boolean;
  is_modified: boolean;
  modification_reason: string | null;
  is_settled: boolean;
  latitude_in: number | null;
  longitude_in: number | null;
  latitude_out: number | null;
  longitude_out: number | null;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  name: string;
  user_id: string | null;
  team: string | null;
  overtime_hourly_rate: number | null;
}

export interface OvertimeSettlement {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  total_overtime_minutes: number;
  hourly_rate: number;
  bonus_amount: number;
  total_payment: number;
  settled_by: string | null;
  notes: string | null;
  created_at: string;
}

function getKSTDateStr(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function getKSTNow(): string {
  return new Date().toISOString();
}

async function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export function useAttendance() {
  const qc = useQueryClient();

  // Fetch all employees (기사팀)
  const employeesQuery = useQuery({
    queryKey: ["attendance-employees"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("employees")
        .select("id, name, user_id, team, overtime_hourly_rate")
        .eq("team", "기사팀")
        .order("name");
      if (error) throw error;
      return data as Employee[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch attendance records (unsettled)
  const recordsQuery = useQuery({
    queryKey: ["attendance-records"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("attendance_records")
        .select("*")
        .eq("is_settled", false)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
    staleTime: 60 * 1000,
  });

  // Fetch all records for summaries
  const allRecordsQuery = useQuery({
    queryKey: ["attendance-records-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("attendance_records")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const settlementsQuery = useQuery({
    queryKey: ["overtime-settlements"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("overtime_settlements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OvertimeSettlement[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["attendance-records"] });
    qc.invalidateQueries({ queryKey: ["attendance-records-all"] });
    qc.invalidateQueries({ queryKey: ["overtime-settlements"] });
  }, [qc]);

  // Clock In
  const clockInMutation = useMutation({
    mutationFn: async ({ employeeId, isModified, modReason }: {
      employeeId: string;
      isModified?: boolean;
      modReason?: string;
    }) => {
      const dateStr = getKSTDateStr();
      const holiday = isHolidayOrWeekend(dateStr);
      const pos = await getPosition();
      const now = getKSTNow();

      const { data, error } = await (supabase as any)
        .from("attendance_records")
        .upsert({
          employee_id: employeeId,
          date: dateStr,
          clock_in: now,
          is_holiday: holiday,
          is_modified: isModified || false,
          modification_reason: modReason || null,
          latitude_in: pos?.lat || null,
          longitude_in: pos?.lng || null,
        }, { onConflict: "employee_id,date" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => refresh(),
  });

  // Clock Out
  const clockOutMutation = useMutation({
    mutationFn: async ({ employeeId, isModified, modReason }: {
      employeeId: string;
      isModified?: boolean;
      modReason?: string;
    }) => {
      const dateStr = getKSTDateStr();
      const now = getKSTNow();
      const pos = await getPosition();

      // Get existing record
      const { data: existing } = await (supabase as any)
        .from("attendance_records")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("date", dateStr)
        .single();

      if (!existing?.clock_in) {
        throw new Error("출근 기록이 없습니다. 먼저 출근을 기록해주세요.");
      }

      const holiday = isHolidayOrWeekend(dateStr);
      const ot = calcOvertime(existing.clock_in, now, holiday);

      const { data, error } = await (supabase as any)
        .from("attendance_records")
        .update({
          clock_out: now,
          overtime_minutes: ot.total,
          morning_ot_minutes: ot.morning,
          afternoon_ot_minutes: ot.afternoon,
          is_modified: isModified || existing.is_modified,
          modification_reason: modReason || existing.modification_reason,
          latitude_out: pos?.lat || null,
          longitude_out: pos?.lng || null,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data as AttendanceRecord;
    },
    onSuccess: () => refresh(),
  });

  // Settle overtime
  const settleMutation = useMutation({
    mutationFn: async ({
      employeeId, periodStart, periodEnd, hourlyRate, bonus, settledBy, notes,
    }: {
      employeeId: string;
      periodStart: string;
      periodEnd: string;
      hourlyRate: number;
      bonus: number;
      settledBy: string;
      notes?: string;
    }) => {
      // Get records in period
      const { data: records } = await (supabase as any)
        .from("attendance_records")
        .select("id, overtime_minutes")
        .eq("employee_id", employeeId)
        .eq("is_settled", false)
        .gte("date", periodStart)
        .lte("date", periodEnd);

      const totalMin = (records || []).reduce((s: number, r: any) => s + (r.overtime_minutes || 0), 0);
      const totalPayment = Math.round((totalMin / 60) * hourlyRate) + bonus;

      // Create settlement
      const { error: sErr } = await (supabase as any)
        .from("overtime_settlements")
        .insert({
          employee_id: employeeId,
          period_start: periodStart,
          period_end: periodEnd,
          total_overtime_minutes: totalMin,
          hourly_rate: hourlyRate,
          bonus_amount: bonus,
          total_payment: totalPayment,
          settled_by: settledBy,
          notes,
        });
      if (sErr) throw sErr;

      // Mark records as settled
      const ids = (records || []).map((r: any) => r.id);
      if (ids.length > 0) {
        const { error: uErr } = await (supabase as any)
          .from("attendance_records")
          .update({ is_settled: true })
          .in("id", ids);
        if (uErr) throw uErr;
      }

      return { totalMin, totalPayment };
    },
    onSuccess: () => refresh(),
  });

  return {
    employees: employeesQuery.data || [],
    records: recordsQuery.data || [],
    allRecords: allRecordsQuery.data || [],
    settlements: settlementsQuery.data || [],
    isLoading: employeesQuery.isLoading || recordsQuery.isLoading,
    refresh,
    clockInMutation,
    clockOutMutation,
    settleMutation,
  };
}
