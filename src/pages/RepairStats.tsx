import { useState, useMemo } from "react";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";
import { SheetRow, isCompleted, daysBetween, parseSheetDate, getTechnicianColor, formatSheetDateFull, getMachineTypeColor } from "@/types/operations";
import { TechBadge, BranchBadge } from "@/components/operations/StatusBadgeOps";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Download, RefreshCw } from "lucide-react";

type Period = "이번달" | "지난달" | "올해";
type Branch = "전체" | "장흥" | "강진";

function getPeriodRange(period: Period) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (period === "이번달") return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
  if (period === "지난달") return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
  return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
}

export default function RepairStats() {
  const { allWithArchive, isLoading, refresh } = useGoogleSheets();
  const [period, setPeriod] = useState<Period>("올해");
  const [branch, setBranch] = useState<Branch>("전체");
  const [techFilter, setTechFilter] = useState("전체");

  // All completed rows from all sources
  const completed = useMemo(() => allWithArchive.filter(r => isCompleted(r.전체완료)), [allWithArchive]);

  const range = useMemo(() => getPeriodRange(period), [period]);

  const filtered = useMemo(() => {
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

  // This month's range for highlighting
  const thisMonth = useMemo(() => {
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
  }, []);

  // Tech cards
  const techCards = useMemo(() => {
    const map = new Map<string, SheetRow[]>();
    filtered.forEach(r => {
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
        // This month count
        const thisMonthCount = rows.filter(r => {
          const d = parseSheetDate(r.출고일) || parseSheetDate(r.수리완료일);
          return d && d >= thisMonth.from && d <= thisMonth.to;
        }).length;
        return { name, count: rows.length, avgDays, topItems, jh, gj, thisMonthCount };
      })
      .sort((a, b) => b.count - a.count);
  }, [filtered, thisMonth]);

  // Monthly chart
  const monthlyData = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    filtered.forEach(r => {
      const d = parseSheetDate(r.출고일) || parseSheetDate(r.수리완료일);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const tech = r.수리기사 || "미배정";
      if (!map.has(key)) map.set(key, new Map());
      map.get(key)!.set(tech, (map.get(key)!.get(tech) || 0) + 1);
    });
    const allTechs = Array.from(new Set(filtered.map(r => r.수리기사 || "미배정")));
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, techMap]) => {
        const entry: Record<string, any> = { month };
        allTechs.forEach(t => { entry[t] = techMap.get(t) || 0; });
        return entry;
      });
  }, [filtered]);

  const monthlyTechs = useMemo(() => Array.from(new Set(filtered.map(r => r.수리기사 || "미배정"))), [filtered]);

  const exportCSV = () => {
    const headers = ["손님성명", "기계", "품목", "수리기사", "요구사항", "입고일", "수리완료일", "출고일", "수리기간", "위치"];
    const csvRows = [headers.join(",")];
    filtered.forEach(r => {
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

  const chartConfig = Object.fromEntries(monthlyTechs.map(t => [t, { label: t, color: getTechnicianColor(t) }]));

  if (isLoading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">실적 현황</h1>
      <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">실적 현황</h1>
        <div className="flex gap-2">
          <Button onClick={exportCSV} variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button onClick={refresh} variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-1" /> 새로고침</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
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
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="기사" /></SelectTrigger>
          <SelectContent>{technicians.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Tech cards */}
      <div>
        <h3 className="text-lg font-bold mb-3">기사별 실적</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {techCards.map(tc => (
            <div key={tc.name} className="rounded-xl border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: getTechnicianColor(tc.name) }}>
                  {tc.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{tc.name}</p>
                  <p className="text-xs text-muted-foreground">장흥 {tc.jh}건 / 강진 {tc.gj}건</p>
                </div>
              </div>
              <div className="flex gap-4 text-sm items-baseline">
                <div><span className="text-2xl font-bold">{tc.count}</span><span className="text-muted-foreground ml-1">건</span></div>
                <div><span className="text-2xl font-bold">{tc.avgDays}</span><span className="text-muted-foreground ml-1">일 평균</span></div>
                {tc.thisMonthCount > 0 && (
                  <div className="ml-auto text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                    이번달 {tc.thisMonthCount}건
                  </div>
                )}
              </div>
              {tc.topItems.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tc.topItems.map(([name, cnt]) => {
                    const mc = getMachineTypeColor(name);
                    return (
                      <span key={name} className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${mc.bg} ${mc.text}`}>{name} ({cnt})</span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {techCards.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">데이터가 없습니다</p>}
        </div>
      </div>

      {/* Monthly chart */}
      {monthlyData.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-3">월별 완료 건수</h3>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              {monthlyTechs.map(t => (
                <Bar key={t} dataKey={t} stackId="a" fill={getTechnicianColor(t)} />
              ))}
            </BarChart>
          </ChartContainer>
        </div>
      )}

      {/* Detail table */}
      <div>
        <h3 className="text-lg font-bold mb-3">완료 상세</h3>
        <div className="rounded-xl border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>손님 성명</TableHead>
                <TableHead>기계</TableHead>
                <TableHead>모델</TableHead>
                <TableHead>수리기사</TableHead>
                <TableHead>요구사항</TableHead>
                <TableHead>입고일</TableHead>
                <TableHead>수리완료일</TableHead>
                <TableHead>출고일</TableHead>
                <TableHead>수리기간</TableHead>
                <TableHead>위치</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">데이터가 없습니다</TableCell></TableRow>
              ) : filtered.map((r, i) => {
                const days = daysBetween(r.입고일, r.수리완료일);
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.손님성명}</TableCell>
                    <TableCell>{r.기계}</TableCell>
                    <TableCell>{r.품목}</TableCell>
                    <TableCell>{r.수리기사 ? <TechBadge name={r.수리기사} /> : "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.손님요구사항}</TableCell>
                    <TableCell className="text-sm">{formatSheetDateFull(r.입고일)}</TableCell>
                    <TableCell className="text-sm">{formatSheetDateFull(r.수리완료일)}</TableCell>
                    <TableCell className="text-sm">{formatSheetDateFull(r.출고일)}</TableCell>
                    <TableCell>{days !== null ? `${days}일` : "-"}</TableCell>
                    <TableCell><BranchBadge branch={r._branch} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground text-right mt-2">{filtered.length}건</p>
      </div>
    </div>
  );
}
