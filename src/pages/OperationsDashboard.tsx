import { useState, useMemo } from "react";
import { useGoogleSheets, markRowComplete, updateRowStatus } from "@/hooks/useGoogleSheets";
import { SheetRow, getStatus, OperationStatus } from "@/types/operations";
import { KanbanCard } from "@/components/operations/KanbanCard";
import { RowFormModal } from "@/components/operations/RowFormModal";
import { RepairNoteModal } from "@/components/operations/RepairNoteModal";
import { RepairDraftModal } from "@/components/operations/RepairDraftModal";
import RepairInputModal from "@/components/RepairInputModal";
import type { DraftPrefill } from "@/components/RepairInputModal";
import { useRepairNotes } from "@/hooks/useRepairNotes";
import { useRepairDrafts } from "@/hooks/useRepairDrafts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw, AlertCircle, Plus, PackageOpen, Wrench, Clock, CheckCircle2, Truck, PauseCircle, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Branch = "전체" | "장흥" | "강진";
type Section = "입출고" | "수리";

const ENTRY_EXIT_COLUMNS: { status: OperationStatus; label: string; color: string }[] = [
  { status: "입고대기", label: "입고대기", color: "#f97316" },
  { status: "출고대기", label: "출고대기", color: "#16a34a" },
];

const REPAIR_COLUMNS: { status: OperationStatus; label: string; color: string }[] = [
  { status: "수리대기", label: "수리대기", color: "#eab308" },
  { status: "수리중", label: "수리중", color: "#3b82f6" },
  { status: "수리완료", label: "수리완료", color: "#14b8a6" },
  { status: "보류", label: "보류", color: "#6b7280" },
];

const STATUS_TRANSITIONS: Record<OperationStatus, { label: string; next: OperationStatus | "완료" } | null> = {
  입고대기: { label: "입고완료 → 수리대기", next: "수리대기" },
  수리대기: { label: "수리시작", next: "수리중" },
  수리중: { label: "수리완료", next: "수리완료" },
  수리완료: { label: "출고대기로", next: "출고대기" },
  출고대기: { label: "출고완료", next: "완료" },
  보류: null,
};

