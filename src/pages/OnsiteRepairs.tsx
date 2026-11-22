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
import { PageHeader, SearchField } from "@/components/page/PageParts";
import { OnsiteRowFormModal } from "@/components/onsite/OnsiteRowFormModal";
import { ONSITE_TAB, parseOnsiteRows, type OnsiteRow } from "@/lib/onsiteSheet";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  "진행중": { label: "진행중", color: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500", bg: "bg-blue-500/15 ring-blue-500/30" },
  "완료":   { label: "완료",   color: "text-green-700 dark:text-green-400", dot: "bg-green-500", bg: "bg-green-500/15 ring-green-500/30" },
  "보류":   { label: "보류",   color: "text-amber-700 dark:text-amber-400", dot: "bg-amber-400", bg: "bg-amber-500/15 ring-amber-500/30" },
};

function getStatusCfg(status: string) {
  if (!status) return { label: "미정", color: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted ring-border" };
  for (const [key, cfg] of Object.entries(STATUS_CONFIG)) {
    if (status.includes(key)) return cfg;
  }
  return { label: status, color: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted ring-border" };
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
      className="bg-card rounded-3xl card-shadow border border-border/70 overflow-hidden hover:border-foreground/20 transition-colors"
      style={{ boxShadow: `inset 0 3px 0 ${statusColor}` }}
    >
      <div className="p-4 space-y-3">
        {/* 상태 + 수정 버튼 */}
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ring-1 ${cfg.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            <span className={cfg.color}>{cfg.label || "미정"}</span>
          </span>
          {(row.지점 || row.출장기사) && (
            <span className="text-xs text-muted-foreground ml-2 mr-auto">{[row.지점, row.출장기사].filter(Boolean).join(" · ")}</span>
          )}
          <button
            onClick={() => onEdit(row)}
            className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground transition-colors"
            aria-label="수정"
            title="수정"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        {/* 성함 */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-extrabold text-foreground tracking-tight leading-none flex-1 min-w-0 truncate">
            {row.손님성함}
          </span>
          {row.전화번호 && (
            <a
              href={`tel:${row.전화번호}`}
              className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-primary bg-primary/10 hover:bg-primary/15 transition-colors"
              aria-label="전화 걸기"
              title="전화 걸기"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* 기계 + 품목 */}
        <div className="flex items-center gap-2 ml-0.5">
          <Tractor className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            {row.기계 && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
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
              <div className="mt-2 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
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

  const { data: sheet, isLoading, error } = useQuery({
    queryKey: ["sheets", ONSITE_TAB],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-sheets", {
        body: { tab: ONSITE_TAB },
      });
      if (error) {
        const ctx = (error as any).context;
        const msg = ctx?.json ? (await ctx.json().catch(() => null))?.error : null;
        throw new Error(msg || error.message);
      }
      if (data?.error) throw new Error(data.error);
      return parseOnsiteRows(data?.values || []);
    },
    staleTime: 5 * 60 * 1000,
  });
  const rows = useMemo(() => sheet?.rows ?? [], [sheet]);

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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sheets", ONSITE_TAB] });
  const handleAdd = () => { setEditRow(null); setModalOpen(true); };
  const handleEdit = (r: OnsiteRow) => { setEditRow(r); setModalOpen(true); };

  return (
    <div className="space-y-5">
      <PageHeader
        title="방문수리"
        sub={<>전체 {rows.length}건 · 진행중 {statusCounts["진행중"] ?? 0}건<span className="hidden sm:inline"> · 구글시트 「출장」 탭과 연결</span></>}
        actions={
          <>
            <Button onClick={handleAdd} className="h-11 rounded-full px-5">
              <Plus className="h-4 w-4 mr-1" /> 방문수리 추가
            </Button>
            <Button onClick={refresh} variant="outline" disabled={isLoading} className="h-11 w-11 p-0 rounded-full bg-card" aria-label="새로고침" title="새로고침">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </>
        }
      />

      {/* 상태 카드 (누르면 거르기) */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {STATUS_TABS.map(s => {
          const count = statusCounts[s] ?? 0;
          const active = statusFilter === s;
          const cfg = getStatusCfg(s === "전체" ? "" : s);
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              aria-pressed={active}
              className={`text-left rounded-3xl border bg-card card-shadow px-3 sm:px-4 py-3 sm:py-3.5 transition-all ${
                active ? "border-transparent ring-2 ring-primary" : "border-border/70 hover:border-foreground/20"
              }`}
            >
              <span className="flex items-center gap-1.5 text-[12px] sm:text-[13px] font-medium text-muted-foreground">
                <i className={`w-2 h-2 rounded-full ${s === "전체" ? "bg-primary" : cfg.dot}`} />
                {s}
              </span>
              <span className="block mt-1.5 text-[22px] sm:text-[26px] leading-none font-extrabold tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      <SearchField value={search} onChange={setSearch} placeholder="이름, 기계, 주소, 전화번호, 내역으로 찾기" className="max-w-xl" />

      {/* 카드 목록 */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-44 rounded-3xl" />)}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-destructive/50 bg-destructive/5 p-6 text-center">
          <p className="text-destructive font-medium">데이터를 불러오지 못했습니다</p>
          <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-border/70 bg-card py-16 text-center text-muted-foreground text-sm">
          {search || statusFilter !== "전체" ? "조건에 맞는 방문수리가 없어요." : "방문수리 항목이 없습니다"}
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
        layout={sheet?.layout}
      />
    </div>
  );
}
