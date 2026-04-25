import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type FilterFn,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Search, X, ChevronDown, ChevronUp, Bookmark, Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

export type ColumnFilterType = "text" | "select" | "dateRange" | "numberRange";

export type ExcelColumn<T> = ColumnDef<T, any> & {
  /** Excel export 시 사용할 값 추출 함수. 없으면 accessorKey 값 사용 */
  exportValue?: (row: T) => string | number | null | undefined;
  /** 좌측 고정 (sticky). 여러 열 가능 */
  sticky?: boolean;
  /** 정렬 비활성화 */
  disableSort?: boolean;
  /** 필터 활성화 (헤더 아래 입력칸) */
  enableColumnFilter?: boolean;
  /** 필터 유형 — 기본 text */
  filterType?: ColumnFilterType;
  /** select 필터일 때 선택지. 없으면 데이터에서 자동 추출(distinct) */
  filterOptions?: string[];
  /** 기본 너비(px) */
  size?: number;
};

// 날짜 값을 yyyy-mm-dd로 정규화 (ISO 문자열·Date·"yyyy/m/d" 등 허용)
const normalizeDate = (raw: any): string | null => {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  // 이미 yyyy-mm-dd로 시작하면 앞 10글자 사용
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }
  // yyyy/mm/dd, yyyy.mm.dd 등
  const altMatch = s.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (altMatch) {
    return `${altMatch[1]}-${altMatch[2].padStart(2, "0")}-${altMatch[3].padStart(2, "0")}`;
  }
  // Date 파서로 마지막 시도
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return normalizeDate(d);
};

// 날짜 범위 필터 — yyyy-mm-dd 문자열 비교 (사전순 = 시간순)
const dateRangeFilter: FilterFn<any> = (row, columnId, value) => {
  if (!value || (!value.from && !value.to)) return true;
  const v = normalizeDate(row.getValue(columnId));
  if (v == null) return false;
  const from = value.from ? normalizeDate(value.from) : null;
  const to = value.to ? normalizeDate(value.to) : null;
  if (from && v < from) return false;
  if (to && v > to) return false;
  return true;
};

// 숫자 범위 필터 — 양쪽을 Number로 변환해 수치 비교
const numberRangeFilter: FilterFn<any> = (row, columnId, value) => {
  if (!value || (value.from == null && value.to == null) || (value.from === "" && value.to === "")) return true;
  const raw = row.getValue(columnId);
  if (raw == null || raw === "") return false;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return false;
  if (value.from != null && value.from !== "") {
    const f = Number(value.from);
    if (Number.isFinite(f) && n < f) return false;
  }
  if (value.to != null && value.to !== "") {
    const t = Number(value.to);
    if (Number.isFinite(t) && n > t) return false;
  }
  return true;
};

const selectFilter: FilterFn<any> = (row, columnId, value) => {
  if (!value || value === "__all__") return true;
  const raw = row.getValue(columnId);
  return String(raw ?? "") === String(value);
};

interface Props<T> {
  data: T[];
  columns: ExcelColumn<T>[];
  /** 행 클릭 시 콜백 (모달 편집용) */
  onRowClick?: (row: T) => void;
  /** 전역 검색 placeholder */
  searchPlaceholder?: string;
  /** xlsx 파일명 (확장자 제외) */
  exportFileName?: string;
  /** 행 높이(px) — 기본 36 */
  rowHeight?: number;
  /** 헤더 위 우측에 표시할 액션 버튼 */
  toolbarRight?: ReactNode;
  /** 빈 상태 메시지 */
  emptyMessage?: string;
  /** 컨테이너 높이 (기본 calc(100vh-260px)) */
  height?: string | number;
  /** 행에 적용할 추가 className */
  rowClassName?: (row: T) => string;
  /** 프리셋 저장에 사용할 고유 키 (없으면 프리셋 UI 비활성화) */
  presetKey?: string;
}

type FilterPreset = {
  name: string;
  globalFilter: string;
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  createdAt: number;
};

