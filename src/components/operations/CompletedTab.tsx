import { useState, useMemo } from "react";
import { SheetRow, formatSheetDate, daysBetween, parseSheetDate } from "@/types/operations";
import { TechBadge, BranchBadge } from "./StatusBadgeOps";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type Range = "이번달" | "지난달" | "3개월" | "custom";

interface Props {
  data: SheetRow[];
}

export function CompletedTab({ data }: Props) {
  const [range, setRange] = useState<Range>("이번달");
  const [sortKey, setSortKey] = useState("출고일");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const dateRange = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    if (range === "이번달") return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
    if (range === "지난달") return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
    return { from: new Date(y, m - 2, 1), to: new Date(y, m + 1, 0) };
  }, [range]);

  const filtered = useMemo(() => {
    let rows = data.filter(r => {
      const d = parseSheetDate(r.출고일);
      if (!d) return true; // include if no date but completed
      return d >= dateRange.from && d <= dateRange.to;
    });
    rows.sort((a, b) => {
      const av = (a as any)[sortKey] || "";
      const bv = (b as any)[sortKey] || "";
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return rows;
  }, [data, dateRange, sortKey, sortDir]);

  const avgDays = useMemo(() => {
    const days = filtered.map(r => daysBetween(r.입고일, r.수리완료일)).filter((d): d is number => d !== null);
    return days.length ? (days.reduce((a, b) => a + b, 0) / days.length).toFixed(1) : "-";
  }, [filtered]);

  const techCount = useMemo(() => new Set(filtered.map(r => r.수리기사).filter(Boolean)).size, [filtered]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {(["이번달", "지난달", "3개월"] as Range[]).map(r => (
          <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
            {r}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-3 text-center">
          <p className="text-2xl font-bold">{filtered.length}</p>
          <p className="text-xs text-muted-foreground">총 완료 건수</p>
        </div>
        <div className="rounded-xl border p-3 text-center">
          <p className="text-2xl font-bold">{avgDays}<span className="text-sm font-normal">일</span></p>
          <p className="text-xs text-muted-foreground">평균 수리기간</p>
        </div>
        <div className="rounded-xl border p-3 text-center">
          <p className="text-2xl font-bold">{techCount}</p>
          <p className="text-xs text-muted-foreground">기사 수</p>
        </div>
      </div>

      <div className="rounded-xl border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="cursor-pointer" onClick={() => handleSort("손님성명")}>손님 성명</TableHead>
              <TableHead>기계</TableHead>
              <TableHead>품목</TableHead>
              <TableHead>수리기사</TableHead>
              <TableHead>요구사항</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("입고일")}>입고일</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("수리완료일")}>수리완료일</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("출고일")}>출고일</TableHead>
              <TableHead>수리기간</TableHead>
              <TableHead>위치</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">완료된 항목이 없습니다</TableCell></TableRow>
            ) : filtered.map((r, i) => {
              const days = daysBetween(r.입고일, r.수리완료일);
              return (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.손님성명}</TableCell>
                  <TableCell>{r.기계}</TableCell>
                  <TableCell>{r.품목}</TableCell>
                  <TableCell>{r.수리기사 ? <TechBadge name={r.수리기사} /> : "-"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.손님요구사항}</TableCell>
                  <TableCell className="text-sm">{formatSheetDate(r.입고일)}</TableCell>
                  <TableCell className="text-sm">{formatSheetDate(r.수리완료일)}</TableCell>
                  <TableCell className="text-sm">{formatSheetDate(r.출고일)}</TableCell>
                  <TableCell>{days !== null ? `${days}일` : "-"}</TableCell>
                  <TableCell><BranchBadge branch={r._branch} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
