import { useState, useMemo } from "react";

interface UseListFilterOptions<T> {
  /** The full data array */
  data: T[] | undefined;
  /** Fields to search against — accepts dot notation for nested objects */
  searchFields: (keyof T | string)[];
  /** Optional tab/category filters: { fieldName: currentValue } — "전체" means no filter */
  tabFilters?: Record<string, string>;
  /** Items per page (0 = no pagination) */
  pageSize?: number;
}

interface UseListFilterResult<T> {
  search: string;
  setSearch: (v: string) => void;
  filtered: T[];
  /** Paginated slice of filtered (same as filtered if pageSize=0) */
  paged: T[];
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  totalFiltered: number;
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

export function useListFilter<T>(options: UseListFilterOptions<T>): UseListFilterResult<T> {
  const { data, searchFields, tabFilters, pageSize = 0 } = options;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data;

    // Apply tab filters
    if (tabFilters) {
      for (const [field, value] of Object.entries(tabFilters)) {
        if (value && value !== "전체") {
          result = result.filter((item) => getNestedValue(item, field) === value);
        }
      }
    }

    // Apply search
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter((item) =>
        searchFields.some((field) => {
          const val = getNestedValue(item, field as string);
          return typeof val === "string" && val.toLowerCase().includes(s);
        })
      );
    }

    return result;
  }, [data, search, tabFilters, searchFields]);

  // Reset page when filters change
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    if (pageSize <= 0) return filtered;
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  return {
    search,
    setSearch: (v: string) => { setSearch(v); setPage(1); },
    filtered,
    paged,
    page: safePage,
    setPage,
    totalPages,
    totalFiltered: filtered.length,
  };
}
