import { useState, useMemo } from "react";
import { SheetRow, getStatus, OperationStatus, formatSheetDate } from "@/types/operations";
import { OpsStatusBadge, BranchBadge, TechBadge } from "./StatusBadgeOps";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search } from "lucide-react";

interface Props {
  data: SheetRow[];
  statusFilter: OperationStatus | null;
}

export function OperationsTable({ data, statusFilter }: Props) {
  const [search, setSearch] = useState("");
  const [techFilter, setTechFilter] = useState("전체");
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const technicians = useMemo(() => {
    const set = new Set(data.map(r => r.수리기사).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (statusFilter) rows = rows.filter(r => getStatus(r) === statusFilter);
    if (techFilter !== "전체") rows = rows.filter(r => r.수리기사 === techFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(r =>
        r.손님성명.toLowerCase().includes(s) ||
        r.기계.toLowerCase().includes(s) ||
        r.수리기사.toLowerCase().includes(s)
      );
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = (a as any)[sortKey] || "";
        const bv = (b as any)[sortKey] || "";
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [data, statusFilter, techFilter, search, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="손님 성명, 기계, 수리기사 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="수리기사" />
          </SelectTrigger>
          <SelectContent>
            {technicians.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-20">상태</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("손님성명")}>손님 성명</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("기계")}>기계</TableHead>
              <TableHead>품목</TableHead>
              <TableHead>수리기사</TableHead>
              <TableHead className="min-w-[200px]">요구사항</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("수리시작일")}>수리시작일</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("입고일")}>입고일</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("수리완료일")}>수리완료일</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("출고일")}>출고일</TableHead>
              <TableHead>위치</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">데이터가 없습니다</TableCell></TableRow>
            ) : filtered.map((row, i) => (
              <TableRow key={i} className="hover:bg-muted/30">
                <TableCell><OpsStatusBadge status={getStatus(row)} /></TableCell>
                <TableCell className="font-medium">{row.손님성명}</TableCell>
                <TableCell>{row.기계}</TableCell>
                <TableCell>{row.품목}</TableCell>
                <TableCell>{row.수리기사 ? <TechBadge name={row.수리기사} /> : <span className="text-muted-foreground text-xs">미배정</span>}</TableCell>
                <TableCell>
                  {row.손님요구사항.length > 40 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{row.손님요구사항.slice(0, 40)}…</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs whitespace-pre-wrap">{row.손님요구사항}</TooltipContent>
                    </Tooltip>
                  ) : row.손님요구사항}
                </TableCell>
                <TableCell className="text-sm">{formatSheetDate(row.수리시작일)}</TableCell>
                <TableCell className="text-sm">{formatSheetDate(row.입고일)}</TableCell>
                <TableCell className="text-sm">{formatSheetDate(row.수리완료일)}</TableCell>
                <TableCell className="text-sm">{formatSheetDate(row.출고일)}</TableCell>
                <TableCell><BranchBadge branch={row._branch} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.map((row, i) => (
          <div key={i} className="rounded-xl border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{row.손님성명}</span>
              <OpsStatusBadge status={getStatus(row)} />
            </div>
            <div className="text-sm text-muted-foreground">{row.기계} · {row.품목}</div>
            {row.수리기사 && <TechBadge name={row.수리기사} />}
            {row.손님요구사항 && <p className="text-xs text-muted-foreground line-clamp-2">{row.손님요구사항}</p>}
            <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
              {row.입고일 && <span>입고: {formatSheetDate(row.입고일)}</span>}
              {row.수리완료일 && <span>완료: {formatSheetDate(row.수리완료일)}</span>}
              <BranchBadge branch={row._branch} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground">데이터가 없습니다</p>}
      </div>

      <p className="text-xs text-muted-foreground text-right">{filtered.length}건</p>
    </div>
  );
}
