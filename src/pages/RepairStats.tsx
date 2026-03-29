import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";
import { SheetRow, isCompleted, daysBetween, parseSheetDate, getTechnicianColor, formatSheetDateFull, getMachineTypeColor } from "@/types/operations";
import { TechBadge, BranchBadge } from "@/components/operations/StatusBadgeOps";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Download, RefreshCw, Wrench, ShoppingCart, TrendingUp, User, Package } from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatters";

type Period = "이번달" | "지난달" | "올해";
type Branch = "전체" | "장흥" | "강진";

function getPeriodRange(period: Period) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (period === "이번달") return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
  if (period === "지난달") return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
  return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
}

// 색상 팔레트 (영업사원별)
const SALES_COLORS = ["#16a34a", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];
function getSalesColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SALES_COLORS[Math.abs(hash) % SALES_COLORS.length];
}

export default function RepairStats() {
  const { allWithArchive, isLoading: sheetsLoading, refresh } = useGoogleSheets();
  const [period, setPeriod] = useState<Period>("올해");
  const [branch, setBranch] = useState<Branch>("전체");
  const [techFilter, setTechFilter] = useState("전체");
  const [mainTab, setMainTab] = useState<"repair" | "sales">("repair");

  // 판매된 기계 데이터 (영업 실적용)
  const { data: soldMachines, isLoading: salesLoading } = useQuery({
    queryKey: ["machines-sold"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("*, customers(name)")
        .not("sale_date", "is", null)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 3,
  });

  const range = useMemo(() => getPeriodRange(period), [period]);

  // ── 수리 실적 ──
  const completed = useMemo(() => allWithArchive.filter(r => isCompleted(r.전체완료)), [allWithArchive]);

  const filteredRepairs = useMemo(() => {
    let rows = completed.filter(r => {
      const d = parseSheetDate(r.출고일) || parseSheetDate(r.수리완료일);
      if (!d) return true;
      return d >= range.from && d <= range.to;
    });
    if (branch !== "전체") rows = rows.filter(r => r._branch === branch);
    if (techFilter !== "전체") rows = rows.filter(r => r.수리기사 === techFilter);
    return rows;
  }, [completed, range, branch, techFilter]);

  const technicians = useMemo(() => {
    const set = new Set(completed.map(r => r.수리기사).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [completed]);

  const thisMonth = useMemo(() => {
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
  }, []);

  const techCards = useMemo(() => {
    const map = new Map<string, SheetRow[]>();
    filteredRepairs.forEach(r => {
      const key = r.수리기사 || "미배정";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries())
      .map(([name, rows]) => {
        const days = rows.map(r => daysBetween(r.입고일, r.수리완료일)).filter((d): d is number => d !== null);
        const avgDays = days.length ? (days.reduce((a, b) => a + b, 0) / days.length).toFixed(1) : "-";
        const itemCounts = new Map<string, number>();
        rows.forEach(r => { if (r.기계) itemCounts.set(r.기계, (itemCounts.get(r.기계) || 0) + 1); });
        const topItems = Array.from(itemCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const jh = rows.filter(r => r._branch === "장흥").length;
        const gj = rows.filter(r => r._branch === "강진").length;
        const thisMonthCount = rows.filter(r => {
          const d = parseSheetDate(r.출고일) || parseSheetDate(r.수리완료일);
          return d && d >= thisMonth.from && d <= thisMonth.to;
        }).length;
        return { name, count: rows.length, avgDays, topItems, jh, gj, thisMonthCount };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredRepairs, thisMonth]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    filteredRepairs.forEach(r => {
      const d = parseSheetDate(r.출고일) || parseSheetDate(r.수리완료일);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const tech = r.수리기사 || "미배정";
      if (!map.has(key)) map.set(key, new Map());
      map.get(key)!.set(tech, (map.get(key)!.get(tech) || 0) + 1);
    });
    const allTechs = Array.from(new Set(filteredRepairs.map(r => r.수리기사 || "미배정")));
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, techMap]) => {
        const entry: Record<string, any> = { month };
        allTechs.forEach(t => { entry[t] = techMap.get(t) || 0; });
        return entry;
      });
  }, [filteredRepairs]);

  const monthlyTechs = useMemo(() => Array.from(new Set(filteredRepairs.map(r => r.수리기사 || "미배정"))), [filteredRepairs]);
  const chartConfig = Object.fromEntries(monthlyTechs.map(t => [t, { label: t, color: getTechnicianColor(t) }]));

  // ── 영업 실적 ──
  const filteredSales = useMemo(() => {
    if (!soldMachines) return [];
    return soldMachines.filter(m => {
      if (!m.sale_date) return false;
      const d = new Date(m.sale_date);
      return d >= range.from && d <= range.to;
    });
  }, [soldMachines, range]);

  // 영업사원별 집계
  const salesCards = useMemo(() => {
    const map = new Map<string, typeof filteredSales>();
    filteredSales.forEach(m => {
      const key = (m as any).salesperson || "미배정";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return Array.from(map.entries())
      .map(([name, machines]) => {
        const totalRevenue = machines.reduce((s, m) => s + (m.sale_price ?? 0), 0);
        const newCount = machines.filter(m => m.machine_type === "새기계").length;
        const usedCount = machines.filter(m => m.machine_type === "중고기계").length;
        const thisMonthCount = machines.filter(m => {
          const d = m.sale_date ? new Date(m.sale_date) : null;
          return d && d >= thisMonth.from && d <= thisMonth.to;
        }).length;
        // 기계 종류별 집계
        const typeCounts = new Map<string, number>();
        machines.forEach(m => {
          const key = m.model_name.split(" ")[0]; // 모델명 첫 단어
          typeCounts.set(key, (typeCounts.get(key) || 0) + 1);
        });
        const topModels = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
        return { name, count: machines.length, totalRevenue, newCount, usedCount, thisMonthCount, topModels };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredSales, thisMonth]);

  // 월별 판매 차트 데이터
  const monthlySalesData = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    filteredSales.forEach(m => {
      if (!m.sale_date) return;
      const d = new Date(m.sale_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(key) || { count: 0, revenue: 0 };
      map.set(key, { count: cur.count + 1, revenue: cur.revenue + (m.sale_price ?? 0) });
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, d]) => ({ month, 판매건수: d.count, 매출액: Math.round(d.revenue / 10000) }));
  }, [filteredSales]);

  const totalSalesRevenue = filteredSales.reduce((s, m) => s + (m.sale_price ?? 0), 0);
  const totalSalesCount = filteredSales.length;

  const exportCSV = () => {
    const headers = ["손님성명", "기계", "품목", "수리기사", "요구사항", "입고일", "수리완료일", "출고일", "수리기간", "위치"];
    const csvRows = [headers.join(",")];
    filteredRepairs.forEach(r => {
      const days = daysBetween(r.입고일, r.수리완료일);
      csvRows.push([r.손님성명, r.기계, r.품목, r.수리기사, `"${r.손님요구사항.replace(/"/g, '""')}"`, r.입고일, r.수리완료일, r.출고일, days !== null ? `${days}` : "", r._branch].join(","));
    });
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    a.href = url;
    a.download = `수리실적_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = sheetsLoading;

  if (isLoading) return (
    <div className="space-y-6">
      <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* 헤더 + 공통 필터 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          <Tabs value={period} onValueChange={v => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="이번달">이번달</TabsTrigger>
              <TabsTrigger value="지난달">지난달</TabsTrigger>
              <TabsTrigger value="올해">올해</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={branch} onValueChange={v => setBranch(v as Branch)}>
            <TabsList>
              <TabsTrigger value="전체">전체</TabsTrigger>
              <TabsTrigger value="장흥">장흥</TabsTrigger>
              <TabsTrigger value="강진">강진</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCSV} variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button onClick={refresh} variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-1" /> 새로고침</Button>
        </div>
      </div>

      {/* 메인 탭 - 수리실적 / 영업실적 */}
      <Tabs value={mainTab} onValueChange={v => setMainTab(v as "repair" | "sales")}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="repair" className="gap-1.5 flex-1 sm:flex-none">
            <Wrench className="h-4 w-4" /> 수리 실적
            <span className="ml-1 text-[11px] bg-muted/50 rounded px-1.5 py-0.5">{filteredRepairs.length}</span>
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-1.5 flex-1 sm:flex-none">
            <ShoppingCart className="h-4 w-4" /> 영업 실적
            <span className="ml-1 text-[11px] bg-muted/50 rounded px-1.5 py-0.5">{totalSalesCount}</span>
          </TabsTrigger>
        </TabsList>

        {/* ── 수리 실적 탭 ── */}
        <TabsContent value="repair" className="space-y-6 mt-4">
          {/* 기사 필터 */}
          <Select value={techFilter} onValueChange={setTechFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="기사 선택" /></SelectTrigger>
            <SelectContent>{technicians.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>

          {/* 기사별 실적 카드 */}
          <div>
            <h3 className="text-base font-bold mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" /> 기사별 실적
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {techCards.map(tc => (
                <Card key={tc.name} className="border-0 shadow-card">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: getTechnicianColor(tc.name) }}>
                        {tc.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{tc.name}</p>
                        <p className="text-xs text-muted-foreground">장흥 {tc.jh}건 · 강진 {tc.gj}건</p>
                      </div>
                      {tc.thisMonthCount > 0 && (
                        <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium shrink-0">
                          이번달 {tc.thisMonthCount}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-5 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">완료</p>
                        <p className="text-2xl font-bold tabular-nums">{tc.count}<span className="text-sm font-normal text-muted-foreground ml-0.5">건</span></p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">평균 수리일</p>
                        <p className="text-2xl font-bold tabular-nums">{tc.avgDays}<span className="text-sm font-normal text-muted-foreground ml-0.5">일</span></p>
                      </div>
                    </div>
                    {tc.topItems.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tc.topItems.map(([name, cnt]) => {
                          const mc = getMachineTypeColor(name);
                          return (
                            <span key={name} className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${mc.bg} ${mc.text}`}>
                              {name} ({cnt})
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {techCards.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">데이터가 없습니다</p>}
            </div>
          </div>

          {/* 월별 차트 */}
          {monthlyData.length > 0 && (
            <div>
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" /> 월별 완료 건수
              </h3>
              <Card className="border-0 shadow-card">
                <CardContent className="pt-4">
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {monthlyTechs.map(t => (
                        <Bar key={t} dataKey={t} stackId="a" fill={getTechnicianColor(t)} radius={t === monthlyTechs[monthlyTechs.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 완료 상세 테이블 */}
          <div>
            <h3 className="text-base font-bold mb-3">완료 상세</h3>
            <Card className="border-0 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs">손님 성명</TableHead>
                      <TableHead className="text-xs">기계</TableHead>
                      <TableHead className="text-xs">모델</TableHead>
                      <TableHead className="text-xs">수리기사</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">요구사항</TableHead>
                      <TableHead className="text-xs">입고일</TableHead>
                      <TableHead className="text-xs">완료일</TableHead>
                      <TableHead className="text-xs">수리기간</TableHead>
                      <TableHead className="text-xs">지점</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRepairs.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">데이터가 없습니다</TableCell></TableRow>
                    ) : filteredRepairs.map((r, i) => {
                      const days = daysBetween(r.입고일, r.수리완료일);
                      return (
                        <TableRow key={i} className="hover:bg-muted/20">
                          <TableCell className="font-medium text-sm">{r.손님성명}</TableCell>
                          <TableCell className="text-sm">{r.기계}</TableCell>
                          <TableCell className="text-sm">{r.품목}</TableCell>
                          <TableCell>{r.수리기사 ? <TechBadge name={r.수리기사} /> : <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                          <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground hidden lg:table-cell">{r.손님요구사항}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatSheetDateFull(r.입고일)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatSheetDateFull(r.수리완료일)}</TableCell>
                          <TableCell className="text-sm tabular-nums">{days !== null ? `${days}일` : "-"}</TableCell>
                          <TableCell><BranchBadge branch={r._branch} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4 py-2 border-t text-xs text-muted-foreground text-right">{filteredRepairs.length}건</div>
            </Card>
          </div>
        </TabsContent>

        {/* ── 영업 실적 탭 ── */}
        <TabsContent value="sales" className="space-y-6 mt-4">
          {salesLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
          ) : (
            <>
              {/* 요약 KPI */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Card className="border-0 shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-primary/10"><ShoppingCart className="h-4 w-4 text-primary" /></div>
                      <p className="text-xs text-muted-foreground">판매 대수</p>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">{totalSalesCount}<span className="text-sm font-normal text-muted-foreground ml-1">대</span></p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-success/10"><TrendingUp className="h-4 w-4 text-success" /></div>
                      <p className="text-xs text-muted-foreground">총 매출</p>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">{Math.round(totalSalesRevenue / 10000).toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-1">만원</span></p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-card sm:col-span-1 col-span-2">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-info/10"><Package className="h-4 w-4 text-info" /></div>
                      <p className="text-xs text-muted-foreground">새기계 / 중고</p>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {filteredSales.filter(m => m.machine_type === "새기계").length}
                      <span className="text-sm font-normal text-muted-foreground ml-1">/ {filteredSales.filter(m => m.machine_type === "중고기계").length}</span>
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* 영업사원별 실적 카드 */}
              <div>
                <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" /> 영업사원별 실적
                </h3>
                {salesCards.length === 0 ? (
                  <Card className="border-0 shadow-card">
                    <CardContent className="py-12 text-center text-muted-foreground text-sm">
                      해당 기간 판매 내역이 없습니다.<br />
                      <span className="text-xs mt-1 block">기계 등록 시 영업사원을 입력하면 여기에 표시됩니다.</span>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {salesCards.map(sc => (
                      <Card key={sc.name} className="border-0 shadow-card">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: getSalesColor(sc.name) }}>
                              {sc.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{sc.name}</p>
                              <p className="text-xs text-muted-foreground">새기계 {sc.newCount} · 중고 {sc.usedCount}</p>
                            </div>
                            {sc.thisMonthCount > 0 && (
                              <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium shrink-0">
                                이번달 {sc.thisMonthCount}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-5">
                            <div>
                              <p className="text-xs text-muted-foreground">판매</p>
                              <p className="text-2xl font-bold tabular-nums">{sc.count}<span className="text-sm font-normal text-muted-foreground ml-0.5">대</span></p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">매출</p>
                              <p className="text-2xl font-bold tabular-nums">{Math.round(sc.totalRevenue / 10000).toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-0.5">만</span></p>
                            </div>
                          </div>
                          {sc.topModels.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {sc.topModels.map(([name, cnt]) => (
                                <span key={name} className="text-xs bg-muted px-2 py-0.5 rounded-md text-muted-foreground">
                                  {name} ({cnt})
                                </span>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* 월별 판매 차트 */}
              {monthlySalesData.length > 1 && (
                <div>
                  <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" /> 월별 판매 현황
                  </h3>
                  <Card className="border-0 shadow-card">
                    <CardContent className="pt-4">
                      <ChartContainer config={{ 판매건수: { label: "판매건수", color: "#16a34a" }, 매출액: { label: "매출(만원)", color: "#3b82f6" } }} className="h-[240px] w-full">
                        <BarChart data={monthlySalesData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar yAxisId="left" dataKey="판매건수" fill="#16a34a" radius={[4, 4, 0, 0]} />
                          <Bar yAxisId="right" dataKey="매출액" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 판매 상세 테이블 */}
              <div>
                <h3 className="text-base font-bold mb-3">판매 상세</h3>
                <Card className="border-0 shadow-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-xs">판매일</TableHead>
                          <TableHead className="text-xs">모델명</TableHead>
                          <TableHead className="text-xs">구분</TableHead>
                          <TableHead className="text-xs">고객</TableHead>
                          <TableHead className="text-xs">영업사원</TableHead>
                          <TableHead className="text-xs text-right">판매가</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSales.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">데이터가 없습니다</TableCell></TableRow>
                        ) : filteredSales.map((m, i) => (
                          <TableRow key={i} className="hover:bg-muted/20">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(m.sale_date!)}</TableCell>
                            <TableCell className="font-medium text-sm">{m.model_name}</TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.machine_type === "새기계" ? "bg-info/10 text-info" : "bg-warning/10 text-warning"}`}>
                                {m.machine_type}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">{(m as any).customers?.name ?? "-"}</TableCell>
                            <TableCell className="text-sm">{(m as any).salesperson ?? <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums text-sm">
                              {m.sale_price ? formatPrice(m.sale_price) : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-4 py-2 border-t text-xs text-muted-foreground text-right">{filteredSales.length}건 · 합계 {Math.round(totalSalesRevenue / 10000).toLocaleString()}만원</div>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
