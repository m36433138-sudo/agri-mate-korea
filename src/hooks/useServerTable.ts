import { useState, useMemo, useCallback } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SortingState, ColumnFiltersState } from "@tanstack/react-table";

type FilterType = "text" | "select" | "dateRange" | "numberRange";

export interface ServerTableColumnSpec {
  /** column id used in TanStack columnFilters */
  id: string;
  /** DB column name */
  dbColumn: string;
  filterType: FilterType;
  /** for text filters: use ilike (default true). false = eq */
  ilike?: boolean;
}

export interface UseServerTableOptions {
  table: string;
  /** select string e.g. "*, customers(name)" */
  select: string;
  /** DB column for tsvector full-text search (websearch_to_tsquery) */
  searchColumn?: string;
  /** default sort column */
  defaultSort?: { column: string; ascending: boolean };
  /** map of TanStack column id → DB filter spec */
  columnSpecs: Record<string, ServerTableColumnSpec>;
  /** additional fixed filters (e.g. tab filters) */
  extraFilters?: { column: string; op: "eq" | "neq" | "in"; value: any }[];
  queryKey: readonly unknown[];
  pageSize?: number;
  enabled?: boolean;
}

export function useServerTable<T = any>(opts: UseServerTableOptions) {
  const {
    table, select, searchColumn, defaultSort,
    columnSpecs, extraFilters = [], queryKey, pageSize: initialPageSize = 50, enabled = true,
  } = opts;

  const [sorting, setSorting] = useState<SortingState>(
    defaultSort ? [{ id: defaultSort.column, desc: !defaultSort.ascending }] : []
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Reset page on filter/search/sort change
  const resetAndSet = <S,>(setter: (v: S) => void) => (v: S) => {
    setPageIndex(0);
    setter(v);
  };

  const extraFiltersKey = useMemo(() => JSON.stringify(extraFilters), [extraFilters]);

  const queryResult = useQuery({
    queryKey: [...queryKey, { sorting, columnFilters, globalFilter, pageIndex, pageSize, extraFiltersKey }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = (supabase as any).from(table).select(select, { count: "exact" });

      // Extra filters (e.g. type tab)
      for (const f of extraFilters) {
        if (f.value == null || f.value === "" || f.value === "전체") continue;
        if (f.op === "in") q = q.in(f.column, f.value);
        else if (f.op === "neq") q = q.neq(f.column, f.value);
        else q = q.eq(f.column, f.value);
      }

      // Column filters
      for (const cf of columnFilters) {
        const spec = columnSpecs[cf.id];
        if (!spec) continue;
        const v = cf.value as any;
        if (v == null || v === "") continue;
        if (spec.filterType === "text") {
          if (typeof v === "string" && v.trim()) {
            q = spec.ilike === false ? q.eq(spec.dbColumn, v) : q.ilike(spec.dbColumn, `%${v}%`);
          }
        } else if (spec.filterType === "select") {
          if (Array.isArray(v) && v.length > 0) q = q.in(spec.dbColumn, v);
          else if (typeof v === "string" && v) q = q.eq(spec.dbColumn, v);
        } else if (spec.filterType === "dateRange") {
          if (v.from) q = q.gte(spec.dbColumn, v.from);
          if (v.to) q = q.lte(spec.dbColumn, v.to);
        } else if (spec.filterType === "numberRange") {
          if (v.min != null && v.min !== "") q = q.gte(spec.dbColumn, Number(v.min));
          if (v.max != null && v.max !== "") q = q.lte(spec.dbColumn, Number(v.max));
        }
      }

      // Global full-text search
      if (globalFilter.trim() && searchColumn) {
        // websearch_to_tsquery via textSearch
        q = q.textSearch(searchColumn, globalFilter.trim(), { type: "websearch", config: "simple" });
      }

      // Sorting
      if (sorting.length > 0) {
        for (const s of sorting) {
          const spec = columnSpecs[s.id];
          const col = spec?.dbColumn ?? s.id;
          q = q.order(col, { ascending: !s.desc });
        }
      } else if (defaultSort) {
        q = q.order(defaultSort.column, { ascending: defaultSort.ascending });
      }

      // Pagination
      const from = pageIndex * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as T[], total: count ?? 0 };
    },
    enabled,
  });

  return {
    rows: queryResult.data?.rows ?? [],
    total: queryResult.data?.total ?? 0,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    refetch: queryResult.refetch,
    state: { sorting, columnFilters, globalFilter, pageIndex, pageSize },
    setSorting: resetAndSet(setSorting),
    setColumnFilters: resetAndSet(setColumnFilters),
    setGlobalFilter: resetAndSet(setGlobalFilter),
    setPageIndex,
    setPageSize: useCallback((s: number) => { setPageSize(s); setPageIndex(0); }, []),
  };
}
