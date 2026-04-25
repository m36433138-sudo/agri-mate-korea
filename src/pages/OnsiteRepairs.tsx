import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  RefreshCw, Search, Phone, MapPin, Wrench, Plus, Pencil,
  Tractor, ChevronDown, ChevronUp, User, Flame, X,
} from "lucide-react";
import { OnsiteRowFormModal } from "@/components/onsite/OnsiteRowFormModal";
import {
  useVisitRepairs, updateVisitPriority, updateVisitTechnician,
  type OnsiteRow as VisitOnsiteRow,
} from "@/hooks/useVisitRepairs";
import { PriorityPicker } from "@/components/operations/PriorityPicker";
import { TechnicianPicker } from "@/components/operations/TechnicianPicker";
import { PRIORITY_META, PRIORITIES, type Priority } from "@/lib/priority";
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
  row, onEdit, query, onPriority, onTechnician, selected, onToggleSelect,
}: {
  row: OnsiteRow;
  onEdit: (r: OnsiteRow) => void;
  query: string;
  onPriority: (r: OnsiteRow, p: Priority) => void;
  onTechnician: (r: OnsiteRow, t: string) => void;
  selected: boolean;
  onToggleSelect: (r: OnsiteRow) => void;
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
        selected && "ring-2 ring-primary/60 border-primary/60",
      )}
      style={{ borderLeftWidth: 5, borderLeftColor: statusColor }}
    >
      <div className="px-4 pt-3.5 pb-3 space-y-2.5">
        {/* 체크박스 + 상태 + 우선순위 + 기사 + 수정 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              onClick={(e) => { e.stopPropagation(); onToggleSelect(row); }}
              className="flex items-center pr-1"
              role="presentation"
            >
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect(row)}
                aria-label="선택"
                className="h-4 w-4"
              />
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ring-1 ${cfg.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              <span className={cfg.color}>{cfg.label || "미정"}</span>
            </span>
            <PriorityPicker
              value={row.priority}
              onChange={(p) => onPriority(row, p)}
              stopPropagation
            />
            <TechnicianPicker
              value={row.기사 || ""}
              onChange={(t) => onTechnician(row, t)}
              stopPropagation
            />
          </div>
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
const STORAGE_KEY = "onsite-repairs:filters:v1";

interface PersistedFilters {
  search: string;
  statusFilter: string;
  priorityFilter: string; // "전체" | Priority
  technicianFilter: string; // "" = 전체
}

const DEFAULT_FILTERS: PersistedFilters = {
  search: "",
  statusFilter: "전체",
  priorityFilter: "전체",
  technicianFilter: "",
};

function loadFilters(): PersistedFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as Partial<PersistedFilters>) };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export default function OnsiteRepairs() {
  const initial = useMemo(loadFilters, []);
  const [search, setSearch] = useState(initial.search);
  const [statusFilter, setStatusFilter] = useState(initial.statusFilter);
  const [priorityFilter, setPriorityFilter] = useState<string>(initial.priorityFilter);
  const [technicianFilter, setTechnicianFilter] = useState<string>(initial.technicianFilter);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<OnsiteRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const { toast } = useToast();

  // 필터 상태를 localStorage에 저장
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ search, statusFilter, priorityFilter, technicianFilter }),
      );
    } catch {
      /* ignore quota errors */
    }
  }, [search, statusFilter, priorityFilter, technicianFilter]);

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
    if (priorityFilter !== "전체") {
      result = result.filter(r => r.priority === priorityFilter);
    }
    if (technicianFilter) {
      if (technicianFilter === "__none__") {
        result = result.filter(r => !r.기사);
      } else {
        result = result.filter(r => r.기사 === technicianFilter);
      }
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
    return result.slice().sort((a, b) => {
      const ra = PRIORITY_META[a.priority]?.rank ?? 99;
      const rb = PRIORITY_META[b.priority]?.rank ?? 99;
      if (ra !== rb) return ra - rb;
      return (a._rowIndex ?? 0) - (b._rowIndex ?? 0);
    });
  }, [rows, statusFilter, priorityFilter, technicianFilter, search]);

  const handleAdd = () => { setEditRow(null); setModalOpen(true); };
  const handleEdit = (r: OnsiteRow) => { setEditRow(r); setModalOpen(true); };

  const handlePriority = async (r: OnsiteRow, p: Priority) => {
    try {
      await updateVisitPriority(r._rowIndex, p);
      toast({ title: `우선순위 → ${p}` });
      refresh();
    } catch (err: any) {
      toast({ title: "우선순위 변경 실패", description: err.message, variant: "destructive" });
    }
  };

  const handleTechnician = async (r: OnsiteRow, t: string) => {
    try {
      await updateVisitTechnician(r._rowIndex, t || null);
      toast({ title: t ? `기사 배정 → ${t}` : "기사 배정 해제" });
      refresh();
    } catch (err: any) {
      toast({ title: "기사 배정 실패", description: err.message, variant: "destructive" });
    }
  };

  const toggleSelect = (r: OnsiteRow) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(r._rowIndex)) next.delete(r._rowIndex);
      else next.add(r._rowIndex);
      return next;
    });
  };

  const filteredIds = useMemo(() => filtered.map(r => r._rowIndex), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));
  const someFilteredSelected = filteredIds.some(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredIds.forEach(id => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      filteredIds.forEach(id => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkSetPriority = async (p: Priority) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(ids.map(id => updateVisitPriority(id, p)));
      const failed = results.filter(r => r.status === "rejected").length;
      const ok = ids.length - failed;
      toast({
        title: `우선순위 일괄 변경: ${p}`,
        description: failed === 0 ? `${ok}건 적용` : `${ok}건 성공, ${failed}건 실패`,
        variant: failed === 0 ? "default" : "destructive",
      });
      clearSelection();
      refresh();
    } finally {
      setBulkBusy(false);
    }
  };

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

      {/* 일괄 작업 바 */}
      <div className="flex items-center gap-2 flex-wrap text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
            onCheckedChange={toggleSelectAll}
            aria-label="현재 목록 전체 선택"
          />
          <span className="text-xs text-muted-foreground">
            {selectedIds.size > 0
              ? <>선택됨 <span className="font-bold text-foreground tabular-nums">{selectedIds.size}</span>건</>
              : "전체 선택"}
          </span>
        </label>
        {selectedIds.size > 0 && (
          <>
            <span className="text-xs text-muted-foreground">우선순위 일괄 변경:</span>
            {PRIORITIES.map(p => {
              const m = PRIORITY_META[p];
              return (
                <button
                  key={p}
                  disabled={bulkBusy}
                  onClick={() => bulkSetPriority(p)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-md ring-1 ring-inset font-bold text-xs transition-all hover:scale-105",
                    m.badge,
                    bulkBusy && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {p === "긴급" && <Flame className="h-3 w-3" />}
                  {m.label}
                </button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={bulkBusy}
              className="ml-auto h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" /> 선택 해제
            </Button>
          </>
        )}
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
            <OnsiteCard
              key={i}
              row={r}
              onEdit={handleEdit}
              query={search}
              onPriority={handlePriority}
              onTechnician={handleTechnician}
              selected={selectedIds.has(r._rowIndex)}
              onToggleSelect={toggleSelect}
            />
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
