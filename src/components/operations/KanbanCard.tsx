import { SheetRow, getStatus, OperationStatus, getTechnicianColor, getMachineTypeColor, formatSheetDate, parseSheetDate } from "@/types/operations";
import { AlertTriangle, CircleAlert, User, Wrench, ClipboardList } from "lucide-react";

interface Props {
  row: SheetRow;
  color: string;
  onMarkComplete: (row: SheetRow) => void;
}

export function KanbanCard({ row, color, onMarkComplete }: Props) {
  const status = getStatus(row);
  const machineColor = getMachineTypeColor(row.기계);
  const now = Date.now();

  // Warning: 입고대기 > 7 days since repair_start
  const showEntryWarning = status === "입고대기" && row.수리시작일 && (() => {
    const d = parseSheetDate(row.수리시작일);
    return d && (now - d.getTime()) / (1000 * 60 * 60 * 24) > 7;
  })();

  // Warning: 출고대기 > 3 days since repair_done
  const showExitWarning = status === "출고대기" && row.수리완료일 && (() => {
    const d = parseSheetDate(row.수리완료일);
    return d && (now - d.getTime()) / (1000 * 60 * 60 * 24) > 3;
  })();

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-border/60 p-3.5 space-y-2 transition-shadow hover:shadow-md"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      {/* Top row: machine type badge + model + warnings */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${machineColor.bg} ${machineColor.text}`}>
          {row.기계 || "기타"}
        </span>
        {row.품목 && <span className="text-xs text-muted-foreground">{row.품목}</span>}
        {showEntryWarning && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 ml-auto" />}
        {showExitWarning && <CircleAlert className="h-3.5 w-3.5 text-red-500 ml-auto" />}
      </div>

      {/* Customer name */}
      <div className="flex items-center gap-1.5">
        <User className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-base font-bold text-foreground truncate">{row.손님성명}</span>
      </div>

      {/* Technician */}
      {row.수리기사 && (
        <div className="flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: getTechnicianColor(row.수리기사) }}
          >
            {row.수리기사}
          </span>
        </div>
      )}

      {/* Request */}
      {row.손님요구사항 && (
        <div className="flex items-start gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground line-clamp-2">{row.손님요구사항}</p>
        </div>
      )}

      {/* Dates + location */}
      <div className="border-t border-border/40 pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex gap-3">
          {row.입고일 && <span>입고 {formatSheetDate(row.입고일)}</span>}
          {row.수리완료일 && <span>완료 {formatSheetDate(row.수리완료일)}</span>}
        </div>
        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
          row._branch === "장흥" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-violet-50 text-violet-700 ring-violet-600/20"
        }`}>
          {row._branch}
        </span>
      </div>

      {/* Complete button */}
      <button
        onClick={() => onMarkComplete(row)}
        className="w-full mt-1 text-xs font-medium py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
      >
        완료처리
      </button>
    </div>
  );
}
