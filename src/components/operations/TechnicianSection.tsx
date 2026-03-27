import { useMemo } from "react";
import { SheetRow, getStatus, getTechnicianColor } from "@/types/operations";
import { OpsStatusBadge } from "./StatusBadgeOps";

interface Props {
  data: SheetRow[];
}

export function TechnicianSection({ data }: Props) {
  const groups = useMemo(() => {
    const active = data;
    const map = new Map<string, SheetRow[]>();
    active.forEach(row => {
      const key = row.수리기사 || "미배정";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [data]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground">기사별 담당 현황</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map(([name, rows]) => {
          const color = getTechnicianColor(name);
          const 수리중 = rows.filter(r => getStatus(r) === "수리중").length;
          const 출고대기 = rows.filter(r => getStatus(r) === "출고대기").length;
          const 입고대기 = rows.filter(r => getStatus(r) === "입고대기").length;
          return (
            <div key={name} className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: color }}>
                  {name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {입고대기 > 0 && `입고대기 ${입고대기}건 `}
                    {수리중 > 0 && `수리중 ${수리중}건 `}
                    {출고대기 > 0 && `출고대기 ${출고대기}건`}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {rows.slice(0, 6).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <OpsStatusBadge status={getStatus(r)} />
                    <span className="font-medium truncate">{r.손님성명}</span>
                    <span className="text-muted-foreground text-xs truncate">{r.기계}</span>
                  </div>
                ))}
                {rows.length > 6 && <p className="text-xs text-muted-foreground">외 {rows.length - 6}건...</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
