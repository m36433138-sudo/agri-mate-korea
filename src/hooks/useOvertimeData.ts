import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

const TECHNICIANS = ["유호상", "마성수", "김영일", "이재현", "이동진", "주희"] as const;
export type TechnicianName = (typeof TECHNICIANS)[number];
export { TECHNICIANS };

export interface DailyRecord {
  date: string;
  startTime: string;
  endTime: string;
  morningOT: string;
  afternoonOT: string;
  dailyTotal: string;
  dailyTotalMinutes: number;
}

export interface MonthlySummary {
  month: string; // "1월"~"12월" or "합계"
  y2025: string;
  y2026: string;
  yearTotal: string;
  y2025Minutes: number;
  y2026Minutes: number;
  yearTotalMinutes: number;
}

export interface TechnicianData {
  name: TechnicianName;
  dailyRecords: DailyRecord[];
  monthlySummary: MonthlySummary[];
  totals: MonthlySummary | null;
  currentMonthSummary: MonthlySummary | null;
}

export function timeToMinutes(t: string | undefined | null): number {
  if (!t || !t.trim()) return 0;
  const cleaned = t.trim();
  const parts = cleaned.split(":");
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function minutesToTime(totalMin: number): string {
  if (totalMin <= 0) return "0:00";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function getCurrentMonthLabel(): string {
  const now = new Date();
  return `${now.getMonth() + 1}월`;
}

async function fetchTechnicianData(name: TechnicianName): Promise<TechnicianData> {
  const { data, error } = await supabase.functions.invoke("google-sheets", {
    body: { tab: name },
  });
  if (error) throw new Error(error.message || "Failed to fetch overtime data");
  if (data?.error) throw new Error(data.error);

  const rows: string[][] = data?.values || [];
  const dailyRecords: DailyRecord[] = [];
  const monthlySummary: MonthlySummary[] = [];
  let totals: MonthlySummary | null = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const colA = (row[0] || "").trim();
    const colH = (row[7] || "").trim();

    // Parse daily records (left table A:F)
    if (colA && colA !== "날짜" && /\d/.test(colA)) {
      dailyRecords.push({
        date: colA,
        startTime: (row[1] || "").trim(),
        endTime: (row[2] || "").trim(),
        morningOT: (row[3] || "").trim(),
        afternoonOT: (row[4] || "").trim(),
        dailyTotal: (row[5] || "").trim(),
        dailyTotalMinutes: timeToMinutes(row[5]),
      });
    }

    // Parse monthly summary (right table H:K)
    if (colH && (colH.endsWith("월") || colH === "합계")) {
      const entry: MonthlySummary = {
        month: colH,
        y2025: (row[8] || "").trim(),
        y2026: (row[9] || "").trim(),
        yearTotal: (row[10] || "").trim(),
        y2025Minutes: timeToMinutes(row[8]),
        y2026Minutes: timeToMinutes(row[9]),
        yearTotalMinutes: timeToMinutes(row[10]),
      };
      if (colH === "합계") {
        totals = entry;
      } else {
        monthlySummary.push(entry);
      }
    }
  }

  const currentMonthLabel = getCurrentMonthLabel();
  const currentMonthSummary = monthlySummary.find((s) => s.month === currentMonthLabel) || null;

  return { name, dailyRecords, monthlySummary, totals, currentMonthSummary };
}

function formatNow() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const date = `${month}-${day}`;
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const time = `${hours}:${minutes}:00`;
  return { date, time };
}

export async function clockIn(techName: TechnicianName) {
  const { date, time } = formatNow();
  const { data, error } = await supabase.functions.invoke("google-sheets", {
    body: { action: "clockIn", techName, date, time },
  });
  if (error) throw new Error(error.message || "출근 기록 실패");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function clockOut(techName: TechnicianName) {
  const { date, time } = formatNow();
  const { data, error } = await supabase.functions.invoke("google-sheets", {
    body: { action: "clockOut", techName, date, time },
  });
  if (error) throw new Error(error.message || "퇴근 기록 실패");
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useOvertimeData() {
  const queryClient = useQueryClient();

  const queries = TECHNICIANS.map((name) => {
    return useQuery({
      queryKey: ["overtime", name],
      queryFn: () => fetchTechnicianData(name),
      staleTime: 5 * 60 * 1000,
      retry: 1,
    });
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["overtime"] });
  }, [queryClient]);

  const clockInMutation = useMutation({
    mutationFn: (techName: TechnicianName) => clockIn(techName),
    onSuccess: () => refresh(),
  });

  const clockOutMutation = useMutation({
    mutationFn: (techName: TechnicianName) => clockOut(techName),
    onSuccess: () => refresh(),
  });

  const allData = queries.map((q) => q.data).filter(Boolean) as TechnicianData[];
  const isLoading = queries.some((q) => q.isLoading);
  const lastUpdated = queries.some((q) => q.data) ? new Date() : null;

  return { queries, allData, isLoading, lastUpdated, refresh, TECHNICIANS, clockInMutation, clockOutMutation };
}
