import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, Search, Phone, MapPin, Wrench, Plus, Pencil,
  Tractor, ChevronDown, ChevronUp, User, Flame,
} from "lucide-react";
import { OnsiteRowFormModal } from "@/components/onsite/OnsiteRowFormModal";
import {
  useVisitRepairs, updateVisitPriority, updateVisitTechnician,
  type OnsiteRow as VisitOnsiteRow,
} from "@/hooks/useVisitRepairs";
import { PriorityPicker } from "@/components/operations/PriorityPicker";
import { TechnicianPicker } from "@/components/operations/TechnicianPicker";
import { PRIORITY_META, type Priority } from "@/lib/priority";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type OnsiteRow = VisitOnsiteRow & { _rowIndex: number };

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  "진행중": { label: "진행중", color: "text-blue-400", dot: "bg-blue-500", bg: "bg-blue-500/15 ring-blue-500/30" },
  "완료":   { label: "완료",   color: "text-green-400", dot: "bg-green-500", bg: "bg-green-500/15 ring-green-500/30" },
  "보류":   { label: "보류",   color: "text-amber-400", dot: "bg-amber-400", bg: "bg-amber-500/15 ring-amber-500/30" },
};

function getStatusCfg(status: string) {
  if (!status) return { label: "미정", color: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted ring-border" };
  for (const [key, cfg] of Object.entries(STATUS_CONFIG)) {
    if (status.includes(key)) return cfg;
  }
  return { label: status, color: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted ring-border" };
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!text) return <>{text}</>;
  const q = query.trim();
  if (!q) return <>{text}</>;
  const isDigitQuery = /^\d+$/.test(q.replace(/\D/g, "")) && q.replace(/\D/g, "").length > 0 && q.replace(/\D/g, "") === q.replace(/\s/g, "");
  // 전화번호처럼 하이픈 포함된 텍스트에서 숫자만 매칭되도록 처리
  const digits = q.replace(/\D/g, "");
  if (isDigitQuery && digits && /\d/.test(text)) {
    // 텍스트에서 숫자만 모은 위치 매핑으로 하이라이트
    const map: number[] = [];
    let digitsOnly = "";
    for (let i = 0; i < text.length; i++) {
      if (/\d/.test(text[i])) { map.push(i); digitsOnly += text[i]; }
    }
    const idx = digitsOnly.indexOf(digits);
    if (idx >= 0) {
      const start = map[idx];
      const end = map[idx + digits.length - 1] + 1;
      return (
        <>
          {text.slice(0, start)}
          <mark className="bg-primary/30 text-foreground rounded px-0.5">{text.slice(start, end)}</mark>
          {text.slice(end)}
        </>
      );
    }
  }
  const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        re.test(p) && p.toLowerCase() === q.toLowerCase()
          ? <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">{p}</mark>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

function OnsiteCard({
  row, onEdit, query, onPriority, onTechnician,
}: {
  row: OnsiteRow;
  onEdit: (r: OnsiteRow) => void;
  query: string;
  onPriority: (r: OnsiteRow, p: Priority) => void;
  onTechnician: (r: OnsiteRow, t: string) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const cfg = getStatusCfg(row.진행사항);
  const isUrgent = row.priority === "긴급";
  const statusColor = isUrgent
    ? PRIORITY_META["긴급"].color
    : row.진행사항.includes("진행") ? "#3b82f6"
    : row.진행사항 === "완료" ? "#16a34a"
    : row.진행사항 === "보류" ? "#d97706" : "#94a3b8";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(row)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(row); } }}
      className={cn(
        "bg-card rounded-2xl shadow-sm hover:shadow-md hover:border-primary/40 transition-all border border-border/50 overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40",
        isUrgent && "ring-1 ring-red-500/40 shadow-red-500/10",
      )}
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
            onClick={(e) => { e.stopPropagation(); onEdit(row); }}
            className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
            title="상세/수정"
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
            <Highlight text={row.손님성함} query={query} />
          </span>
        </div>

        {/* 기계 + 품목 */}
        <div className="flex items-center gap-2 ml-0.5">
          <Tractor className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            {row.기계 && (
              <span className="inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-bold bg-emerald-500/15 text-emerald-400">
                <Highlight text={row.기계} query={query} />
              </span>
            )}
            {row.품목 && (
              <span className="text-base font-semibold text-foreground">
                <Highlight text={row.품목} query={query} />
              </span>
            )}
            {row.제조번호 && (
              <span className="text-xs font-mono text-muted-foreground">
                S/N <Highlight text={row.제조번호} query={query} />
              </span>
            )}
          </div>
        </div>

        {/* 전화번호 */}
        {row.전화번호 && (
          <div className="flex items-center gap-2 ml-0.5">
            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <a href={`tel:${row.전화번호}`} onClick={e => e.stopPropagation()} className="text-sm font-semibold text-foreground hover:text-primary transition-colors tabular-nums">
              <Highlight text={row.전화번호} query={query} />
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
              onClick={(e) => { e.stopPropagation(); setDetailOpen(v => !v); }}
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<OnsiteRow | null>(null);

  const { rows: rawRows, isLoading, error, refresh } = useVisitRepairs();
  const rows: OnsiteRow[] = useMemo(
    () => rawRows.map((r) => ({ ...r, _rowIndex: r._rowIndex ?? 0 })),
    [rawRows],
  );

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
      const qDigits = q.replace(/\D/g, "");
      result = result.filter(r =>
        r.손님성함.toLowerCase().includes(q) ||
        r.기계.toLowerCase().includes(q) ||
        r.품목.toLowerCase().includes(q) ||
        r.제조번호.toLowerCase().includes(q) ||
        r.내역.toLowerCase().includes(q) ||
        r.주소.toLowerCase().includes(q) ||
        (qDigits ? r.전화번호.replace(/\D/g, "").includes(qDigits) : r.전화번호.includes(q))
      );
    }
    return result;
  }, [rows, statusFilter, search]);

  const handleAdd = () => { setEditRow(null); setModalOpen(true); };
  const handleEdit = (r: OnsiteRow) => { setEditRow(r); setModalOpen(true); };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">방문수리</h1>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 ring-1 ring-blue-500/30 text-xs font-bold text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              진행중 <span className="tabular-nums">{statusCounts["진행중"] ?? 0}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/15 ring-1 ring-green-500/30 text-xs font-bold text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              완료 <span className="tabular-nums">{statusCounts["완료"] ?? 0}</span>
            </span>
            {(statusCounts["보류"] ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 ring-1 ring-amber-500/30 text-xs font-bold text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                보류 <span className="tabular-nums">{statusCounts["보류"]}</span>
              </span>
            )}
            <span className="text-xs text-muted-foreground">전체 {statusCounts["전체"] ?? 0}건</span>
          </div>
        </div>
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
            placeholder="고객명·전화·기계·제조번호 검색..."
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
            <OnsiteCard key={i} row={r} onEdit={handleEdit} query={search} />
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
