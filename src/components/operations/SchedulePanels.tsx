import { useMemo } from "react";
import { SheetRow, getStatus, formatSheetDate, parseSheetDate } from "@/types/operations";
import { TechBadge } from "./StatusBadgeOps";
import { AlertTriangle, AlertCircle } from "lucide-react";

interface Props {
  data: SheetRow[];
}

export function SchedulePanels({ data }: Props) {
  const now = Date.now();

  const incoming = useMemo(() =>
    data.filter(r => !r.입고일 && getStatus(r) === "입고대기")
      .sort((a, b) => (a.수리시작일 || "9").localeCompare(b.수리시작일 || "9")),
    [data]
  );

  const outgoing = useMemo(() =>
    data.filter(r => r.수리완료일 && !r.출고일 && getStatus(r) === "출고대기")
      .sort((a, b) => (a.수리완료일 || "9").localeCompare(b.수리완료일 || "9")),
    [data]
  );

  const isOldDate = (dateStr: string, daysThreshold: number) => {
    const d = parseSheetDate(dateStr);
    if (!d) return false;
    return (now - d.getTime()) / (1000 * 60 * 60 * 24) > daysThreshold;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border p-4 space-y-3">
        <h4 className="font-bold text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          입고 예정 <span className="text-sm font-normal text-muted-foreground">({incoming.length}건)</span>
        </h4>
        <div className="space-y-2 max-h-[320px] overflow-auto">
          {incoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">입고 예정 없음</p>
          ) : incoming.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg hover:bg-muted/30">
              {isOldDate(r.수리시작일, 7) && <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.손님성명}</span>
                  <span className="text-muted-foreground text-xs">{r.기계}</span>
                </div>
                {r.수리기사 && <TechBadge name={r.수리기사} />}
                {r.손님요구사항 && <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{r.손님요구사항}</p>}
                {r.수리시작일 && <p className="text-xs text-muted-foreground mt-0.5">수리시작: {formatSheetDate(r.수리시작일)}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h4 className="font-bold text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          출고 대기 <span className="text-sm font-normal text-muted-foreground">({outgoing.length}건)</span>
        </h4>
        <div className="space-y-2 max-h-[320px] overflow-auto">
          {outgoing.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">출고 대기 없음</p>
          ) : outgoing.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg hover:bg-muted/30">
              {isOldDate(r.수리완료일, 3) && <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.손님성명}</span>
                  <span className="text-muted-foreground text-xs">{r.기계}</span>
                </div>
                {r.수리기사 && <TechBadge name={r.수리기사} />}
                {r.수리완료일 && <p className="text-xs text-muted-foreground mt-0.5">수리완료: {formatSheetDate(r.수리완료일)}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
