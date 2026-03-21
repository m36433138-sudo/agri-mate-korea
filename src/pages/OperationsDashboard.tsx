import { useState, useMemo } from "react";
import { useGoogleSheets, markRowComplete } from "@/hooks/useGoogleSheets";
import { SheetRow, getStatus, isCompleted, OperationStatus } from "@/types/operations";
import { KanbanCard } from "@/components/operations/KanbanCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw, AlertCircle } from "lucide-react";

type Branch = "전체" | "장흥" | "강진";

const COLUMNS: { status: OperationStatus; label: string; color: string }[] = [
  { status: "입고대기", label: "입고대기", color: "#f97316" },
  { status: "수리중", label: "수리중", color: "#3b82f6" },
  { status: "출고대기", label: "출고대기", color: "#16a34a" },
  { status: "완료", label: "완료", color: "#6b7280" },
];

export default function OperationsDashboard() {
  const { allData, isLoading, error, lastUpdated, refresh } = useGoogleSheets();
  const [branch, setBranch] = useState<Branch>("전체");
  const [techFilter, setTechFilter] = useState("전체");
  const [mobileTab, setMobileTab] = useState<OperationStatus>("입고대기");
  const [confirmRow, setConfirmRow] = useState<SheetRow | null>(null);
  const [isMarking, setIsMarking] = useState(false);
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
    const map: Record<OperationStatus, SheetRow[]> = { 입고대기: [], 수리중: [], 출고대기: [], 완료: [] };
    branchData.forEach(row => {
      const s = getStatus(row);
      map[s].push(row);
    });
    return map;
  }, [branchData]);

  const handleMarkComplete = async () => {
    if (!confirmRow) return;
    setIsMarking(true);
    try {
      const sheetName = confirmRow._branch === "장흥" ? "장흥(입출수)" : "강진(입출수)";
      await markRowComplete(sheetName, confirmRow._rowIndex, confirmRow._doneCol);
      toast({ title: "완료 처리되었습니다", description: `${confirmRow.손님성명}님의 작업이 완료 처리되었습니다.` });
      refresh();
    } catch (err: any) {
      toast({ title: "오류", description: err.message || "완료 처리에 실패했습니다.", variant: "destructive" });
    } finally {
      setIsMarking(false);
      setConfirmRow(null);
    }
  };

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">작업현황판</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              {lastUpdated.toLocaleTimeString("ko-KR")}
            </span>
          )}
          <Button onClick={refresh} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> 새로고침
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          ))}
        </div>
      ) : isMobile ? (
        /* Mobile: tabs + vertical cards */
        <>
          <Tabs value={mobileTab} onValueChange={v => setMobileTab(v as OperationStatus)}>
            <TabsList className="w-full grid grid-cols-4">
              {COLUMNS.map(col => (
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
                  color={COLUMNS.find(c => c.status === mobileTab)!.color}
                  onMarkComplete={setConfirmRow}
                />
              ))
            )}
          </div>
        </>
      ) : (
        /* Desktop: 4-column Kanban */
        <div className="grid grid-cols-4 gap-4 items-start">
          {COLUMNS.map(col => (
            <div key={col.status} className="space-y-2">
              {/* Column header */}
              <div className="flex items-center gap-2 px-1 pb-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="font-semibold text-sm">{col.label}</span>
                <span className="ml-auto text-xs font-medium rounded-full px-2 py-0.5" style={{ backgroundColor: col.color + "18", color: col.color }}>
                  {columnData[col.status].length}
                </span>
              </div>
              {/* Cards */}
              <div className="space-y-2 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
                {columnData[col.status].length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6 bg-muted/30 rounded-xl">없음</p>
                ) : (
                  columnData[col.status].map((row, i) => (
                    <KanbanCard
                      key={`${row._branch}-${row._rowIndex}-${i}`}
                      row={row}
                      color={col.color}
                      onMarkComplete={setConfirmRow}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmRow} onOpenChange={open => !open && setConfirmRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>완료 처리하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRow && `${confirmRow.손님성명}님의 ${confirmRow.기계} ${confirmRow.품목} 작업을 완료 처리합니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMarking}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkComplete} disabled={isMarking}>
              {isMarking ? "처리 중..." : "완료 처리"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
