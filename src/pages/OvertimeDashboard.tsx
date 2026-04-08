import { useState } from "react";
import { RefreshCw, Clock, User, AlertTriangle, LogIn, LogOut, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
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
import {
  useOvertimeData,
  TECHNICIANS,
  TechnicianData,
  minutesToTime,
  timeToMinutes,
  type TechnicianName,
} from "@/hooks/useOvertimeData";
import TechnicianMap from "@/components/TechnicianMap";

const TECH_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  유호상: { bg: "bg-blue-50", text: "text-blue-700", accent: "bg-blue-500" },
  마성수: { bg: "bg-emerald-50", text: "text-emerald-700", accent: "bg-emerald-500" },
  김영일: { bg: "bg-amber-50", text: "text-amber-700", accent: "bg-amber-500" },
  이재현: { bg: "bg-purple-50", text: "text-purple-700", accent: "bg-purple-500" },
  이동진: { bg: "bg-rose-50", text: "text-rose-700", accent: "bg-rose-500" },
  주희로: { bg: "bg-cyan-50", text: "text-cyan-700", accent: "bg-cyan-500" },
};

function TechnicianCard({
  data,
  isLoading,
  isError,
  onRetry,
  onClockIn,
  onClockOut,
  isClocking,
}: {
  data?: TechnicianData;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onClockIn: () => void;
  onClockOut: () => void;
  isClocking: boolean;
}) {
  const name = data?.name || "";
  const colors = TECH_COLORS[name] || TECH_COLORS["유호상"];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-5 flex flex-col items-center gap-2 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{name || "기사"} 데이터 로드 실패</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            재시도
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentMonth = minutesToTime(data.currentMonthSummary?.y2026Minutes || 0);
  const yearTotal = minutesToTime(data.totals?.y2026Minutes || 0);

  // Last 3 months for mini bar chart
  const now = new Date();
  const currentMonthIdx = now.getMonth(); // 0-based
  const recentMonths = data.monthlySummary
    .filter((s) => {
      const mNum = parseInt(s.month);
      return mNum >= currentMonthIdx - 1 && mNum <= currentMonthIdx + 1;
    })
    .slice(-3);

  const maxMin = Math.max(...recentMonths.map((m) => m.y2026Minutes), 1);

  return (
    <Card className={`border-l-4 ${colors.bg}`} style={{ borderLeftColor: `var(--${name})` }}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-full ${colors.accent} flex items-center justify-center`}>
            <User className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg">{name}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">이번달 초과</p>
            <p className={`text-xl font-bold ${colors.text}`}>{currentMonth}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">올해 누적</p>
            <p className="text-xl font-bold">{yearTotal}</p>
          </div>
        </div>

        {recentMonths.length > 0 && (
          <div className="space-y-1.5">
            {recentMonths.map((m) => (
              <div key={m.month} className="flex items-center gap-2 text-xs">
                <span className="w-8 text-muted-foreground">{m.month}</span>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors.accent} rounded-full transition-all`}
                    style={{ width: `${Math.max((m.y2026Minutes / maxMin) * 100, 2)}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono">{minutesToTime(m.y2026Minutes)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Clock In / Out Buttons */}
        <div className="flex gap-2 mt-4 pt-3 border-t">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
            onClick={onClockIn}
            disabled={isClocking}
          >
            <LogIn className="h-4 w-4 mr-1" />
            출근
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-rose-600 border-rose-300 hover:bg-rose-50"
            onClick={onClockOut}
            disabled={isClocking}
          >
            <LogOut className="h-4 w-4 mr-1" />
            퇴근
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyTable({ data }: { data: TechnicianData }) {
  const currentMonthLabel = `${new Date().getMonth() + 1}월`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium">월</th>
            <th className="text-right py-2 px-3 font-medium">2025년</th>
            <th className="text-right py-2 px-3 font-medium">2026년</th>
            <th className="text-right py-2 px-3 font-medium">연간소계</th>
          </tr>
        </thead>
        <tbody>
          {data.monthlySummary.map((row) => (
            <tr
              key={row.month}
              className={`border-b ${row.month === currentMonthLabel ? "bg-green-50" : ""}`}
            >
              <td className="py-2 px-3">{row.month}</td>
              <td className="py-2 px-3 text-right font-mono">{row.y2025 || "-"}</td>
              <td className="py-2 px-3 text-right font-mono">{row.y2026 || "-"}</td>
              <td className="py-2 px-3 text-right font-mono">{row.yearTotal || "-"}</td>
            </tr>
          ))}
          {data.totals && (
            <tr className="border-t-2 font-bold">
              <td className="py-2 px-3">{data.totals.month}</td>
              <td className="py-2 px-3 text-right font-mono">{data.totals.y2025 || "-"}</td>
              <td className="py-2 px-3 text-right font-mono">{data.totals.y2026 || "-"}</td>
              <td className="py-2 px-3 text-right font-mono">{data.totals.yearTotal || "-"}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DailyTable({ data }: { data: TechnicianData }) {
  const [filter, setFilter] = useState<"thisMonth" | "lastMonth" | "all">("thisMonth");

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();

  const filtered = data.dailyRecords.filter((r) => {
    if (filter === "all") return true;
    // Try to parse date like "3.10" or "2026-03-10" etc.
    const parts = r.date.split(/[.\-\/]/);
    if (parts.length >= 2) {
      const month = parseInt(parts[parts.length === 3 ? 1 : 0]);
      if (filter === "thisMonth") return month === thisMonth;
      if (filter === "lastMonth") return month === (thisMonth === 1 ? 12 : thisMonth - 1);
    }
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(
          [
            ["thisMonth", "이번달"],
            ["lastMonth", "지난달"],
            ["all", "전체"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "default" : "outline"}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 font-medium">날짜</th>
              <th className="text-right py-2 px-3 font-medium">출근</th>
              <th className="text-right py-2 px-3 font-medium">퇴근</th>
              <th className="text-right py-2 px-3 font-medium">오전초과</th>
              <th className="text-right py-2 px-3 font-medium">오후초과</th>
              <th className="text-right py-2 px-3 font-medium">일일합계</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const mins = r.dailyTotalMinutes;
              const rowBg = mins > 180 ? "bg-orange-50" : mins > 120 ? "bg-yellow-50" : "";
              return (
                <tr key={i} className={`border-b ${rowBg}`}>
                  <td className="py-2 px-3">{r.date}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.startTime || "-"}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.endTime || "-"}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.morningOT || "-"}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.afternoonOT || "-"}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">{r.dailyTotal || "-"}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  데이터가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OvertimeDashboard() {
  const { queries, allData, isLoading, lastUpdated, refresh, clockInMutation, clockOutMutation } = useOvertimeData();
  const [selectedTab, setSelectedTab] = useState<string>(TECHNICIANS[0]);
  const [confirmAction, setConfirmAction] = useState<{ type: "in" | "out"; name: TechnicianName } | null>(null);
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const mutation = confirmAction.type === "in" ? clockInMutation : clockOutMutation;
    const label = confirmAction.type === "in" ? "출근" : "퇴근";
    try {
      const result = await mutation.mutateAsync(confirmAction.name);
      const locMsg = result?.position
        ? ` (위치: ${result.position.latitude.toFixed(4)}, ${result.position.longitude.toFixed(4)})`
        : " (위치 정보 없음)";
      toast({ title: `${confirmAction.name} ${label} 완료`, description: `${label} 시간이 기록되었습니다.${locMsg}` });
    } catch (err: any) {
      toast({ title: "오류", description: err.message || `${label} 기록에 실패했습니다.`, variant: "destructive" });
    } finally {
      setConfirmAction(null);
    }
  };

  // Summary totals
  const totalCurrentMonth = allData.reduce(
    (sum, d) => sum + (d.currentMonthSummary?.y2026Minutes || 0),
    0
  );
  const totalYearAccum = allData.reduce((sum, d) => sum + (d.totals?.y2026Minutes || 0), 0);
  const isMutating = clockInMutation.isPending || clockOutMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            초과근무 현황
          </h1>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              마지막 업데이트: {lastUpdated.toLocaleTimeString("ko-KR")}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {/* Technician Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TECHNICIANS.map((name, i) => (
          <TechnicianCard
            key={name}
            data={queries[i].data}
            isLoading={queries[i].isLoading}
            isError={queries[i].isError}
            onRetry={() => queries[i].refetch()}
            onClockIn={() => setConfirmAction({ type: "in", name })}
            onClockOut={() => setConfirmAction({ type: "out", name })}
            isClocking={isMutating}
          />
        ))}
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.name} {confirmAction?.type === "in" ? "출근" : "퇴근"} 기록
            </AlertDialogTitle>
            <AlertDialogDescription>
              현재 시간으로 {confirmAction?.type === "in" ? "출근" : "퇴근"}을 기록하시겠습니까?
              <span className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                위치 정보도 함께 기록됩니다
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isMutating}>
              {isMutating ? "처리 중..." : "확인"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Summary Bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-8 items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">전체 이번달 초과 합계</p>
              <p className="text-xl font-bold text-primary">{minutesToTime(totalCurrentMonth)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">전체 올해 누적 합계</p>
              <p className="text-xl font-bold">{minutesToTime(totalYearAccum)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Tabs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">상세 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {TECHNICIANS.map((name) => {
                const colors = TECH_COLORS[name];
                return (
                  <TabsTrigger key={name} value={name} className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${colors?.accent || "bg-muted"}`}
                    />
                    {name}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {TECHNICIANS.map((name, i) => {
              const data = queries[i].data;
              if (!data) {
                return (
                  <TabsContent key={name} value={name}>
                    <div className="py-8 text-center text-muted-foreground">
                      {queries[i].isLoading ? "로딩 중..." : "데이터를 불러올 수 없습니다"}
                    </div>
                  </TabsContent>
                );
              }
              return (
                <TabsContent key={name} value={name} className="space-y-4 mt-4">
                  <h3 className="font-semibold">월별 초과근무</h3>
                  <MonthlyTable data={data} />

                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between">
                        일별 상세 기록
                        <Badge variant="secondary">{data.dailyRecords.length}건</Badge>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <DailyTable data={data} />
                    </CollapsibleContent>
                  </Collapsible>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
