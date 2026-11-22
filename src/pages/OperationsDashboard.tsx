import { useState, useMemo } from "react";
import { useGoogleSheets, markRowComplete, updateRowStatus } from "@/hooks/useGoogleSheets";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { importBranchFromSheet } from "@/lib/operationRows";
import { SheetRow, getStatus, OperationStatus, getMachineTypeColor, getTechnicianColor, formatSheetDate, isCompleted } from "@/types/operations";
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
  RefreshCw, AlertCircle, Plus, Wrench, Package, Phone, MapPin, Pencil, FileText,
  ArrowRight, ChevronDown, ChevronUp, Scissors, Download, MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Branch = "전체" | "장흥" | "강진";

const STATUS_META: Record<OperationStatus, { label: string; color: string; rowBg: string; badge: string }> = {
  입고대기: { label: "입고대기", color: "#f97316", rowBg: "hsl(25 80% 50% / 0.06)", badge: "bg-orange-500/15 text-orange-700 dark:text-orange-400 ring-orange-500/30" },
  수리대기: { label: "수리대기", color: "#eab308", rowBg: "hsl(48 96% 50% / 0.05)", badge: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 ring-yellow-500/30" },
  수리중:   { label: "수리중",   color: "#3b82f6", rowBg: "hsl(217 91% 58% / 0.06)", badge: "bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-500/30" },
  수리완료: { label: "수리완료", color: "#14b8a6", rowBg: "hsl(174 84% 40% / 0.06)", badge: "bg-teal-500/15 text-teal-700 dark:text-teal-400 ring-teal-500/30" },
  출고대기: { label: "출고대기", color: "#16a34a", rowBg: "hsl(142 71% 45% / 0.06)", badge: "bg-green-500/15 text-green-700 dark:text-green-400 ring-green-500/30" },
  보류:     { label: "보류",     color: "#6b7280", rowBg: "hsl(220 9% 46% / 0.05)", badge: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 ring-zinc-500/30" },
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
    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ring-1 ring-inset whitespace-nowrap ${m.badge}`}>
      {m.label}
    </span>
  );
}

function BranchBadge({ branch }: { branch: string }) {
  return (
    <span className={cn(
      "text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset",
      branch === "장흥"
        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30"
        : "bg-violet-500/15 text-violet-700 dark:text-violet-400 ring-violet-500/30",
    )}>{branch}</span>
  );
}

function TechBadge({ name }: { name?: string }) {
  if (!name) return <span className="text-muted-foreground/60 text-xs">미배정</span>;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-bold text-white px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ backgroundColor: getTechnicianColor(name) }}
    >
      <Wrench className="h-3 w-3" />
      {name}
    </span>
  );
}

/** 행 동작: 조달 · 수리내역 · 수정 + 다음 단계 버튼 (표와 카드가 같이 쓴다) */
function RowActions({
  status, pendingCount, hasDraft, onNote, onDraft, onEdit, onNext, wide,
}: {
  status: OperationStatus; pendingCount: number; hasDraft: boolean;
  onNote: () => void; onDraft: () => void; onEdit: () => void; onNext: () => void; wide?: boolean;
}) {
  const meta = STATUS_META[status];
  const transition = STATUS_TRANSITIONS[status];
  const iconBtn = "relative h-9 w-9 rounded-full flex items-center justify-center transition-colors";
  return (
    <div className={cn("flex items-center gap-1.5", wide ? "justify-end" : "justify-between w-full")}>
      <div className="flex items-center gap-1">
        <button
          onClick={onNote}
          className={cn(iconBtn, pendingCount > 0
            ? "text-orange-600 dark:text-orange-400 bg-orange-500/15 hover:bg-orange-500/25"
            : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground")}
          title="조달" aria-label="조달"
        >
          <Package className="h-4 w-4" />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-orange-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
        {(status === "수리중" || status === "수리완료" || status === "수리대기") && (
          <button
            onClick={onDraft}
            className={cn(iconBtn, hasDraft
              ? "text-blue-600 dark:text-blue-400 bg-blue-500/15 hover:bg-blue-500/25"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground")}
            title="수리내역" aria-label="수리내역"
          >
            <FileText className="h-4 w-4" />
          </button>
        )}
        <button onClick={onEdit} className={cn(iconBtn, "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground")} title="수정" aria-label="수정">
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      {transition && (
        <button
          onClick={onNext}
          className="flex items-center gap-1 text-sm font-bold h-9 px-3.5 rounded-full border transition-colors whitespace-nowrap"
          style={{ color: meta.color, borderColor: meta.color + "55", background: meta.color + "18" }}
          title={transition.label}
        >
          {transition.label}
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function OperationsDashboard() {
  const { allData: rawData, isLoading, error, lastUpdated, refresh } = useGoogleSheets();
  const { isAdmin } = useUserRole();
  const [importing, setImporting] = useState(false);
  const handleImportSheet = async () => {
    if (!confirm("구글시트 내용을 앱으로 다시 가져올까요? 시트에 있는 값으로 앱 내용이 덮어써져요 (S/N은 유지).")) return;
    setImporting(true);
    try {
      const a = await importBranchFromSheet("장흥");
      const b = await importBranchFromSheet("강진");
      toast({ title: "시트 가져오기 완료", description: `장흥 ${a}건 · 강진 ${b}건` });
      refresh();
    } catch (e: any) {
      toast({ title: "시트 가져오기 실패", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };
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

  const GRID = "100px 56px 92px minmax(170px,1.1fr) minmax(170px,1fr) 104px 228px";

  return (
    <div className="space-y-5">
      {/* ── 머리말 ── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight">작업현황판</h1>
          <p className="text-sm text-muted-foreground mt-1">
            진행 중 {allData.length}건
            {lastUpdated && <> · {lastUpdated.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 갱신</>}
            <span className="hidden sm:inline"> · 앱이 원본, 구글시트는 백업</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => { setEditRow(null); setFormOpen(true); }} className="h-11 rounded-full px-5">
            <Plus className="h-4 w-4 mr-1" /> 작업 추가
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-full bg-card hidden sm:inline-flex">
            <a href="/blades"><Scissors className="h-4 w-4 mr-1.5" />예취 칼날</a>
          </Button>
          {isAdmin && (
            <Button onClick={handleImportSheet} variant="outline" disabled={importing} className="h-11 rounded-full bg-card hidden sm:inline-flex" title="구글시트 내용을 앱으로 가져오기">
              <Download className="h-4 w-4 mr-1.5" />{importing ? "가져오는 중…" : "시트 가져오기"}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11 w-11 p-0 rounded-full bg-card sm:hidden" aria-label="더 보기">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><a href="/blades"><Scissors className="h-4 w-4 mr-2" />예취 칼날</a></DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onSelect={handleImportSheet} disabled={importing}><Download className="h-4 w-4 mr-2" />시트 가져오기</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={refresh} variant="outline" disabled={isLoading} className="h-11 w-11 p-0 rounded-full bg-card" aria-label="새로고침" title="새로고침">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── 상태 카드 (누르면 거르기) ── */}
      <div className="flex gap-2.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:grid sm:grid-cols-4 xl:grid-cols-7">
        {(["전체", ...STATUS_ORDER] as const).map(s => {
          const active = statusFilter === s;
          const color = s !== "전체" ? STATUS_META[s].color : "hsl(var(--primary))";
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s as any)}
              aria-pressed={active}
              className={cn(
                "shrink-0 min-w-[104px] text-left rounded-3xl border bg-card card-shadow px-4 py-3.5 transition-all",
                active ? "border-transparent ring-2" : "border-border/70 hover:border-foreground/20",
              )}
              style={active ? ({ ["--tw-ring-color" as any]: color } as React.CSSProperties) : undefined}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                <i className="w-2 h-2 rounded-full" style={{ background: color }} />
                {s}
              </span>
              <span className="block mt-1.5 text-[26px] leading-none font-extrabold tabular-nums" style={active && s !== "전체" ? { color } : undefined}>
                {counts[s] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 거르기 ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center h-11 rounded-xl bg-muted p-1" role="group" aria-label="지점">
          {(["전체", "장흥", "강진"] as Branch[]).map(b => (
            <button
              key={b}
              onClick={() => setBranch(b)}
              aria-pressed={branch === b}
              className={cn("h-9 px-4 rounded-lg text-sm font-medium transition-colors",
                branch === b ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {b}
            </button>
          ))}
        </div>
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className={cn("w-[140px] h-11 rounded-xl bg-card", techFilter !== "전체" && "border-primary text-primary")}>
            <SelectValue placeholder="수리기사" />
          </SelectTrigger>
          <SelectContent>
            {technicians.map(t => <SelectItem key={t} value={t}>{t === "전체" ? "전체 기사" : t}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-1">{filtered.length}건</span>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="rounded-3xl border border-border/70 bg-card py-16 text-center text-sm text-muted-foreground">
          조건에 맞는 항목이 없습니다.
        </div>
      )}

      {/* ── 넓은 화면: 표 ── */}
      {!isLoading && filtered.length > 0 && (
        <div className="hidden xl:block rounded-3xl border border-border/70 bg-card card-shadow overflow-hidden">
          <div
            className="grid text-[13px] font-medium text-muted-foreground border-b border-border/60 px-5 py-3"
            style={{ gridTemplateColumns: GRID }}
          >
            <span>상태</span>
            <span>지점</span>
            <span>성함</span>
            <span>기계 · 품목 · S/N</span>
            <span>연락처 · 주소</span>
            <span>기사</span>
            <span className="text-right">동작</span>
          </div>

          {filtered.map((row, idx) => {
            const status = getStatus(row);
            const meta = STATUS_META[status];
            const machineColor = getMachineTypeColor(row.기계);
            const rowKey = `${row._branch}-${row._rowIndex}`;
            const reqExpanded = expandedReq.has(rowKey);
            const pendingNotes = getNotesForRow(row._branch, row._rowIndex).filter(n => !n.is_done);
            const hasDraft = !!getDraftForRow(row._branch, row._rowIndex);

            return (
              <div
                key={rowKey + idx}
                className="border-b border-border/50 last:border-0 transition-colors hover:bg-foreground/[0.03]"
                style={{ boxShadow: `inset 3px 0 0 ${meta.color}` }}
              >
                <div className="grid items-center px-5 py-3" style={{ gridTemplateColumns: GRID }}>
                  <div><StatusBadge status={status} /></div>
                  <div><BranchBadge branch={row._branch} /></div>
                  <div className="font-bold text-[15px] truncate pr-2">{row.손님성명 || "-"}</div>
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {row.기계 && (
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${machineColor.bg} ${machineColor.text}`}>{row.기계}</span>
                      )}
                      {row.품목 && <span className="text-sm font-medium truncate font-mono">{row.품목}</span>}
                    </div>
                    {row.제조번호 && <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">{row.제조번호}</p>}
                  </div>
                  <div className="min-w-0 pr-3">
                    {row.전화번호 ? (
                      <a href={`tel:${row.전화번호}`} className="text-sm hover:text-primary transition-colors flex items-center gap-1 tabular-nums whitespace-nowrap w-fit">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {row.전화번호}
                      </a>
                    ) : <span className="text-muted-foreground/50 text-sm">연락처 없음</span>}
                    <div className="flex items-center gap-2 mt-0.5 min-w-0">
                      {row.주소 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{row.주소}</span>
                        </span>
                      )}
                      {row.손님요구사항 && (
                        <button
                          onClick={() => toggleReq(rowKey)}
                          className="flex items-center gap-0.5 text-xs text-primary/80 hover:text-primary transition-colors shrink-0"
                        >
                          {reqExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          요구사항
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="pr-1"><TechBadge name={row.수리기사} /></div>
                  <RowActions
                    wide
                    status={status}
                    pendingCount={pendingNotes.length}
                    hasDraft={hasDraft}
                    onNote={() => setNoteRow(row)}
                    onDraft={() => setDraftRow(row)}
                    onEdit={() => { setEditRow(row); setFormOpen(true); }}
                    onNext={() => handleTransition(row)}
                  />
                </div>
                {reqExpanded && row.손님요구사항 && (
                  <div className="px-5 pb-3 pl-[calc(100px+56px+20px)]">
                    <div className="text-sm text-foreground/85 bg-muted/60 rounded-xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap">
                      {row.손님요구사항}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 휴대폰 · 태블릿: 카드 ── */}
      {!isLoading && filtered.length > 0 && (
        <ul className="xl:hidden grid gap-2.5 md:grid-cols-2">
          {filtered.map((row, idx) => {
            const status = getStatus(row);
            const meta = STATUS_META[status];
            const machineColor = getMachineTypeColor(row.기계);
            const rowKey = `${row._branch}-${row._rowIndex}`;
            const reqExpanded = expandedReq.has(rowKey);
            const pendingNotes = getNotesForRow(row._branch, row._rowIndex).filter(n => !n.is_done);
            const hasDraft = !!getDraftForRow(row._branch, row._rowIndex);
            return (
              <li
                key={rowKey + idx}
                className="rounded-3xl border border-border/70 bg-card card-shadow p-4 flex flex-col gap-3"
                style={{ boxShadow: `inset 0 3px 0 ${meta.color}` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={status} />
                    <BranchBadge branch={row._branch} />
                  </div>
                  <TechBadge name={row.수리기사} />
                </div>
                <div className="min-w-0">
                  <p className="text-[17px] font-bold truncate">{row.손님성명 || "-"}</p>
                  <div className="flex items-center gap-2 mt-1 min-w-0">
                    {row.기계 && (
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${machineColor.bg} ${machineColor.text}`}>{row.기계}</span>
                    )}
                    {row.품목 && <span className="text-sm text-foreground/80 truncate font-mono">{row.품목}</span>}
                    {row.제조번호 && <span className="text-xs text-muted-foreground font-mono truncate">{row.제조번호}</span>}
                  </div>
                </div>
                {(row.전화번호 || row.주소) && (
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {row.전화번호 && (
                      <a href={`tel:${row.전화번호}`} className="flex items-center gap-1.5 hover:text-primary tabular-nums w-fit">
                        <Phone className="h-3.5 w-3.5" /> {row.전화번호}
                      </a>
                    )}
                    {row.주소 && <span className="flex items-center gap-1.5 truncate"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{row.주소}</span></span>}
                  </div>
                )}
                {row.손님요구사항 && (
                  <button onClick={() => toggleReq(rowKey)} className="text-left text-sm bg-muted/60 rounded-xl px-3.5 py-2.5">
                    <span className={cn("leading-relaxed whitespace-pre-wrap", !reqExpanded && "line-clamp-2")}>{row.손님요구사항}</span>
                  </button>
                )}
                <div className="pt-2 border-t border-border/60 mt-auto">
                  <RowActions
                    status={status}
                    pendingCount={pendingNotes.length}
                    hasDraft={hasDraft}
                    onNote={() => setNoteRow(row)}
                    onDraft={() => setDraftRow(row)}
                    onEdit={() => { setEditRow(row); setFormOpen(true); }}
                    onNext={() => handleTransition(row)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

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

    </div>
  );
}