export default function ExcelTable<T extends object>({
  data,
  columns,
  onRowClick,
  searchPlaceholder = "검색...",
  exportFileName = "data",
  rowHeight = 36,
  toolbarRight,
  emptyMessage = "데이터가 없습니다.",
  height,
  rowClassName,
  presetKey,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [showFilterDetails, setShowFilterDetails] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  const presetStorageKey = presetKey ? `excel-table-presets:${presetKey}` : null;

  // localStorage에서 프리셋 로드
  useEffect(() => {
    if (!presetStorageKey) return;
    try {
      const raw = localStorage.getItem(presetStorageKey);
      if (raw) setPresets(JSON.parse(raw));
    } catch {}
  }, [presetStorageKey]);

  const persistPresets = (next: FilterPreset[]) => {
    setPresets(next);
    if (presetStorageKey) {
      try { localStorage.setItem(presetStorageKey, JSON.stringify(next)); } catch {}
    }
  };

  const handleSavePreset = () => {
    const name = window.prompt("프리셋 이름을 입력하세요");
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const exists = presets.some((p) => p.name === trimmed);
    if (exists && !window.confirm(`'${trimmed}' 프리셋을 덮어쓸까요?`)) return;
    const preset: FilterPreset = {
      name: trimmed,
      globalFilter,
      columnFilters,
      sorting,
      createdAt: Date.now(),
    };
    const next = exists
      ? presets.map((p) => (p.name === trimmed ? preset : p))
      : [...presets, preset];
    persistPresets(next);
    toast({ title: "프리셋 저장됨", description: `'${trimmed}'` });
  };

  const handleApplyPreset = (p: FilterPreset) => {
    setGlobalFilter(p.globalFilter ?? "");
    setColumnFilters(p.columnFilters ?? []);
    setSorting(p.sorting ?? []);
    toast({ title: "프리셋 적용됨", description: `'${p.name}'` });
  };

  const handleDeletePreset = (name: string) => {
    if (!window.confirm(`'${name}' 프리셋을 삭제할까요?`)) return;
    persistPresets(presets.filter((p) => p.name !== name));
  };

  // 컬럼에 filterFn 자동 적용
  const enhancedColumns = useMemo(() => columns.map((c) => {
    const def = c as ExcelColumn<any>;
    if (!def.enableColumnFilter || (c as any).filterFn) return c;
    if (def.filterType === "select") return { ...c, filterFn: selectFilter as any };
    if (def.filterType === "dateRange") return { ...c, filterFn: dateRangeFilter as any };
    if (def.filterType === "numberRange") return { ...c, filterFn: numberRangeFilter as any };
    return c;
  }), [columns]);

  const table = useReactTable({
    data,
    columns: enhancedColumns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    globalFilterFn: (row, _id, value) => {
      if (!value) return true;
      const v = String(value).toLowerCase();
      return row.getAllCells().some((c) => {
        const cv = c.getValue();
        return cv != null && String(cv).toLowerCase().includes(v);
      });
    },
  });

  const rows = table.getRowModel().rows;
  const containerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  // sticky 열 left 오프셋 계산
  const stickyOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let acc = 0;
    for (const col of table.getVisibleLeafColumns()) {
      const sticky = (col.columnDef as ExcelColumn<T>).sticky;
      if (sticky) {
        offsets[col.id] = acc;
        acc += col.getSize();
      }
    }
    return offsets;
  }, [table, columns]);

  // select 필터의 자동 옵션 (데이터에서 distinct, 값 타입에 맞게 정렬)
  const selectOptionsCache = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of table.getAllLeafColumns()) {
      const def = col.columnDef as ExcelColumn<T>;
      if (!def.enableColumnFilter || def.filterType !== "select") continue;

      // 명시적 옵션 — 그대로 사용 (사용자가 의도한 순서 유지)
      if (def.filterOptions) {
        map[col.id] = def.filterOptions;
        continue;
      }

      const set = new Set<string>();
      for (const r of data) {
        try {
          const v = (col as any).accessorFn ? (col as any).accessorFn(r) : (r as any)[(def as any).accessorKey];
          if (v != null && v !== "") set.add(String(v));
        } catch {}
      }
      const arr = Array.from(set);

      // 모두 숫자로 변환 가능하면 숫자 정렬
      const allNumeric = arr.length > 0 && arr.every((s) => s !== "" && !isNaN(Number(s)));
      // 모두 yyyy-mm-dd 또는 ISO 날짜로 보이면 날짜(문자열 ISO) 정렬
      const allDate = !allNumeric && arr.length > 0 && arr.every((s) => /^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(s));

      if (allNumeric) {
        arr.sort((a, b) => Number(a) - Number(b));
      } else if (allDate) {
        const norm = (s: string) => s.replace(/[./]/g, "-").slice(0, 10);
        arr.sort((a, b) => norm(a).localeCompare(norm(b)));
      } else {
        arr.sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
      }

      map[col.id] = arr;
    }
    return map;
  }, [table, data, columns]);


  const handleExport = () => {
    const visibleCols = table.getVisibleLeafColumns();
    const headers = visibleCols.map((c) => {
      const def = c.columnDef as ExcelColumn<T>;
      const h = typeof def.header === "string" ? def.header : c.id;
      return h;
    });
    const sortedData = table.getSortedRowModel().rows.map((r) => {
      const obj: Record<string, any> = {};
      visibleCols.forEach((c, i) => {
        const def = c.columnDef as ExcelColumn<T>;
        let v: any;
        if (def.exportValue) v = def.exportValue(r.original as T);
        else if ("accessorKey" in def && def.accessorKey)
          v = (r.original as any)[def.accessorKey as string];
        else {
          try { v = r.getValue(c.id); } catch { v = ""; }
        }
        obj[headers[i]] = v ?? "";
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(sortedData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${exportFileName}.xlsx`);
  };

  const totalWidth = table.getTotalSize();
  const activeFilterCount = columnFilters.length + (globalFilter ? 1 : 0);
  const handleClearFilters = () => {
    setColumnFilters([]);
    setGlobalFilter("");
  };

  return (
    <div className="space-y-3">
      {/* 툴바 */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {rows.length.toLocaleString()}행
          </span>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              title="모든 필터 초기화"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              필터 초기화 <span className="ml-1 tabular-nums">({activeFilterCount})</span>
            </Button>
          )}
          {toolbarRight}
          {presetKey && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Bookmark className="h-3.5 w-3.5" />
                  프리셋
                  {presets.length > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">({presets.length})</span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-popover z-50">
                <DropdownMenuLabel className="text-xs">필터 프리셋</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={handleSavePreset}
                  disabled={!globalFilter && columnFilters.length === 0 && sorting.length === 0}
                  className="gap-2"
                >
                  <Save className="h-3.5 w-3.5" />
                  현재 상태 저장
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {presets.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                    저장된 프리셋이 없습니다
                  </div>
                ) : (
                  presets.map((p) => (
                    <DropdownMenuItem
                      key={p.name}
                      onSelect={(e) => { e.preventDefault(); handleApplyPreset(p); }}
                      className="flex items-center justify-between gap-2 group"
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate text-sm">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          필터 {p.columnFilters.length} · 정렬 {p.sorting.length}
                          {p.globalFilter && ` · 검색 "${p.globalFilter.slice(0, 12)}"`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeletePreset(p.name); }}
                        className="text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100"
                        aria-label={`${p.name} 삭제`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1" /> 엑셀
          </Button>
        </div>
      </div>

      {/* 테이블 컨테이너 */}
      <div
        ref={containerRef}
        className="border border-border/60 rounded-xl overflow-auto bg-card relative"
        style={{ height: height ?? "calc(100vh - 260px)", minHeight: 360 }}
      >
        <div style={{ width: totalWidth, position: "relative" }}>
          {/* 헤더 */}
          <div
            className="sticky top-0 z-20 bg-muted/60 backdrop-blur border-b border-border/60"
            style={{ width: totalWidth }}
          >
            {table.getHeaderGroups().map((hg) => (
              <div key={hg.id} className="flex" style={{ height: rowHeight }}>
                {hg.headers.map((h) => {
                  const def = h.column.columnDef as ExcelColumn<T>;
                  const sticky = def.sticky;
                  const sortDir = h.column.getIsSorted();
                  const style: CSSProperties = {
                    width: h.getSize(),
                    ...(sticky
                      ? {
                          position: "sticky",
                          left: stickyOffsets[h.column.id],
                          zIndex: 21,
                          background: "hsl(var(--muted) / 0.95)",
                        }
                      : {}),
                  };
                  return (
                    <div
                      key={h.id}
                      style={style}
                      className="relative flex items-center px-3 text-xs font-semibold text-muted-foreground border-r border-border/40 select-none"
                    >
                      <button
                        type="button"
                        disabled={def.disableSort || !h.column.getCanSort()}
                        onClick={h.column.getToggleSortingHandler()}
                        className={cn(
                          "flex items-center gap-1 truncate text-left",
                          h.column.getCanSort() && !def.disableSort && "cursor-pointer hover:text-foreground"
                        )}
                      >
                        <span className="truncate">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </span>
                        {h.column.getCanSort() && !def.disableSort && (
                          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> :
                          sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> :
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </button>
                      {/* 리사이즈 핸들 */}
                      {h.column.getCanResize() && (
                        <div
                          onMouseDown={h.getResizeHandler()}
                          onTouchStart={h.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/40",
                            h.column.getIsResizing() && "bg-primary"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {/* 컬럼 필터 행 */}
            {table.getHeaderGroups()[0].headers.some((h) => (h.column.columnDef as ExcelColumn<T>).enableColumnFilter) && (
              <div className="flex border-t border-border/40 bg-background/40" style={{ minHeight: 38 }}>
                {table.getHeaderGroups()[0].headers.map((h) => {
                  const def = h.column.columnDef as ExcelColumn<T>;
                  const sticky = def.sticky;
                  const style: CSSProperties = {
                    width: h.getSize(),
                    ...(sticky
                      ? {
                          position: "sticky",
                          left: stickyOffsets[h.column.id],
                          zIndex: 21,
                          background: "hsl(var(--background) / 0.95)",
                        }
                      : {}),
                  };
                  const fv = h.column.getFilterValue() as any;
                  const ftype = def.filterType ?? "text";
                  return (
                    <div key={h.id} style={style} className="px-1 py-1 border-r border-border/30">
                      {!def.enableColumnFilter ? null : ftype === "select" ? (
                        <Select
                          value={fv ?? "__all__"}
                          onValueChange={(v) => h.column.setFilterValue(v === "__all__" ? undefined : v)}
                        >
                          <SelectTrigger className="h-7 text-xs px-2">
                            <SelectValue placeholder="전체" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            <SelectItem value="__all__">전체</SelectItem>
                            {(selectOptionsCache[h.column.id] ?? []).map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : ftype === "dateRange" ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="date"
                            value={fv?.from ?? ""}
                            onChange={(e) => h.column.setFilterValue({ ...(fv ?? {}), from: e.target.value || undefined })}
                            className="h-7 text-[11px] px-1.5"
                          />
                          <Input
                            type="date"
                            value={fv?.to ?? ""}
                            onChange={(e) => h.column.setFilterValue({ ...(fv ?? {}), to: e.target.value || undefined })}
                            className="h-7 text-[11px] px-1.5"
                          />
                          {fv && (fv.from || fv.to) && (
                            <button
                              type="button"
                              onClick={() => h.column.setFilterValue(undefined)}
                              className="text-muted-foreground hover:text-foreground shrink-0"
                              aria-label="초기화"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ) : ftype === "numberRange" ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            placeholder="≥"
                            value={fv?.from ?? ""}
                            onChange={(e) => h.column.setFilterValue({ ...(fv ?? {}), from: e.target.value === "" ? undefined : Number(e.target.value) })}
                            className="h-7 text-[11px] px-1.5"
                          />
                          <Input
                            type="number"
                            placeholder="≤"
                            value={fv?.to ?? ""}
                            onChange={(e) => h.column.setFilterValue({ ...(fv ?? {}), to: e.target.value === "" ? undefined : Number(e.target.value) })}
                            className="h-7 text-[11px] px-1.5"
                          />
                          {fv && (fv.from != null || fv.to != null) && (
                            <button
                              type="button"
                              onClick={() => h.column.setFilterValue(undefined)}
                              className="text-muted-foreground hover:text-foreground shrink-0"
                              aria-label="초기화"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <Input
                          value={(fv as string) ?? ""}
                          onChange={(e) => h.column.setFilterValue(e.target.value)}
                          placeholder="필터..."
                          className="h-7 text-xs px-2"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* 결과 요약 바 */}
            <div className="border-t border-border/40 bg-muted/30 text-[11px] text-muted-foreground">
              <div className="flex items-start justify-between gap-2 px-3 py-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeFilterCount > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowFilterDetails((v) => !v)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors"
                        aria-expanded={showFilterDetails}
                        title={showFilterDetails ? "적용값 숨기기" : "적용값 펼치기"}
                      >
                        필터 {activeFilterCount}개 적용
                        {showFilterDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      <span className="tabular-nums">
                        <span className="font-semibold text-foreground">{rows.length.toLocaleString()}</span> / {data.length.toLocaleString()}건
                      </span>
                    </>
                  ) : (
                    <span className="tabular-nums">전체 <span className="font-semibold text-foreground">{data.length.toLocaleString()}</span>건</span>
                  )}
                  {globalFilter && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background border border-border/60 text-foreground">
                      <Search className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="font-medium truncate max-w-[160px]">{globalFilter}</span>
                      <button
                        type="button"
                        onClick={() => setGlobalFilter("")}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="검색어 제거"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  )}
                  {sorting.map((s, idx) => {
                    const col = table.getColumn(s.id);
                    const def = col?.columnDef as ExcelColumn<T> | undefined;
                    const label = def && typeof def.header === "string" ? def.header : s.id;
                    return (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background border border-border/60 text-foreground"
                        title={sorting.length > 1 ? `정렬 ${idx + 1}순위` : "정렬"}
                      >
                        {s.desc ? <ArrowDown className="h-2.5 w-2.5 text-muted-foreground" /> : <ArrowUp className="h-2.5 w-2.5 text-muted-foreground" />}
                        <span className="font-medium">{label}</span>
                        <span className="text-muted-foreground">{s.desc ? "내림차순" : "오름차순"}</span>
                        <button
                          type="button"
                          onClick={() => col?.clearSorting()}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`${label} 정렬 해제`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
                {(activeFilterCount > 0 || sorting.length > 0) && (
                  <div className="flex items-center gap-2 shrink-0">
                    {sorting.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSorting([])}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <X className="h-3 w-3" /> 정렬 해제
                      </button>
                    )}
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <X className="h-3 w-3" /> 필터 초기화
                      </button>
                    )}
                  </div>
                )}
              </div>
              {activeFilterCount > 0 && showFilterDetails && (
                <div className="flex items-center gap-1.5 flex-wrap px-3 pb-2 pt-0.5 border-t border-border/30">
                  {columnFilters.length === 0 && (
                    <span className="text-muted-foreground">컬럼 필터 없음</span>
                  )}
                  {columnFilters.map((f) => {
                    const col = table.getColumn(f.id);
                    if (!col) return null;
                    const def = col.columnDef as ExcelColumn<T>;
                    const label = typeof def.header === "string" ? def.header : f.id;
                    const v: any = f.value;
                    let display = "";
                    if (def.filterType === "dateRange") {
                      const from = v?.from ?? "";
                      const to = v?.to ?? "";
                      display = `${from || "…"} ~ ${to || "…"}`;
                    } else if (def.filterType === "numberRange") {
                      const from = v?.from ?? v?.from === 0 ? v?.from : "";
                      const to = v?.to ?? v?.to === 0 ? v?.to : "";
                      display = `${from === "" || from == null ? "…" : from} ~ ${to === "" || to == null ? "…" : to}`;
                    } else {
                      display = String(v ?? "");
                    }
                    return (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background border border-border/60 text-foreground"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">= {display}</span>
                        <button
                          type="button"
                          onClick={() => col.setFilterValue(undefined)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`${label} 필터 제거`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 가상화 행 */}
          {rows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">{emptyMessage}</div>
          ) : (
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const row = rows[vRow.index];
                const extra = rowClassName?.(row.original as T) ?? "";
                return (
                  <div
                    key={row.id}
                    onClick={() => onRowClick?.(row.original as T)}
                    className={cn(
                      "flex border-b border-border/30 hover:bg-muted/30 transition-colors",
                      onRowClick && "cursor-pointer",
                      extra
                    )}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: totalWidth,
                      height: vRow.size,
                      transform: `translateY(${vRow.start}px)`,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const def = cell.column.columnDef as ExcelColumn<T>;
                      const sticky = def.sticky;
                      const style: CSSProperties = {
                        width: cell.column.getSize(),
                        ...(sticky
                          ? {
                              position: "sticky",
                              left: stickyOffsets[cell.column.id],
                              zIndex: 1,
                              background: "hsl(var(--card))",
                            }
                          : {}),
                      };
                      return (
                        <div
                          key={cell.id}
                          style={style}
                          className="flex items-center px-3 text-sm border-r border-border/20 truncate"
                        >
                          <span className="truncate w-full">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
