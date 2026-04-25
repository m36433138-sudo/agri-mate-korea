import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// dateRange / numberRange 공용 필터 함수
const rangeFilter: FilterFn<any> = (row, columnId, value) => {
  if (!value || (!value.from && !value.to)) return true;
  const raw = row.getValue(columnId);
  if (raw == null || raw === "") return false;
  const v = typeof raw === "number" ? raw : String(raw);
  if (value.from != null && value.from !== "" && v < value.from) return false;
  if (value.to != null && value.to !== "" && v > value.to) return false;
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
}

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
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // 컬럼에 filterFn 자동 적용
  const enhancedColumns = useMemo(() => columns.map((c) => {
    const def = c as ExcelColumn<any>;
    if (!def.enableColumnFilter || (c as any).filterFn) return c;
    if (def.filterType === "select") return { ...c, filterFn: selectFilter as any };
    if (def.filterType === "dateRange" || def.filterType === "numberRange") return { ...c, filterFn: rangeFilter as any };
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

  // select 필터의 자동 옵션 (데이터에서 distinct)
  const selectOptionsCache = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of table.getAllLeafColumns()) {
      const def = col.columnDef as ExcelColumn<T>;
      if (def.enableColumnFilter && def.filterType === "select") {
        if (def.filterOptions) {
          map[col.id] = def.filterOptions;
        } else {
          const set = new Set<string>();
          for (const r of data) {
            try {
              const v = (col as any).accessorFn ? (col as any).accessorFn(r) : (r as any)[(def as any).accessorKey];
              if (v != null && v !== "") set.add(String(v));
            } catch {}
          }
          map[col.id] = Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
        }
      }
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
          {toolbarRight}
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
              <div className="flex border-t border-border/40 bg-background/40" style={{ height: 32 }}>
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
                  return (
                    <div key={h.id} style={style} className="px-1.5 py-0.5 border-r border-border/30">
                      {def.enableColumnFilter ? (
                        <Input
                          value={(h.column.getFilterValue() as string) ?? ""}
                          onChange={(e) => h.column.setFilterValue(e.target.value)}
                          placeholder="필터..."
                          className="h-6 text-xs px-2"
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
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
