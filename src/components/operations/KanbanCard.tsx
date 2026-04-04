import { SheetRow, getStatus, OperationStatus, getTechnicianColor, getMachineTypeColor, formatSheetDate, parseSheetDate } from "@/types/operations";
import { AlertTriangle, CircleAlert, User, Wrench, ClipboardList, Pencil, ArrowRight, Package, FileText } from "lucide-react";
import { RepairNote } from "@/hooks/useRepairNotes";

const STATUS_TRANSITIONS: Record<OperationStatus, { label: string; next: OperationStatus | "완료" } | null> = {
  입고대기: { label: "입고완료", next: "수리대기" },
  수리대기: { label: "수리시작", next: "수리중" },
  수리중: { label: "수리완료", next: "수리완료" },
  수리완료: { label: "출고대기로", next: "출고대기" },
  출고대기: { label: "출고완료", next: "완료" },
  보류: null,
};

const TRANSITION_COLORS: Record<string, string> = {
  입고완료: "text-yellow-700 border-yellow-300 hover:bg-yellow-50",
  수리시작: "text-blue-700 border-blue-300 hover:bg-blue-50",
  수리완료: "text-teal-700 border-teal-300 hover:bg-teal-50",
  "출고대기로": "text-green-700 border-green-300 hover:bg-green-50",
  출고완료: "text-emerald-700 border-emerald-300 hover:bg-emerald-50",
};

interface Props {
  row: SheetRow;
  color: string;
  onMarkComplete: (row: SheetRow) => void;
  onEdit?: (row: SheetRow) => void;
  onNotes?: (row: SheetRow) => void;
  onRepairDraft?: (row: SheetRow) => void;
  notes?: RepairNote[];
  hasDraft?: boolean;
}

export function KanbanCard({ row, color, onMarkComplete, onEdit, onNotes, onRepairDraft, notes = [], hasDraft = false }: Props) {
  const status = getStatus(row);
  const machineColor = getMachineTypeColor(row.기계);
  const transition = STATUS_TRANSITIONS[status];
  const now = Date.now();

  const pendingNotes = notes.filter(n => !n.is_done);
  const doneNotes = notes.filter(n => n.is_done);

  const showEntryWarning = status === "입고대기" && row.수리시작일 && (() => {
    const d = parseSheetDate(row.수리시작일);
    return d && (now - d.getTime()) / (1000 * 60 * 60 * 24) > 7;
  })();

  const showExitWarning = status === "출고대기" && row.수리완료일 && (() => {
    const d = parseSheetDate(row.수리완료일);
    return d && (now - d.getTime()) / (1000 * 60 * 60 * 24) > 3;
  })();

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-border/60 p-3.5 space-y-2 transition-shadow hover:shadow-md"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${machineColor.bg} ${machineColor.text}`}>
          {row.기계 || "기타"}
        </span>
        {row.품목 && <span className="text-xs text-muted-foreground">{row.품목}</span>}
        {showEntryWarning && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 ml-auto" />}
        {showExitWarning && <CircleAlert className="h-3.5 w-3.5 text-red-500 ml-auto" />}
        <div className="ml-auto flex items-center gap-1">
          {/* 조달 뱃지 */}
          {onNotes && (
            <button
              onClick={() => onNotes(row)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md transition-colors hover:bg-orange-50"
              title="조달/필요사항"
            >
              <Package className={`h-3.5 w-3.5 ${pendingNotes.length > 0 ? "text-orange-500" : "text-muted-foreground/40"}`} />
              {pendingNotes.length > 0 && (
                <span className="text-[10px] font-bold text-orange-500 tabular-nums">{pendingNotes.length}</span>
              )}
              {pendingNotes.length === 0 && doneNotes.length > 0 && (
                <span className="text-[10px] text-muted-foreground/40">✓</span>
              )}
            </button>
          )}
          {onEdit && (
            <button onClick={() => onEdit(row)} className="p-1 rounded hover:bg-muted/50 transition-colors" title="수정">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <User className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-lg font-bold text-foreground truncate">{row.손님성명}</span>
      </div>

      {row.수리기사 && (
        <div className="flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: getTechnicianColor(row.수리기사) }}
          >
            {row.수리기사}
          </span>
        </div>
      )}

      {row.손님요구사항 && (
        <div className="flex items-start gap-1.5">
          <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-foreground leading-snug whitespace-pre-wrap">{row.손님요구사항}</p>
        </div>
      )}

      {row.입력자 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">입력: {row.입력자}</span>
        </div>
      )}

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

      {transition && (
        <button
          onClick={() => onMarkComplete(row)}
          className={`w-full mt-1 text-xs font-medium py-1.5 rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${TRANSITION_COLORS[transition.label] || "text-muted-foreground border-border hover:bg-muted/50"}`}
        >
          {transition.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