export default function OperationsDashboard() {
  const { allData, isLoading, error, lastUpdated, refresh } = useGoogleSheets();
  const [branch, setBranch] = useState<Branch>("전체");
  const [techFilter, setTechFilter] = useState("전체");
  const [section, setSection] = useState<Section>("입출고");
  const [mobileTab, setMobileTab] = useState<OperationStatus>("입고대기");
  const [confirmRow, setConfirmRow] = useState<SheetRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; next: OperationStatus | "완료" } | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<SheetRow | null>(null);
  const [noteRow, setNoteRow] = useState<SheetRow | null>(null);
  const [draftRow, setDraftRow] = useState<SheetRow | null>(null);
  const [repairModalOpen, setRepairModalOpen] = useState(false);
  const [draftPrefill, setDraftPrefill] = useState<DraftPrefill | null>(null);
  const { allNotes, getNotesForRow, pendingCount } = useRepairNotes();
  const { drafts, getDraftForRow, finalizeDraft } = useRepairDrafts();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const branchData = useMemo(() => {
    let rows = allData;
    if (branch === "장흥") rows = rows.filter(r => r._branch === "장흥");
    if (branch === "강진") rows = rows.filter(r => r._branch === "강진");
    if (techFilter !== "전체") rows = rows.filter(r => r.수리기사 === techFilter);
    return rows;
  }, [allData, branch, techFilter]);

  const technicians = useMemo(() => {
    const set = new Set(allData.map(r => r.수리기사).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [allData]);

  const columnData = useMemo(() => {
    const map: Record<OperationStatus, SheetRow[]> = { 입고대기: [], 수리대기: [], 수리중: [], 수리완료: [], 출고대기: [], 보류: [] };
    branchData.forEach(row => {
      const s = getStatus(row);
      if (map[s]) map[s].push(row);
    });
    return map;
  }, [branchData]);

  const currentColumns = section === "입출고" ? ENTRY_EXIT_COLUMNS : REPAIR_COLUMNS;

  const handleTransition = (row: SheetRow) => {
    const status = getStatus(row);
    const transition = STATUS_TRANSITIONS[status];
    if (!transition) return;
    setConfirmRow(row);
    setConfirmAction(transition);
  };

  const handleConfirmTransition = async () => {
    if (!confirmRow || !confirmAction) return;
    setIsMarking(true);
    try {
      const sheetName = confirmRow._branch === "장흥" ? "장흥(입출수)" : "강진(입출수)";
      if (confirmAction.next === "완료") {
        await markRowComplete(sheetName, confirmRow._rowIndex, confirmRow._doneCol);
        toast({ title: "출고 완료", description: `${confirmRow.손님성명}님의 작업이 완료 처리되었습니다.` });
      } else {
        await updateRowStatus(sheetName, confirmRow._rowIndex, confirmAction.next);
        toast({ title: "상태 변경 완료", description: `${confirmRow.손님성명}님 → ${confirmAction.next}` });
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

  const handleEdit = (row: SheetRow) => {
    setEditRow(row);
    setFormOpen(true);
  };

  const handleNotes = (row: SheetRow) => {
    setNoteRow(row);
  };

  const handleRepairDraft = (row: SheetRow) => {
    setDraftRow(row);
  };

  const handleAdd = () => {
    setEditRow(null);
    setFormOpen(true);
  };

  const formBranch = editRow?._branch ?? (branch === "전체" ? "장흥" : branch);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">작업현황판</h1>
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-destructive font-medium">데이터를 불러오지 못했습니다</p>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" /> 다시 시도
          </Button>
        </div>
      </div>
    );
  }

  // 요약 통계
  const summaryStats = [
    { label: "입고대기", count: columnData["입고대기"].length, icon: Truck, color: "text-orange-500", bg: "bg-orange-50" },
    { label: "수리중", count: columnData["수리중"].length, icon: Wrench, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "수리완료", count: columnData["수리완료"].length, icon: CheckCircle2, color: "text-teal-500", bg: "bg-teal-50" },
    { label: "출고대기", count: columnData["출고대기"].length, icon: PackageOpen, color: "text-green-600", bg: "bg-green-50" },
    { label: "보류", count: columnData["보류"].length, icon: PauseCircle, color: "text-gray-400", bg: "bg-gray-50" },
    { label: "조달필요", count: pendingCount, icon: Package, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastUpdated.toLocaleTimeString("ko-KR")} 기준
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" /> 추가
          </Button>
          <Button onClick={refresh} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> 새로고침
          </Button>
        </div>
      </div>

      {/* 요약 통계 카드 */}
      {!isLoading && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {summaryStats.map(s => (
            <Card key={s.label} className="border-0 shadow-card">
              <CardContent className="p-3 flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${s.bg} shrink-0`}>
                  <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
                  <p className={`text-lg font-bold tabular-nums leading-none mt-0.5 ${s.count > 0 ? "" : "text-muted-foreground/40"}`}>{s.count}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Section toggle + Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Tabs value={section} onValueChange={v => { setSection(v as Section); setMobileTab(v === "입출고" ? "입고대기" : "수리대기"); }}>
          <TabsList>
            <TabsTrigger value="입출고" className="gap-1.5">
              <PackageOpen className="h-4 w-4" /> 입출고
              <span className="ml-1 text-[10px] opacity-70 bg-background/50 rounded px-1">
                {(columnData["입고대기"].length + columnData["출고대기"].length)}
              </span>
            </TabsTrigger>
            <TabsTrigger value="수리" className="gap-1.5">
              <Wrench className="h-4 w-4" /> 수리
              <span className="ml-1 text-[10px] opacity-70 bg-background/50 rounded px-1">
                {(columnData["수리대기"].length + columnData["수리중"].length + columnData["수리완료"].length + columnData["보류"].length)}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={branch} onValueChange={v => setBranch(v as Branch)}>
          <TabsList>
            <TabsTrigger value="전체">전체</TabsTrigger>
            <TabsTrigger value="장흥">장흥</TabsTrigger>
            <TabsTrigger value="강진">강진</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="수리기사" />
          </SelectTrigger>
          <SelectContent>
            {technicians.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className={`grid gap-4 ${section === "입출고" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-4"}`}>
          {currentColumns.map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          ))}
        </div>
      ) : isMobile ? (
        <>
          <Tabs value={mobileTab} onValueChange={v => setMobileTab(v as OperationStatus)}>
            <TabsList className={`w-full grid ${section === "입출고" ? "grid-cols-2" : "grid-cols-4"}`}>
              {currentColumns.map(col => (
                <TabsTrigger key={col.status} value={col.status} className="text-xs px-1">
                  {col.label} <span className="ml-1 text-[10px] opacity-70">{columnData[col.status].length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="space-y-2">
            {columnData[mobileTab].length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">항목이 없습니다</p>
            ) : (
              columnData[mobileTab].map((row, i) => (
                <KanbanCard
                  key={`${row._branch}-${row._rowIndex}-${i}`}
                  row={row}
                  color={currentColumns.find(c => c.status === mobileTab)!.color}
                  onMarkComplete={handleTransition}
                  onEdit={handleEdit}
                  onNotes={handleNotes}
                  onRepairDraft={handleRepairDraft}
                  notes={getNotesForRow(row._branch, row._rowIndex)}
                  hasDraft={!!getDraftForRow(row._branch, row._rowIndex)}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <div className={`grid gap-4 items-start ${section === "입출고" ? "grid-cols-2" : "grid-cols-4"}`}>
          {currentColumns.map(col => (
            <div key={col.status} className="space-y-2">
              <div className="flex items-center gap-2 px-1 pb-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="font-semibold text-base">{col.label}</span>
                <span className="ml-auto text-sm font-medium rounded-full px-2 py-0.5" style={{ backgroundColor: col.color + "18", color: col.color }}>
                  {columnData[col.status].length}
                </span>
              </div>
              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {columnData[col.status].length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6 bg-muted/30 rounded-xl">없음</p>
                ) : (
                  columnData[col.status].map((row, i) => (
                    <KanbanCard
                      key={`${row._branch}-${row._rowIndex}-${i}`}
                      row={row}
                      color={col.color}
                      onMarkComplete={handleTransition}
                      onEdit={handleEdit}
                      onNotes={handleNotes}
                      onRepairDraft={handleRepairDraft}
                      notes={getNotesForRow(row._branch, row._rowIndex)}
                      hasDraft={!!getDraftForRow(row._branch, row._rowIndex)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm dialog for status transitions */}
      <AlertDialog open={!!confirmRow && !!confirmAction} onOpenChange={open => { if (!open) { setConfirmRow(null); setConfirmAction(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.next === "완료" ? "출고 완료 처리하시겠습니까?" : `${confirmAction?.label} 처리하시겠습니까?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRow && `${confirmRow.손님성명}님의 ${confirmRow.기계} ${confirmRow.품목}`}
              {confirmAction?.next !== "완료" && confirmAction && (
                <span className="block mt-1 font-medium">→ {confirmAction.next}</span>
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

      {/* Add/Edit modal */}
      <RowFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditRow(null); }}
        onSuccess={refresh}
        row={editRow}
        branch={formBranch as "장흥" | "강진"}
      />

      {/* 조달/필요사항 모달 */}
      {noteRow && (
        <RepairNoteModal
          open={!!noteRow}
          onClose={() => setNoteRow(null)}
          row={noteRow}
        />
      )}

      {/* 수리내역 임시저장 모달 */}
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

      {/* 수리이력 등록 모달 (draft에서 전환) */}
      <RepairInputModal
        open={repairModalOpen}
        onOpenChange={setRepairModalOpen}
        draftPrefill={draftPrefill}
        onDraftFinalized={(draftId) => {
          finalizeDraft.mutate(draftId);
          setDraftPrefill(null);
        }}
      />

      {/* Floating refresh */}
      <button
        onClick={refresh}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-50"
        title="새로고침"
      >
        <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
