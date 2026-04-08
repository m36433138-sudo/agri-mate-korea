import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, Search, Phone, MapPin, Wrench, Plus, Pencil,
  Tractor, ChevronDown, ChevronUp, User,
} from "lucide-react";
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
      _rowIndex: idx + 2,
    }))
    .filter(r => r.손님성함);
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  "진행중": { label: "진행중", color: "text-blue-700", dot: "bg-blue-500", bg: "bg-blue-50 ring-blue-200" },
  "완료":   { label: "완료",   color: "text-green-700", dot: "bg-green-500", bg: "bg-green-50 ring-green-200" },
  "보류":   { label: "보류",   color: "text-amber-700", dot: "bg-amber-400", bg: "bg-amber-50 ring-amber-200" },
};

function getStatusCfg(status: string) {
  if (!status) return { label: "미정", color: "text-gray-500", dot: "bg-gray-300", bg: "bg-gray-50 ring-gray-200" };
  for (const [key, cfg] of Object.entries(STATUS_CONFIG)) {
    if (status.includes(key)) return cfg;
  }
  return { label: status, color: "text-gray-500", dot: "bg-gray-300", bg: "bg-gray-50 ring-gray-200" };
}

function OnsiteCard({ row, onEdit }: { row: OnsiteRow; onEdit: (r: OnsiteRow) => void }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const cfg = getStatusCfg(row.진행사항);
  const statusColor =
    row.진행사항.includes("진행") ? "#3b82f6" :
    row.진행사항 === "완료" ? "#16a34a" :
    row.진행사항 === "보류" ? "#d97706" : "#94a3b8";

  return (
    <div
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-border/50 overflow-hidden"
      style={{ borderLeftWidth: 5, borderLeftColor: statusColor }}
    >
      <div className="px-4 pt-3.5 pb-3 space-y-2.5">
        {/* 상태 + 수정 버튼 */}
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ring-1 ${cfg.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            <span className={cfg.color}>{cfg.label || "미정"}</span>
          </span>
          <button
            onClick={() => onEdit(row)}
            className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* 성함 */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xl font-extrabold text-foreground tracking-tight leading-none">
            {row.손님성함}
          </span>
        </div>

        {/* 기계 + 품목 */}
        <div className="flex items-center gap-2 ml-0.5">
          <Tractor className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            {row.기계 && (
              <span className="inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-bold bg-green-100 text-green-700">
                {row.기계}
              </span>
            )}
            {row.품목 && (
              <span className="text-base font-semibold text-foreground">{row.품목}</span>
            )}
          </div>
        </div>

        {/* 전화번호 */}
        {row.전화번호 && (
          <div className="flex items-center gap-2 ml-0.5">
            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <a href={`tel:${row.전화번호}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors tabular-nums">
              {row.전화번호}
            </a>
          </div>
        )}

        {/* 주소 */}
        {row.주소 && (
          <div className="flex items-start gap-2 ml-0.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-sm text-foreground leading-snug">{row.주소}</span>
          </div>
        )}

        {/* 내역 — 토글 */}
        {row.내역 && (
          <div>
            <button
              onClick={() => setDetailOpen(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Wrench className="h-3 w-3" />
              내역
              {detailOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {detailOpen && (
              <div className="mt-1.5 ml-1 pl-3 border-l-2 border-muted text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {row.내역}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_TABS = ["전체", "진행중", "완료", "보류"];

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

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { 전체: rows.length, 진행중: 0, 완료: 0, 보류: 0 };
    rows.forEach(r => {
      if (r.진행사항.includes("진행")) counts["진행중"]++;
      else if (r.진행사항 === "완료") counts["완료"]++;
      else if (r.진행사항 === "보류") counts["보류"]++;
    });
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (statusFilter !== "전체") {
      result = result.filter(r => {
        if (statusFilter === "진행중") return r.진행사항.includes("진행");
        return r.진행사항 === statusFilter;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.손님성함.toLowerCase().includes(q) ||
        r.기계.toLowerCase().includes(q) ||
        r.품목.toLowerCase().includes(q) ||
        r.내역.toLowerCase().includes(q) ||
        r.주소.toLowerCase().includes(q) ||
        r.전화번호.includes(q)
      );
    }
    return result;
  }, [rows, statusFilter, search]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sheets", "방문수리"] });
  const handleAdd = () => { setEditRow(null); setModalOpen(true); };
  const handleEdit = (r: OnsiteRow) => { setEditRow(r); setModalOpen(true); };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">방문수리</h1>
        <div className="flex gap-2">
          <Button onClick={handleAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" /> 추가
          </Button>
          <Button onClick={refresh} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> 새로고침
          </Button>
        </div>
      </div>

      {/* 상태 탭 필터 */}
      <div className="flex gap-2 flex-wrap items-center">
        {STATUS_TABS.map(s => {
          const count = statusCounts[s] ?? 0;
          const active = statusFilter === s;
          const cfg = getStatusCfg(s === "전체" ? "" : s);
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
                active
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {s !== "전체" && <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />}
              {s}
              <span className={`text-[11px] tabular-nums ${active ? "opacity-70" : "opacity-50"}`}>
                {count}
              </span>
            </button>
          );
        })}
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="이름, 기계, 주소 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* 카드 목록 */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6 text-center">
          <p className="text-destructive font-medium">데이터를 불러오지 못했습니다</p>
          <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          방문수리 항목이 없습니다
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r, i) => (
            <OnsiteCard key={i} row={r} onEdit={handleEdit} />
          ))}
        </div>
      )}

      <OnsiteRowFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={refresh}
        row={editRow}
      />
    </div>
  );
}
