import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Search, Phone, MapPin, Wrench, Plus, Pencil } from "lucide-react";
import { OnsiteRowFormModal } from "@/components/onsite/OnsiteRowFormModal";

interface OnsiteRow {
  진행사항: string;
  손님성함: string;
  기계: string;
  품목: string;
  전화번호: string;
  주소: string;
  내역: string;
  _rowIndex: number;
}

function parseOnsiteRows(values: string[][]): OnsiteRow[] {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(h => (h || "").trim());
  const col = (name: string) => headers.findIndex(h => h.includes(name));

  const iStatus = col("진행") >= 0 ? col("진행") : 0;
  const iName = col("성함") >= 0 ? col("성함") : col("성명") >= 0 ? col("성명") : 1;
  const iMachine = col("기계") >= 0 ? col("기계") : 2;
  const iModel = col("품목") >= 0 ? col("품목") : 3;
  const iPhone = col("전화") >= 0 ? col("전화") : 4;
  const iAddr = col("주소") >= 0 ? col("주소") : 5;
  const iDetail = col("내역") >= 0 ? col("내역") : 6;

  return values.slice(1)
    .map((row, idx) => ({
      진행사항: (row[iStatus] || "").trim(),
      손님성함: (row[iName] || "").trim(),
      기계: (row[iMachine] || "").trim(),
      품목: (row[iModel] || "").trim(),
      전화번호: (row[iPhone] || "").trim(),
      주소: (row[iAddr] || "").trim(),
      내역: (row[iDetail] || "").trim(),
      _rowIndex: idx + 2, // 1-indexed, skip header
    }))
    .filter(r => r.손님성함);
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return <Badge variant="outline">미정</Badge>;
  if (status === "완료") return <Badge className="bg-green-100 text-green-700 border-green-200">완료</Badge>;
  if (status === "보류") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">보류</Badge>;
  if (status.includes("진행")) return <Badge className="bg-blue-100 text-blue-700 border-blue-200">진행중</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export default function OnsiteRepairs() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<OnsiteRow | null>(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["sheets", "방문수리"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-sheets", {
        body: { tab: "방문수리" },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return parseOnsiteRows(data?.values || []);
    },
    staleTime: 5 * 60 * 1000,
  });

  const statuses = useMemo(() => {
    const set = new Set(rows.map(r => r.진행사항).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (statusFilter !== "전체") result = result.filter(r => r.진행사항 === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.손님성함.toLowerCase().includes(q) ||
        r.기계.toLowerCase().includes(q) ||
        r.품목.toLowerCase().includes(q) ||
        r.내역.toLowerCase().includes(q) ||
        r.주소.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach(r => {
      const s = r.진행사항 || "미정";
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [rows]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sheets", "방문수리"] });

  const handleAdd = () => { setEditRow(null); setModalOpen(true); };
  const handleEdit = (r: OnsiteRow) => { setEditRow(r); setModalOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">방문수리</h1>
        <Button onClick={refresh} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> 새로고침
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold">{rows.length}</p>
          <p className="text-xs text-muted-foreground">전체 건수</p>
        </div>
        {Object.entries(statusCounts).slice(0, 3).map(([k, v]) => (
          <div key={k} className="rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold">{v}</p>
            <p className="text-xs text-muted-foreground">{k}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="이름, 기계, 내역 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {statuses.map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6 text-center">
          <p className="text-destructive font-medium">데이터를 불러오지 못했습니다</p>
          <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>진행사항</TableHead>
                <TableHead>손님 성함</TableHead>
                <TableHead>기계</TableHead>
                <TableHead>품목</TableHead>
                <TableHead>전화번호</TableHead>
                <TableHead>주소</TableHead>
                <TableHead>내역</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    방문수리 항목이 없습니다
                  </TableCell>
                </TableRow>
              ) : filtered.map((r, i) => (
                <TableRow key={i}>
                  <TableCell><StatusBadge status={r.진행사항} /></TableCell>
                  <TableCell className="font-medium">{r.손님성함}</TableCell>
                  <TableCell>{r.기계}</TableCell>
                  <TableCell>{r.품목}</TableCell>
                  <TableCell>
                    {r.전화번호 ? (
                      <a href={`tel:${r.전화번호}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Phone className="h-3 w-3" /> {r.전화번호}
                      </a>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {r.주소 ? (
                      <span className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{r.주소}</span>
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="max-w-[250px]">
                    {r.내역 ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />
                        {r.내역}
                      </span>
                    ) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
