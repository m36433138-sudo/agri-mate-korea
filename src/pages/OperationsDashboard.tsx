import { useState, useMemo } from "react";
import { useGoogleSheets, markRowComplete, updateRowStatus, updateRowPriority, updateRowTechnician } from "@/hooks/useGoogleSheets";
import { supabase } from "@/integrations/supabase/client";
import { SheetRow, getStatus, OperationStatus, getMachineTypeColor, formatSheetDate, isCompleted } from "@/types/operations";
import { PRIORITY_META, type Priority, TECHNICIANS } from "@/lib/priority";
import { PriorityPicker } from "@/components/operations/PriorityPicker";
import { TechnicianPicker } from "@/components/operations/TechnicianPicker";
import { RowFormModal } from "@/components/operations/RowFormModal";
import { RepairNoteModal } from "@/components/operations/RepairNoteModal";
import { RepairDraftModal } from "@/components/operations/RepairDraftModal";
import RepairInputModal from "@/components/RepairInputModal";
import type { DraftPrefill } from "@/components/RepairInputModal";
import { useRepairNotes } from "@/hooks/useRepairNotes";
import { useRepairDrafts } from "@/hooks/useRepairDrafts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw, AlertCircle, Plus, PackageOpen, Wrench, CheckCircle2,
  Truck, PauseCircle, Package, Phone, MapPin, Pencil, FileText,
  ArrowRight, ChevronDown, ChevronUp, Flame,
} from "lucide-react";

type Branch = "전체" | "장흥" | "강진";

const STATUS_META: Record<OperationStatus, { label: string; color: string; rowBg: string; badge: string }> = {
  입고대기: { label: "입고대기", color: "#f97316", rowBg: "hsl(25 80% 50% / 0.06)", badge: "bg-orange-950/60 text-orange-400 ring-orange-500/30" },
  수리대기: { label: "수리대기", color: "#eab308", rowBg: "hsl(48 96% 50% / 0.05)", badge: "bg-yellow-950/60 text-yellow-400 ring-yellow-500/30" },
  수리중:   { label: "수리중",   color: "#3b82f6", rowBg: "hsl(217 91% 58% / 0.06)", badge: "bg-blue-950/60 text-blue-400 ring-blue-500/30" },
  수리완료: { label: "수리완료", color: "#14b8a6", rowBg: "hsl(174 84% 40% / 0.06)", badge: "bg-teal-950/60 text-teal-400 ring-teal-500/30" },
  출고대기: { label: "출고대기", color: "#16a34a", rowBg: "hsl(142 71% 45% / 0.06)", badge: "bg-green-950/60 text-green-400 ring-green-500/30" },
  보류:     { label: "보류",     color: "#6b7280", rowBg: "hsl(220 9% 46% / 0.05)", badge: "bg-zinc-900/60 text-zinc-400 ring-zinc-500/30" },
};

const STATUS_ORDER: OperationStatus[] = ["입고대기", "수리대기", "수리중", "수리완료", "출고대기", "보류"];

const STATUS_TRANSITIONS: Record<OperationStatus, { label: string; next: OperationStatus | "완료" } | null> = {
  입고대기: { label: "입고완료", next: "수리대기" },
  수리대기: { label: "수리시작", next: "수리중" },
  수리중:   { label: "수리완료", next: "수리완료" },
  수리완료: { label: "출고대기로", next: "출고대기" },
  출고대기: { label: "출고완료", next: "완료" },
  보류:     null,
};

