export type TrendRow = {
  repair_date: string | null;
  labor_cost: number | null;
  total_cost: number | null;
  technician: string | null;
};

export type MonthPoint = { key: string; label: string; total: number; labor: number; parts: number; count: number };

const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

/** 오늘이 든 달을 끝으로 최근 n개월의 "YYYY-MM" 목록 (오래된 달 먼저) */
export function recentMonths(today: Date, n = 12): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push(monthKey(d.getFullYear(), d.getMonth()));
  }
  return out;
}

/** n개월 전 1일 (조회 시작일) */
export function trendStart(today: Date, n = 12): string {
  return `${recentMonths(today, n)[0]}-01`;
}

/** 전월 대비 변화율(%). 지난달이 0이면 비교하지 않는다(null). */
export function changePct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** 수리 이력 → 월별 매출(공임/부품)·건수, 이번 달/지난달 요약, 이번 달 기사별 건수 */
export function buildRepairTrend(rows: TrendRow[], today: Date, n = 12) {
  const keys = recentMonths(today, n);
  const byKey = new Map<string, MonthPoint>(
    keys.map((k) => [k, { key: k, label: `${Number(k.slice(5))}월`, total: 0, labor: 0, parts: 0, count: 0 }]),
  );
  const thisKey = keys[keys.length - 1];
  const lastKey = keys[keys.length - 2];
  const day = today.getDate();
  // 이번 달은 아직 진행 중이라, 지난달도 1일~오늘 날짜까지만 모아 같은 기간끼리 비교한다
  const lastToDate = { total: 0, count: 0 };
  const techCount = new Map<string, number>();

  for (const r of rows) {
    const k = r.repair_date?.slice(0, 7);
    const p = k ? byKey.get(k) : undefined;
    if (!p) continue;
    const total = Math.max(0, Number(r.total_cost) || 0);
    const labor = Math.min(total || Infinity, Math.max(0, Number(r.labor_cost) || 0));
    p.count += 1;
    p.total += Math.max(total, labor);
    p.labor += labor;
    p.parts += Math.max(0, total - labor);
    if (k === lastKey && Number(r.repair_date!.slice(8, 10)) <= day) {
      lastToDate.total += Math.max(total, labor);
      lastToDate.count += 1;
    }
    if (k === thisKey) {
      const t = r.technician?.trim() || "미지정";
      techCount.set(t, (techCount.get(t) ?? 0) + 1);
    }
  }

  const months = keys.map((k) => byKey.get(k)!);
  const cur = months[months.length - 1];
  const prev = months[months.length - 2] ?? { total: 0, count: 0 };
  const technicians = [...techCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));

  return {
    months,
    thisMonth: { total: cur.total, count: cur.count },
    lastMonth: { total: prev.total, count: prev.count },
    lastMonthToDate: lastToDate,
    totalChange: changePct(cur.total, lastToDate.total),
    countChange: changePct(cur.count, lastToDate.count),
    technicians,
  };
}
