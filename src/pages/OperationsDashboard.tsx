import { useState, useMemo } from "react";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";
import { SheetRow, getStatus, isCompleted, OperationStatus } from "@/types/operations";
import { KPICards } from "@/components/operations/KPICards";
import { OperationsTable } from "@/components/operations/OperationsTable";
import { TechnicianSection } from "@/components/operations/TechnicianSection";
import { SchedulePanels } from "@/components/operations/SchedulePanels";
import { CompletedTab } from "@/components/operations/CompletedTab";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

type Branch = "전체" | "장흥" | "강진";
type ViewTab = "진행중" | "완료됨";

export default function OperationsDashboard() {
  const { allData, jangheungData, gangjinData, isLoading, error, lastUpdated, refresh } = useGoogleSheets();
  const [branch, setBranch] = useState<Branch>("전체");
  const [viewTab, setViewTab] = useState<ViewTab>("진행중");
  const [statusFilter, setStatusFilter] = useState<OperationStatus | null>(null);

  const branchData = useMemo(() => {
    if (branch === "장흥") return jangheungData;
    if (branch === "강진") return gangjinData;
    return allData;
  }, [branch, allData, jangheungData, gangjinData]);

  const activeData = useMemo(() => branchData.filter(r => !isCompleted(r.전체완료)), [branchData]);
  const completedData = useMemo(() => branchData.filter(r => isCompleted(r.전체완료)), [branchData]);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">작업현황판</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              최종 업데이트: {lastUpdated.toLocaleTimeString("ko-KR")}
            </span>
          )}
          <Button onClick={refresh} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> 새로고침
          </Button>
        </div>
      </div>

      {/* Branch toggle */}
      <Tabs value={branch} onValueChange={v => { setBranch(v as Branch); setStatusFilter(null); }}>
        <TabsList>
          <TabsTrigger value="전체">전체</TabsTrigger>
          <TabsTrigger value="장흥">장흥</TabsTrigger>
          <TabsTrigger value="강진">강진</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* View tab */}
      <Tabs value={viewTab} onValueChange={v => setViewTab(v as ViewTab)}>
        <TabsList>
          <TabsTrigger value="진행중">진행중 ({activeData.length})</TabsTrigger>
          <TabsTrigger value="완료됨">완료됨 ({completedData.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : viewTab === "진행중" ? (
        <>
          <KPICards data={branchData} activeFilter={statusFilter} onFilter={setStatusFilter} />
          <OperationsTable data={activeData} statusFilter={statusFilter} />
          <TechnicianSection data={activeData} />
          <SchedulePanels data={activeData} />
        </>
      ) : (
        <CompletedTab data={completedData} />
      )}

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
