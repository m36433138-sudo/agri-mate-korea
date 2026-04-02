import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";
import {
  SheetRow, isCompleted, daysBetween, parseSheetDate,
  getTechnicianColor, formatSheetDateFull, getMachineTypeColor,
} from "@/types/operations";
import { TechBadge, BranchBadge } from "@/components/operations/StatusBadgeOps";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, RefreshCw, Wrench, ShoppingCart, TrendingUp, User, Package } from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatters";

type Period = "이번달" | "지난달" | "3개월" | "올해";
type Branch = "전체" | "장흥" | "강진";

function getPeriodRange(period: Period) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (period === "이번달") return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
  if (period === "지난달") return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
  if (period === "3개월") return { from: new Date(y, m - 2, 1), to: new Date(y, m + 1, 0) };
  return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
}

// 수리기사 필드에서 이름 배열 추출 (공동작업 "홍길동/김철수" → ["홍길동", "김철수"])
function parseTechNames(raw: string): string[] {
  if (!raw || !raw.trim()) return ["미배정"];
  return raw
    .split(/[/,&·+×\s]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// 영업사원 색상
const SALES_COLORS = ["#16a34a", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];
function getSalesColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SALES_COLORS[Math.abs(hash) % SALES_COLORS.length];
}

// 월 레이블 생성 (YYYY-MM → "1월")
function monthLabel(key: string) {
  const [, m] = key.split("-");
  return `${parseInt(m)}월`;
}

// 최근 N개월 키 목록 생성
function getRecentMonthKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    keys.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

// 미니 스파크바 컴포넌트 (기사 카드 내 월별 추이)
function SparkBar({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm min-h-[2px] transition-all"
          style={{ height: `${Math.round((v / max) * 100)}%`, backgroundColor: v > 0 ? color : "#e5e7eb" }}
          title={`${v}건`}
        />
      ))}
    </div>
  );
}

