/**
 * 방문수리 데이터 훅 (Supabase 기반, 구 google-sheets 방문수리 탭 대체)
 */
import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OnsiteRow {
  진행사항: string;
  손님성함: string;
  기계: string;
  품목: string;
  제조번호: string;
  전화번호: string;
  주소: string;
  내역: string;
  _rowIndex?: number;
  _id?: string;
}

interface DbVisitRow {
  id: string;
  row_index: number;
  status_label: string | null;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  machine: string | null;
  model: string | null;
  serial_number: string | null;
  requirements: string | null;
  is_completed: boolean;
}

function dbToOnsite(r: DbVisitRow): OnsiteRow {
  return {
    진행사항: r.status_label ?? (r.is_completed ? "완료" : ""),
    손님성함: r.customer_name ?? "",
    기계: r.machine ?? "",
    품목: r.model ?? "",
    제조번호: r.serial_number ?? "",
    전화번호: r.phone ?? "",
    주소: r.address ?? "",
    내역: r.requirements ?? "",
    _rowIndex: r.row_index,
    _id: r.id,
  };
}

async function fetchAllVisits(): Promise<OnsiteRow[]> {
  const PAGE = 1000;
  const all: DbVisitRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("visit_repair_rows" as any)
      .select("*")
      .order("row_index", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as unknown as DbVisitRow[];
    all.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return all.map(dbToOnsite);
}

function valuesArrayToVisitPatch(values: string[]): Record<string, any> {
  // 진행사항, 손님성함, 기계, 품목, 전화번호, 주소, 내역
  const v = (i: number) => (values[i] ?? "").toString();
  const status = v(0);
  return {
    status_label: status || null,
    customer_name: v(1) || null,
    machine: v(2) || null,
    model: v(3) || null,
    phone: v(4) || null,
    address: v(5) || null,
    requirements: v(6) || null,
    is_completed: status === "완료",
  };
}

export async function upsertVisitFromValues(rowIndex: number | undefined, values: string[]): Promise<void> {
  const patch = valuesArrayToVisitPatch(values);
  if (!rowIndex) {
    const { data: maxRow } = await supabase
      .from("visit_repair_rows" as any)
      .select("row_index")
      .order("row_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextIndex = ((maxRow as any)?.row_index ?? 1) + 1;
    const { error } = await supabase
      .from("visit_repair_rows" as any)
      .insert({ ...patch, row_index: nextIndex } as any);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("visit_repair_rows" as any)
      .update(patch as any)
      .eq("row_index", rowIndex);
    if (error) throw new Error(error.message);
  }
}

export async function deleteVisitRow(rowIndex: number): Promise<void> {
  const { error } = await supabase
    .from("visit_repair_rows" as any)
    .delete()
    .eq("row_index", rowIndex);
  if (error) throw new Error(error.message);
}

export function useVisitRepairs() {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["visit-repairs"],
    queryFn: async () => {
      const list = await fetchAllVisits();
      setLastUpdated(new Date());
      return list;
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("visit_repair_rows-sync")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "visit_repair_rows" },
        () => queryClient.invalidateQueries({ queryKey: ["visit-repairs"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["visit-repairs"] });
  }, [queryClient]);

  return {
    rows: data ?? [],
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}
