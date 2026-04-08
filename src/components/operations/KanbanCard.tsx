import { useState } from "react";
import { SheetRow, getStatus, OperationStatus, getTechnicianColor, getMachineTypeColor, formatSheetDate, parseSheetDate } from "@/types/operations";
import {
  AlertTriangle, CircleAlert, Phone, MapPin, Wrench, Pencil, ArrowRight,
  Package, FileText, ChevronDown, ChevronUp, Tractor, User,
} from "lucide-react";
import { RepairNote } from "@/hooks/useRepairNotes";

const STATUS_TRANSITIONS: Record<OperationStatus, { label: string; next: OperationStatus | "완료" } | null> = {
  입고대기: { label: "입고완료", next: "수리대기" },
  수리대기: { label: "수리시작", next: "수리중" },
  수리중: { label: "수리완료", next: "수리완료" },
  수리완료: { label: "출고대기로", next: "출고대기" },
  출고대기: { label: "출고완료", next: "완료" },
  보류: null,
};

const TRANSITION_STYLE: Record<string, string> = {
  입고완료:    "text-amber-700  bg-amber-50   border-amber-200  hover:bg-amber-100",
  수리시작:    "text-blue-700   bg-blue-50    border-blue-200   hover:bg-blue-100",
  수리완료:    "text-teal-700   bg-teal-50    border-teal-200   hover:bg-teal-100",
  "출고대기로": "text-green-700  bg-green-50   border-green-200  hover:bg-green-100",
  출고완료:    "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
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
  const [reqOpen, setReqOpen] = useState(false);

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
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-border/50 overflow-hidden"
      style={{ borderLeftWidth: 5, borderLeftColor: color }}
    >
      {/* ── 상단: 지점 + 경고 + 액션 버튼 ── */}
      <div className="flex items-center gap-1.5 px-3.5 pt-3 pb-0">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ring-1 ring-inset ${
          row._branch === "장흥"
            ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
            : "bg-violet-50 text-violet-700 ring-violet-600/20"
        }`}>
          {row._branch}
        </span>
        {showEntryWarning && (
          <span className="flex items-center gap-0.5 text-[10px] text-orange-600 font-medium">
            <AlertTriangle className="h-3 w-3" /> 장기입고
          </span>
        )}
        {showExitWarning && (
          <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-medium">
            <CircleAlert className="h-3 w-3" /> 출고지연
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {/* 수리내역 */}
          {onRepairDraft && (status === "수리중" || status === "수리완료" || status === "수리대기") && (
            <button
              onClick={() => onRepairDraft(row)}
              className={`p-1.5 rounded-lg transition-colors ${hasDraft ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : "text-muted-foreground/40 hover:bg-muted/50"}`}
              title="수리내역 기록"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
          )}
          {/* 조달 */}
          {onNotes && (
            <button
              onClick={() => onNotes(row)}
              className={`p-1.5 rounded-lg transition-colors relative ${pendingNotes.length > 0 ? "text-orange-500 bg-orange-50 hover:bg-orange-100" : "text-muted-foreground/40 hover:bg-muted/50"}`}
              title="조달/필요사항"
            >
              <Package className="h-3.5 w-3.5" />
              {pendingNotes.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center">
                  {pendingNotes.length}
                </span>
              )}
            </button>
          )}
          {/* 수정 */}
          {onEdit && (
            <button onClick={() => onEdit(row)} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors" title="수정">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* ── 핵심 정보 영역 ── */}
      <div className="px-3.5 pt-2.5 pb-3 space-y-2.5">

        {/* 성함 — 가장 크게 */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xl font-extrabold text-foreground tracking-tight leading-none">
            {row.손님성명}
          </span>
        </div>

        {/* 기계 + 품목 */}
        <div className="flex items-start gap-2">
          <div className="w-8 flex justify-center shrink-0 pt-0.5">
            <Tractor className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-bold ${machineColor.bg} ${machineColor.text}`}>
                {row.기계 || "기타"}
              </span>
              {row.품목 && (
                <span className="text-base font-semibold text-foreground truncate">
                  {row.품목}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 전화번호 */}
        {row.전화번호 && (
          <div className="flex items-center gap-2">
            <div className="w-8 flex justify-center shrink-0">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <a href={`tel:${row.전화번호}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors tabular-nums">
              {row.전화번호}
            </a>
          </div>
        )}

        {/* 주소 */}
        {row.주소 && (
          <div className="flex items-start gap-2">
            <div className="w-8 flex justify-center shrink-0 pt-0.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm text-foreground leading-snug">{row.주소}</span>
          </div>
        )}

        {/* 수리기사 */}
        {row.수리기사 && (
          <div className="flex items-center gap-2">
            <div className="w-8 flex justify-center shrink-0">
              <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span
              className="inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-bold text-white"
              style={{ backgroundColor: getTechnicianColor(row.수리기사) }}
            >
              {row.수리기사}
            </span>
          </div>
        )}

        {/* 손님 요구사항 — 토글 */}
        {row.손님요구사항 && (
          <div>
            <button
              onClick={() => setReqOpen(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {reqOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              손님 요구사항
            </button>
            {reqOpen && (
              <div className="mt-1.5 ml-1 pl-3 border-l-2 border-muted text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {row.손님요구사항}
              </div>
            )}
          </div>
        )}

        {/* 날짜 + 입력자 */}
        <div className="flex items-center justify-between pt-0.5 border-t border-border/40">
          <div className="flex gap-3 text-[11px] text-muted-foreground">
            {row.입고일 && <span>입고 {formatSheetDate(row.입고일)}</span>}
            {row.수리완료일 && <span>완료 {formatSheetDate(row.수리완료일)}</span>}
            {row.출고일 && <span>출고 {formatSheetDate(row.출고일)}</span>}
          </div>
          {row.입력자 && (
            <span className="text-[11px] text-muted-foreground/60">{row.입력자}</span>
          )}
        </div>
      </div>

      {/* ── 상태 전환 버튼 ── */}
      {transition && (
        <div className="px-3.5 pb-3">
          <button
            onClick={() => onMarkComplete(row)}
            className={`w-full text-sm font-semibold py-2 rounded-xl border flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${TRANSITION_STYLE[transition.label] || "text-muted-foreground border-border hover:bg-muted/50"}`}
          >
            {transition.label}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