export default function RepairStats() {
  const { allWithArchive, isLoading: sheetsLoading, refresh } = useGoogleSheets();
  const [period, setPeriod] = useState<Period>("올해");
  const [branch, setBranch] = useState<Branch>("전체");
  const [techFilter, setTechFilter] = useState("전체");
  const [mainTab, setMainTab] = useState<"repair" | "sales">("repair");

  // 판매 기계 (영업 실적)
  const { data: soldMachines, isLoading: salesLoading } = useQuery({
    queryKey: ["machines-sold"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("*, customers(name)")
        .not("sale_date", "is", null)
        .neq("machine_type", "타사구매")
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 3,
  });

  const range = useMemo(() => getPeriodRange(period), [period]);

  // 완료된 항목만
  const completed = useMemo(
    () => allWithArchive.filter(r => isCompleted(r.전체완료)),
    [allWithArchive]
  );

  // 기간 + 지점 필터 적용 (입고일 기준, 날짜 없는 항목은 항상 포함)
  const filteredRepairs = useMemo(() => {
    let rows = completed.filter(r => {
      const d = parseSheetDate(r.입고일); // 입고일 기준
      if (!d) return true; // 날짜 없는 항목도 포함 (기사 확인 가능)
      return d >= range.from && d <= range.to;
    });
    if (branch !== "전체") rows = rows.filter(r => r._branch === branch);
    // 기사 필터 적용 시 split된 이름 중에 포함되면 OK
    if (techFilter !== "전체") {
      rows = rows.filter(r => parseTechNames(r.수리기사).includes(techFilter));
    }
    return rows;
  }, [completed, range, branch, techFilter]);

  // 전체 기사 목록 (split 후 고유값)
  const technicians = useMemo(() => {
    const set = new Set<string>();
    completed.forEach(r => parseTechNames(r.수리기사).forEach(n => set.add(n)));
    set.delete("미배정");
    return ["전체", ...Array.from(set).sort(), "미배정"];
  }, [completed]);

  // 기간 내 월 목록
  const monthKeys = useMemo(() => getRecentMonthKeys(range.from, range.to), [range]);

  // 기사별 집계 (공동작업은 각자에게 카운트)
  const techCards = useMemo(() => {
    const map = new Map<string, { rows: SheetRow[]; monthMap: Map<string, number> }>();

    filteredRepairs.forEach(r => {
      const names = parseTechNames(r.수리기사);
      const d = parseSheetDate(r.입고일); // 입고일 기준
      const monthKey = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : null;

      names.forEach(name => {
        if (!map.has(name)) map.set(name, { rows: [], monthMap: new Map() });
        const entry = map.get(name)!;
        entry.rows.push(r);
        if (monthKey) {
          entry.monthMap.set(monthKey, (entry.monthMap.get(monthKey) || 0) + 1);
        }
      });
    });

    return Array.from(map.entries())
      .map(([name, { rows, monthMap }]) => {
        const days = rows
          .map(r => daysBetween(r.입고일, r.수리완료일))
          .filter((d): d is number => d !== null);
        const avgDays = days.length
          ? (days.reduce((a, b) => a + b, 0) / days.length).toFixed(1)
          : "-";

        const machineCounts = new Map<string, number>();
        rows.forEach(r => {
          if (r.기계) machineCounts.set(r.기계, (machineCounts.get(r.기계) || 0) + 1);
        });
        const topItems = Array.from(machineCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        const jh = rows.filter(r => r._branch === "장흥").length;
        const gj = rows.filter(r => r._branch === "강진").length;

        // 이번 달 건수
        const now = new Date();
        const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const thisMonthCount = monthMap.get(thisMonthKey) || 0;

        // 스파크바용 월별 값
        const sparkValues = monthKeys.map(k => monthMap.get(k) || 0);

        // 공동작업 건수 (2명 이상인 row 수)
        const collaboCount = rows.filter(r => parseTechNames(r.수리기사).length > 1).length;

        return { name, count: rows.length, avgDays, topItems, jh, gj, thisMonthCount, monthMap, sparkValues, collaboCount };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredRepairs, monthKeys]);

  // 월별 × 기사별 그리드 데이터
  const techNames = useMemo(() => techCards.map(tc => tc.name), [techCards]);

  // CSV 내보내기
  const exportCSV = () => {
    const headers = ["손님성명", "기계", "품목", "수리기사", "요구사항", "입고일", "수리완료일", "출고일", "수리기간", "위치"];
    const csvRows = [headers.join(",")];
    filteredRepairs.forEach(r => {
      const days = daysBetween(r.입고일, r.수리완료일);
      csvRows.push([
        r.손님성명, r.기계, r.품목, r.수리기사,
        `"${r.손님요구사항.replace(/"/g, '""')}"`,
        r.입고일, r.수리완료일, r.출고일,
        days !== null ? `${days}` : "",
        r._branch,
      ].join(","));
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

  // ── 영업 실적 ──
  const filteredSales = useMemo(() => {
    if (!soldMachines) return [];
    return soldMachines.filter(m => {
      if (!m.sale_date) return false;
      const d = new Date(m.sale_date);
      return d >= range.from && d <= range.to;
    });
  }, [soldMachines, range]);

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
        const now = new Date();
        const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const thisMonthCount = machines.filter(m => {
          if (!m.sale_date) return false;
          const d = new Date(m.sale_date);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === thisMonthKey;
        }).length;
        const typeCounts = new Map<string, number>();
        machines.forEach(m => {
          const key = m.model_name.split(" ")[0];
          typeCounts.set(key, (typeCounts.get(key) || 0) + 1);
        });
        const topModels = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
        return { name, count: machines.length, totalRevenue, newCount, usedCount, thisMonthCount, topModels };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredSales]);

  const totalSalesRevenue = filteredSales.reduce((s, m) => s + (m.sale_price ?? 0), 0);

  if (sheetsLoading) return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* 공통 필터 + 액션 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          <Tabs value={period} onValueChange={v => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="이번달">이번달</TabsTrigger>
              <TabsTrigger value="지난달">지난달</TabsTrigger>
              <TabsTrigger value="3개월">3개월</TabsTrigger>
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
          <Button onClick={exportCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" /> 새로고침
          </Button>
        </div>
      </div>

      {/* 메인 탭 */}
      <Tabs value={mainTab} onValueChange={v => setMainTab(v as "repair" | "sales")}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="repair" className="gap-1.5 flex-1 sm:flex-none">
            <Wrench className="h-4 w-4" /> 수리 실적
            <span className="ml-1 text-[11px] bg-muted/50 rounded px-1.5 py-0.5">{filteredRepairs.length}</span>
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-1.5 flex-1 sm:flex-none">
            <ShoppingCart className="h-4 w-4" /> 영업 실적
            <span className="ml-1 text-[11px] bg-muted/50 rounded px-1.5 py-0.5">{filteredSales.length}</span>
          </TabsTrigger>
        </TabsList>

        {/* ══════════ 수리 실적 탭 ══════════ */}
        <TabsContent value="repair" className="space-y-6 mt-4">

          {/* 기사 필터 */}
          <div className="flex items-center gap-2">
            <Select value={techFilter} onValueChange={setTechFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="기사 선택" /></SelectTrigger>
              <SelectContent>
                {technicians.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">총 {filteredRepairs.length}건</span>
          </div>

          {/* ① 기사별 실적 카드 */}
          <div>
            <h3 className="text-base font-bold mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" /> 기사별 실적
            </h3>
            {techCards.length === 0 ? (
              <Card className="border-0 shadow-card">
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  해당 기간에 완료된 수리 내역이 없습니다.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {techCards.map(tc => {
                  const color = getTechnicianColor(tc.name);
                  return (
                    <Card key={tc.name} className="border-0 shadow-card overflow-hidden">
                      {/* 상단 색상 바 */}
                      <div className="h-1" style={{ backgroundColor: color }} />
                      <CardContent className="p-4 space-y-3">
                        {/* 이름 + 배지 */}
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            {tc.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{tc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              장흥 {tc.jh}건 · 강진 {tc.gj}건
                              {tc.collaboCount > 0 && (
                                <span className="ml-1 text-primary/70">· 공동 {tc.collaboCount}건</span>
                              )}
                            </p>
                          </div>
                          {tc.thisMonthCount > 0 && (
                            <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium shrink-0">
                              이번달 {tc.thisMonthCount}건
                            </span>
                          )}
                        </div>

                        {/* KPI 수치 */}
                        <div className="flex gap-5">
                          <div>
                            <p className="text-xs text-muted-foreground">완료</p>
                            <p className="text-2xl font-bold tabular-nums">
                              {tc.count}
                              <span className="text-sm font-normal text-muted-foreground ml-0.5">건</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">평균 수리일</p>
                            <p className="text-2xl font-bold tabular-nums">
                              {tc.avgDays}
                              <span className="text-sm font-normal text-muted-foreground ml-0.5">일</span>
                            </p>
                          </div>
                        </div>

                        {/* 월별 스파크 바 */}
                        {monthKeys.length > 1 && (
                          <div>
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>{monthLabel(monthKeys[0])}</span>
                              <span>{monthLabel(monthKeys[monthKeys.length - 1])}</span>
                            </div>
                            <SparkBar values={tc.sparkValues} color={color} />
                          </div>
                        )}

                        {/* 주요 기계 종류 */}
                        {tc.topItems.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
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
                  );
                })}
              </div>
            )}
          </div>

          {/* ② 월별 × 기사 매트릭스 그리드 */}
          {techCards.length > 0 && monthKeys.length > 0 && (
            <div>
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" /> 월별 작업 현황
              </h3>
              <Card className="border-0 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground w-28">기사</th>
                        {monthKeys.map(k => (
                          <th key={k} className="text-center px-3 py-2.5 font-semibold text-xs text-muted-foreground min-w-[56px]">
                            {monthLabel(k)}
                          </th>
                        ))}
                        <th className="text-center px-3 py-2.5 font-semibold text-xs text-muted-foreground">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {techCards.map(tc => {
                        const color = getTechnicianColor(tc.name);
                        const monthMax = Math.max(...techCards.flatMap(t => monthKeys.map(k => t.monthMap.get(k) || 0)), 1);
                        return (
                          <tr key={tc.name} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            {/* 기사명 */}
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                  style={{ backgroundColor: color }}
                                >
                                  {tc.name.charAt(0)}
                                </div>
                                <span className="font-medium text-xs truncate max-w-[60px]">{tc.name}</span>
                              </div>
                            </td>
                            {/* 월별 셀 */}
                            {monthKeys.map(k => {
                              const cnt = tc.monthMap.get(k) || 0;
                              const intensity = cnt === 0 ? 0 : Math.max(0.15, cnt / monthMax);
                              return (
                                <td key={k} className="px-3 py-2.5 text-center">
                                  {cnt > 0 ? (
                                    <div
                                      className="inline-flex items-center justify-center w-8 h-7 rounded-lg text-xs font-bold"
                                      style={{
                                        backgroundColor: `${color}${Math.round(intensity * 255).toString(16).padStart(2, "0")}`,
                                        color: intensity > 0.5 ? "white" : color,
                                      }}
                                    >
                                      {cnt}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground/30 text-xs">-</span>
                                  )}
                                </td>
                              );
                            })}
                            {/* 합계 */}
                            <td className="px-3 py-2.5 text-center">
                              <span className="font-bold text-sm tabular-nums">{tc.count}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {/* 월 합계 행 */}
                      <tr className="bg-muted/30 border-t-2">
                        <td className="px-4 py-2 text-xs font-semibold text-muted-foreground">월 합계</td>
                        {monthKeys.map(k => {
                          const total = techCards.reduce((s, tc) => s + (tc.monthMap.get(k) || 0), 0);
                          return (
                            <td key={k} className="px-3 py-2 text-center text-sm font-bold tabular-nums">
                              {total > 0 ? total : <span className="text-muted-foreground/30 text-xs">-</span>}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center">
                          <span className="text-sm font-bold tabular-nums text-primary">{filteredRepairs.length}</span>
                          {filteredRepairs.filter(r => !parseSheetDate(r.입고일)).length > 0 && (
                            <span className="block text-[10px] text-amber-600">
                              날짜없음 {filteredRepairs.filter(r => !parseSheetDate(r.입고일)).length}건 포함
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ③ 완료 상세 테이블 */}
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
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                          데이터가 없습니다
                        </TableCell>
                      </TableRow>
                    ) : filteredRepairs.map((r, i) => {
                      const days = daysBetween(r.입고일, r.수리완료일);
                      const isCollabo = parseTechNames(r.수리기사).length > 1;
                      return (
                        <TableRow key={i} className="hover:bg-muted/20">
                          <TableCell className="font-medium text-sm">{r.손님성명}</TableCell>
                          <TableCell className="text-sm">{r.기계}</TableCell>
                          <TableCell className="text-sm">{r.품목}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {parseTechNames(r.수리기사).map(name =>
                                name !== "미배정"
                                  ? <TechBadge key={name} name={name} />
                                  : <span key={name} className="text-xs text-muted-foreground">-</span>
                              )}
                              {isCollabo && (
                                <span className="text-[10px] text-primary/70 bg-primary/5 px-1 rounded">공동</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground hidden lg:table-cell">
                            {r.손님요구사항}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {r.입고일 ? formatSheetDateFull(r.입고일) : (
                              <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1 py-0.5">날짜없음</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatSheetDateFull(r.수리완료일)}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {days !== null ? `${days}일` : "-"}
                          </TableCell>
                          <TableCell><BranchBadge branch={r._branch} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4 py-2 border-t text-xs text-muted-foreground text-right">
                {filteredRepairs.length}건
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ══════════ 영업 실적 탭 ══════════ */}
        <TabsContent value="sales" className="space-y-6 mt-4">
          {salesLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
          ) : (
            <>
              {/* KPI 카드 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Card className="border-0 shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-primary/10"><ShoppingCart className="h-4 w-4 text-primary" /></div>
                      <p className="text-xs text-muted-foreground">판매 대수</p>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">{filteredSales.length}<span className="text-sm font-normal text-muted-foreground ml-1">대</span></p>
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

              {/* 영업사원별 카드 */}
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
                            <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
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
                  <div className="px-4 py-2 border-t text-xs text-muted-foreground text-right">
                    {filteredSales.length}건 · 합계 {Math.round(totalSalesRevenue / 10000).toLocaleString()}만원
                  </div>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