function StatusBadge({ status }: { status: OperationStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md ring-1 ring-inset whitespace-nowrap ${m.badge}`}>
      {m.label}
    </span>
  );
}

export default function OperationsDashboard() {
  const { allData: rawData, isLoading, error, lastUpdated, refresh } = useGoogleSheets();
  // 완료된 항목(P열 TRUE)은 작업현황판에서 제외 — 실적현황으로 이동
  const allData = useMemo(() => rawData.filter(r => !isCompleted(r.전체완료)), [rawData]);
  const [branch, setBranch] = useState<Branch>("전체");
  const [statusFilter, setStatusFilter] = useState<OperationStatus | "전체">("전체");
  const [techFilter, setTechFilter] = useState("전체");
  const [confirmRow, setConfirmRow] = useState<SheetRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; next: OperationStatus | "완료" } | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<SheetRow | null>(null);
  const [noteRow, setNoteRow] = useState<SheetRow | null>(null);
  const [draftRow, setDraftRow] = useState<SheetRow | null>(null);
  const [repairModalOpen, setRepairModalOpen] = useState(false);
  const [draftPrefill, setDraftPrefill] = useState<DraftPrefill | null>(null);
  const [expandedReq, setExpandedReq] = useState<Set<string>>(new Set());
  const { getNotesForRow, pendingCount } = useRepairNotes();
  const { getDraftForRow, finalizeDraft } = useRepairDrafts();
  const { toast } = useToast();

  const technicians = useMemo(() => {
    const set = new Set(allData.map(r => r.수리기사).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [allData]);

  const filtered = useMemo(() => {
    let rows = allData;
    if (branch !== "전체") rows = rows.filter(r => r._branch === branch);
    if (techFilter !== "전체") rows = rows.filter(r => r.수리기사 === techFilter);
    if (statusFilter !== "전체") rows = rows.filter(r => getStatus(r) === statusFilter);
    // 상태 순서대로 정렬
    return rows.slice().sort((a, b) => {
      return STATUS_ORDER.indexOf(getStatus(a)) - STATUS_ORDER.indexOf(getStatus(b));
    });
  }, [allData, branch, techFilter, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { 전체: allData.length };
    STATUS_ORDER.forEach(s => { c[s] = allData.filter(r => getStatus(r) === s).length; });
    return c;
  }, [allData]);

  const handleTransition = (row: SheetRow) => {
    const transition = STATUS_TRANSITIONS[getStatus(row)];
    if (!transition) return;
    setConfirmRow(row);
    setConfirmAction(transition);
  };

  const handleConfirmTransition = async () => {
    if (!confirmRow || !confirmAction) return;
    setIsMarking(true);
    try {
      const sheetName = confirmRow._branch === "장흥" ? "장흥(입출수)" : "강진(입출수)";
      const newStatus = confirmAction.next;

      if (newStatus === "완료") {
        // P열 TRUE + A열 status_label도 "완료"로 동기화 → 작업현황판에서 제외, 실적현황에 반영
        await markRowComplete(sheetName, confirmRow._rowIndex, confirmRow._doneCol);
        try { await updateRowStatus(sheetName, confirmRow._rowIndex, "완료"); } catch { /* 보조 업데이트 실패 무시 */ }
        toast({ title: "출고 완료", description: `${confirmRow.손님성명}님의 작업이 완료 처리되어 실적현황으로 이동했습니다.` });
      } else {
        await updateRowStatus(sheetName, confirmRow._rowIndex, newStatus);
        toast({ title: "상태 변경", description: `${confirmRow.손님성명}님 → ${newStatus}` });
      }

      // sheet_assignments upsert — 수리기사가 있을 때만
      if (confirmRow.수리기사) {
        try {
          // employees 테이블에서 해당 기사 ID 조회
          const { data: emp } = await supabase
            .from("employees")
            .select("id")
            .eq("name", confirmRow.수리기사)
            .maybeSingle();

          await (supabase as any)
            .from("sheet_assignments")
            .upsert({
              branch: confirmRow._branch,
              row_index: confirmRow._rowIndex,
              employee_name: confirmRow.수리기사,
              employee_id: emp?.id ?? null,
              status: newStatus === "완료" ? "완료" : newStatus,
              customer_name: confirmRow.손님성명 || null,
              machine_type: confirmRow.기계 || null,
              model: confirmRow.품목 || null,
              updated_at: new Date().toISOString(),
            }, { onConflict: "branch,row_index" });
        } catch {
          // sheet_assignments 실패해도 주 기능에는 영향 없음
        }
      }

      refresh();
    } catch (err: any) {
      toast({ title: "오류", description: err.message || "상태 변경에 실패했습니다.", variant: "destructive" });
    } finally {
      setIsMarking(false);
      setConfirmRow(null);
      setConfirmAction(null);
    }
  };

  const toggleReq = (key: string) => {
    setExpandedReq(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-destructive font-medium">데이터를 불러오지 못했습니다</p>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1.5" /> 다시 시도
          </Button>
        </div>
      </div>
    );
  }

  const formBranch = editRow?._branch ?? (branch === "전체" ? "장흥" : branch);

  return (
    <div className="space-y-4">

      {/* ── 상단 요약 카운터 ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* 상태 필터 탭 (카운트 표시) */}
        <div className="flex flex-wrap gap-1.5">
          {(["전체", ...STATUS_ORDER] as const).map(s => {
            const active = statusFilter === s;
            const color = s !== "전체" ? STATUS_META[s].color : undefined;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s as any)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  active
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
                style={active && color ? { borderColor: color + "88", color, background: color + "18" } : undefined}
              >
                {s}
                <span className={`ml-1.5 text-[10px] ${active ? "opacity-90" : "opacity-50"}`}>
                  {counts[s] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* 지점 */}
          <div className="flex rounded-lg border border-border/50 overflow-hidden text-xs">
            {(["전체", "장흥", "강진"] as Branch[]).map(b => (
              <button key={b} onClick={() => setBranch(b)}
                className={`px-3 py-1.5 font-semibold transition-colors ${branch === b ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {b}
              </button>
            ))}
          </div>

          {/* 기사 */}
          <Select value={techFilter} onValueChange={setTechFilter}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue placeholder="수리기사" />
            </SelectTrigger>
            <SelectContent>
              {technicians.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button onClick={() => { setEditRow(null); setFormOpen(true); }} size="sm" className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> 추가
          </Button>
          <Button onClick={refresh} variant="outline" size="sm" disabled={isLoading} className="h-8 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* 마지막 업데이트 */}
      {lastUpdated && (
        <p className="text-[11px] text-muted-foreground">
          마지막 갱신: {lastUpdated.toLocaleTimeString("ko-KR")} · 총 {filtered.length}건
        </p>
      )}

      {/* ── 테이블 ── */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        {/* 헤더 */}
        <div
          className="grid text-[11px] font-semibold text-muted-foreground uppercase tracking-wide"
          style={{
            gridTemplateColumns: "110px 52px 90px 1fr 120px 110px 1fr 80px 110px",
            background: "hsl(var(--card))",
            borderBottom: "1px solid hsl(var(--border) / 0.6)",
            padding: "10px 14px",
          }}
        >
          <span>상태</span>
          <span>지점</span>
          <span>성함</span>
          <span>기계 / 품목</span>
          <span>S/N</span>
          <span>전화번호</span>
          <span>주소 / 요구사항</span>
          <span>기사</span>
          <span className="text-right">액션</span>
        </div>

        {/* 로딩 */}
        {isLoading && (
          <div className="p-4 space-y-2">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
        )}

        {/* 빈 상태 */}
        {!isLoading && filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            조건에 맞는 항목이 없습니다.
          </div>
        )}

        {/* 데이터 행 */}
        {!isLoading && filtered.map((row, idx) => {
          const status = getStatus(row);
          const meta = STATUS_META[status];
          const transition = STATUS_TRANSITIONS[status];
          const machineColor = getMachineTypeColor(row.기계);
          const rowKey = `${row._branch}-${row._rowIndex}`;
          const reqExpanded = expandedReq.has(rowKey);
          const pendingNotes = getNotesForRow(row._branch, row._rowIndex).filter(n => !n.is_done);
          const hasDraft = !!getDraftForRow(row._branch, row._rowIndex);

          return (
            <div
              key={rowKey + idx}
              className="group border-b border-border/30 last:border-0 transition-colors hover:brightness-110"
              style={{ background: meta.rowBg, borderLeft: `3px solid ${meta.color}` }}
            >
              {/* 메인 행 */}
              <div
                className="grid items-center"
                style={{
                  gridTemplateColumns: "110px 52px 90px 1fr 120px 110px 1fr 80px 110px",
                  padding: "9px 14px",
                  gap: 0,
                }}
              >
                {/* 상태 */}
                <div><StatusBadge status={status} /></div>

                {/* 지점 */}
                <div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 ring-inset ${
                    row._branch === "장흥"
                      ? "bg-emerald-950/60 text-emerald-400 ring-emerald-500/30"
                      : "bg-violet-950/60 text-violet-400 ring-violet-500/30"
                  }`}>{row._branch}</span>
                </div>

                {/* 성함 */}
                <div className="font-bold text-sm text-foreground truncate pr-2">
                  {row.손님성명 || "-"}
                </div>

                {/* 기계 / 품목 */}
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  {row.기계 && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${machineColor.bg} ${machineColor.text}`}>
                      {row.기계}
                    </span>
                  )}
                  {row.품목 && (
                    <span className="text-xs text-foreground/80 truncate font-mono">{row.품목}</span>
                  )}
                </div>

                {/* S/N */}
                <div className="text-[11px] font-mono text-muted-foreground truncate pr-2">
                  {row.제조번호 || "-"}
                </div>

                {/* 전화번호 */}
                <div>
                  {row.전화번호 ? (
                    <a href={`tel:${row.전화번호}`}
                      className="text-xs text-foreground/80 hover:text-primary transition-colors flex items-center gap-1 tabular-nums">
                      <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                      {row.전화번호}
                    </a>
                  ) : <span className="text-muted-foreground/40 text-xs">-</span>}
                </div>

                {/* 주소 / 요구사항 */}
                <div className="pr-2 min-w-0">
                  {row.주소 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{row.주소}</span>
                    </div>
                  )}
                  {row.손님요구사항 && (
                    <button
                      onClick={() => toggleReq(rowKey)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground mt-0.5 transition-colors"
                    >
                      {reqExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      요구사항
                    </button>
                  )}
                </div>

                {/* 기사 */}
                <div className="text-xs text-muted-foreground truncate pr-1">
                  {row.수리기사 || "-"}
                </div>

                {/* 액션 */}
                <div className="flex items-center justify-end gap-1">
                  {/* 조달 */}
                  <button
                    onClick={() => setNoteRow(row)}
                    className={`p-1.5 rounded-lg transition-colors relative ${
                      pendingNotes.length > 0
                        ? "text-orange-400 bg-orange-950/50 hover:bg-orange-950/80"
                        : "text-muted-foreground/40 hover:bg-muted/30 hover:text-muted-foreground"
                    }`}
                    title="조달"
                  >
                    <Package className="h-3.5 w-3.5" />
                    {pendingNotes.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center">
                        {pendingNotes.length}
                      </span>
                    )}
                  </button>

                  {/* 수리내역 */}
                  {(status === "수리중" || status === "수리완료" || status === "수리대기") && (
                    <button
                      onClick={() => setDraftRow(row)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        hasDraft
                          ? "text-blue-400 bg-blue-950/50 hover:bg-blue-950/80"
                          : "text-muted-foreground/40 hover:bg-muted/30 hover:text-muted-foreground"
                      }`}
                      title="수리내역"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* 수정 */}
                  <button
                    onClick={() => { setEditRow(row); setFormOpen(true); }}
                    className="p-1.5 rounded-lg text-muted-foreground/40 hover:bg-muted/30 hover:text-muted-foreground transition-colors"
                    title="수정"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  {/* 상태 전환 */}
                  {transition && (
                    <button
                      onClick={() => handleTransition(row)}
                      className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap"
                      style={{
                        color: meta.color,
                        borderColor: meta.color + "55",
                        background: meta.color + "15",
                      }}
                      title={transition.label}
                    >
                      {transition.label}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* 요구사항 확장 영역 */}
              {reqExpanded && row.손님요구사항 && (
                <div className="px-[calc(110px+52px+90px+14px+14px)] pb-2.5">
                  <div className="text-xs text-foreground/80 bg-card/60 rounded-lg px-3 py-2 border border-border/30 leading-relaxed whitespace-pre-wrap">
                    {row.손님요구사항}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmRow && !!confirmAction} onOpenChange={open => { if (!open) { setConfirmRow(null); setConfirmAction(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.next === "완료" ? "출고 완료 처리하시겠습니까?" : `${confirmAction?.label} 처리하시겠습니까?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRow && `${confirmRow.손님성명}님 · ${confirmRow.기계} ${confirmRow.품목}`}
              {confirmAction?.next !== "완료" && confirmAction && (
                <span className="block mt-1 font-medium text-foreground">→ {confirmAction.next}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMarking}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTransition} disabled={isMarking}>
              {isMarking ? "처리 중..." : confirmAction?.label || "확인"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RowFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditRow(null); }}
        onSuccess={refresh}
        row={editRow}
        branch={formBranch as "장흥" | "강진"}
      />

      {noteRow && (
        <RepairNoteModal open={!!noteRow} onClose={() => setNoteRow(null)} row={noteRow} />
      )}

      {draftRow && (
        <RepairDraftModal
          open={!!draftRow}
          onClose={() => setDraftRow(null)}
          row={draftRow}
          onTransferToRepair={(prefill) => {
            setDraftPrefill(prefill);
            setRepairModalOpen(true);
          }}
        />
      )}

      <RepairInputModal
        open={repairModalOpen}
        onOpenChange={setRepairModalOpen}
        draftPrefill={draftPrefill}
        onDraftFinalized={(draftId) => {
          finalizeDraft.mutate(draftId);
          setDraftPrefill(null);
        }}
      />

      <button
        onClick={refresh}
        className="fixed bottom-6 right-6 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-50"
        title="새로고침"
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
