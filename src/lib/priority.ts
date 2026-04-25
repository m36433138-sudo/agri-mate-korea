/**
 * 작업 우선순위 공통 유틸 (방문수리·작업현황판 공용)
 */
export type Priority = "긴급" | "높음" | "보통" | "낮음";

export const PRIORITIES: Priority[] = ["긴급", "높음", "보통", "낮음"];

export const PRIORITY_META: Record<
  Priority,
  {
    label: string;
    color: string; // hex
    border: string; // tailwind border-l hex utility class
    badge: string; // tailwind classes
    pulse: boolean;
    rank: number; // 정렬용 (작을수록 위)
  }
> = {
  긴급: {
    label: "긴급",
    color: "#dc2626",
    border: "",
    badge: "bg-red-500/15 text-red-400 ring-red-500/40",
    pulse: true,
    rank: 0,
  },
  높음: {
    label: "높음",
    color: "#f59e0b",
    border: "",
    badge: "bg-amber-500/15 text-amber-400 ring-amber-500/40",
    pulse: false,
    rank: 1,
  },
  보통: {
    label: "보통",
    color: "#64748b",
    border: "",
    badge: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
    pulse: false,
    rank: 2,
  },
  낮음: {
    label: "낮음",
    color: "#94a3b8",
    border: "",
    badge: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
    pulse: false,
    rank: 3,
  },
};

export function normalizePriority(v: unknown): Priority {
  const s = String(v ?? "").trim();
  if ((PRIORITIES as string[]).includes(s)) return s as Priority;
  return "보통";
}

export const TECHNICIANS = ["유호상", "마성수", "김영일", "이재현", "이동진", "주희로"] as const;
