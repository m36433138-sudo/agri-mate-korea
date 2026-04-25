/**
 * Supabase 기반 작업현황판 훅 (구 useGoogleSheets 어댑터)
 *
 * 구글시트 연동을 제거하고 operation_rows 테이블을 source of truth로 사용한다.
 * 기존 호출부와의 호환을 위해 SheetRow 형식으로 변환하여 반환한다.
 * Edge Function `google-sheets`는 롤백 가능성을 위해 백엔드에 그대로 둔다(호출만 제거).
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SheetRow } from "@/types/operations";
import { normalizePriority, type Priority } from "@/lib/priority";

// ─── DB row → SheetRow 변환 ───────────────────────────────
interface DbRow {
  id: string;
  branch: "장흥" | "강진";
  row_index: number;
  source_tab: "active" | "archive";
  status_label: string | null;
  customer_name: string | null;
  machine: string | null;
  model: string | null;
  phone: string | null;
  address: string | null;
  location: string | null;
  technician: string | null;
  requirements: string | null;
  serial_number: string | null;
  entry_date: string | null;
  repair_start_date: string | null;
  repair_done_date: string | null;
  dispatch_date: string | null;
  contacted: string | null;
  contact_note: string | null;
  is_completed: boolean;
  notes: string | null;
  writer: string | null;
  priority: string | null;
  updated_at: string;
}

function dbToSheetRow(r: DbRow): SheetRow & { _id: string } {
  return {
    _id: r.id,
    status_label: r.status_label ?? "",
    손님성명: r.customer_name ?? "",
    기계: r.machine ?? "",
    품목: r.model ?? "",
    전화번호: r.phone ?? "",
    주소: r.address ?? "",
    위치: r.location ?? "",
    수리기사: r.technician ?? "",
    손님요구사항: r.requirements ?? "",
    제조번호: r.serial_number ?? "",
    입고일: r.entry_date ?? "",
    수리시작일: r.repair_start_date ?? "",
    수리완료일: r.repair_done_date ?? "",
    수리관료일: "",
    출고일: r.dispatch_date ?? "",
    연락여부: r.contacted ?? "",
    연락사항: r.contact_note ?? "",
    전체완료: r.is_completed ? "TRUE" : "",
    비고: r.notes ?? "",
    입력자: r.writer ?? "",
    priority: normalizePriority(r.priority),
    _branch: r.branch,
    _rowIndex: r.row_index,
    _doneCol: "P", // 호환용 (시트 컬럼). DB에서는 사용하지 않음.
  };
}

async function fetchAllRows(): Promise<Array<SheetRow & { _id: string; _sourceTab: "active" | "archive" }>> {
  // 1000행 제한 회피: range 페이지네이션
  const PAGE = 1000;
  const all: DbRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("operation_rows" as any)
      .select("*")
      .order("branch", { ascending: true })
      .order("row_index", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as unknown as DbRow[];
    all.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return all.map((r) => ({ ...dbToSheetRow(r), _sourceTab: r.source_tab }));
}

// ─── Write 함수들 (호환 시그니처 유지) ───────────────────────
// 호출부는 markRowComplete(sheetName, rowIndex) 처럼 부르므로 sheetName으로 branch 추정.
function inferBranch(sheetName: string): "장흥" | "강진" {
  return sheetName.includes("강진") ? "강진" : "장흥";
}

export async function markRowComplete(sheetName: string, rowIndex: number, _col: string = "P"): Promise<void> {
  const branch = inferBranch(sheetName);
  const { error } = await supabase
    .from("operation_rows" as any)
    .update({ is_completed: true, status_label: "완료" } as any)
    .eq("branch", branch)
    .eq("row_index", rowIndex);
  if (error) throw new Error(error.message);
}

export async function updateRowStatus(sheetName: string, rowIndex: number, newStatus: string): Promise<void> {
  const branch = inferBranch(sheetName);
  const { error } = await supabase
    .from("operation_rows" as any)
    .update({ status_label: newStatus } as any)
    .eq("branch", branch)
    .eq("row_index", rowIndex);
  if (error) throw new Error(error.message);
}

/**
 * 구 시트의 17개 컬럼 values 배열 → DB 컬럼으로 매핑.
 * 호출부(RowFormModal)에서 시트 형식 그대로 보내므로 어댑터로 흡수한다.
 */
function valuesArrayToPatch(values: any[]): Record<string, any> {
  const v = (i: number) => (values[i] ?? "").toString();
  const patch: Record<string, any> = {
    status_label: v(0) || null,
    customer_name: v(1) || null,
    machine: v(2) || null,
    model: v(3) || null,
    phone: v(4) || null,
    address: v(5) || null,
    location: v(6) || null,
    technician: v(7) || null,
    requirements: v(8) || null,
    serial_number: v(9) || null,
    entry_date: v(10) || null,
    repair_start_date: v(11) || null,
    repair_done_date: v(12) || null,
    dispatch_date: v(13) || null,
    contacted: v(14) || null,
    is_completed: ["TRUE", "true", "1", "✓"].includes(v(15).trim()),
    notes: v(16) || null,
  };
  if (values.length > 17 && v(17)) {
    patch.priority = normalizePriority(v(17));
  }
  return patch;
}

export async function upsertRowFromValues(sheetName: string, rowIndex: number | null, values: any[]): Promise<void> {
  const branch = inferBranch(sheetName);
  const patch = valuesArrayToPatch(values);
  if (rowIndex == null) {
    // 새 행: 가장 큰 row_index + 1
    const { data: maxRow } = await supabase
      .from("operation_rows" as any)
      .select("row_index")
      .eq("branch", branch)
      .eq("source_tab", "active")
      .order("row_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextIndex = ((maxRow as any)?.row_index ?? 1) + 1;
    const { error } = await supabase
      .from("operation_rows" as any)
      .insert({ ...patch, branch, row_index: nextIndex, source_tab: "active" } as any);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("operation_rows" as any)
      .update(patch as any)
      .eq("branch", branch)
      .eq("row_index", rowIndex);
    if (error) throw new Error(error.message);
  }
}

export async function clearRow(sheetName: string, rowIndex: number): Promise<void> {
  const branch = inferBranch(sheetName);
  const { error } = await supabase
    .from("operation_rows" as any)
    .delete()
    .eq("branch", branch)
    .eq("row_index", rowIndex);
  if (error) throw new Error(error.message);
}

export async function updateRowPriority(branch: "장흥" | "강진", rowIndex: number, priority: Priority): Promise<void> {
  const { error } = await supabase
    .from("operation_rows" as any)
    .update({ priority } as any)
    .eq("branch", branch)
    .eq("row_index", rowIndex);
  if (error) throw new Error(error.message);
}

export async function updateRowTechnician(branch: "장흥" | "강진", rowIndex: number, technician: string | null): Promise<void> {
  const { error } = await supabase
    .from("operation_rows" as any)
    .update({ technician: technician || null } as any)
    .eq("branch", branch)
    .eq("row_index", rowIndex);
  if (error) throw new Error(error.message);
}

// ─── 메인 훅 ─────────────────────────────────────────────
export function useGoogleSheets() {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ["operation-rows"],
    queryFn: async () => {
      const list = await fetchAllRows();
      setLastUpdated(new Date());
      return list;
    },
    staleTime: 30 * 1000, // 30초 → 누르면 즉시 표시 + 백그라운드 갱신
  });

  // Realtime 구독: 변경 시 즉시 invalidate
  useEffect(() => {
    const channel = supabase
      .channel("operation_rows-sync")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "operation_rows" },
        () => queryClient.invalidateQueries({ queryKey: ["operation-rows"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["operation-rows"] });
  }, [queryClient]);

  const list = rows ?? [];
  const active = useMemo(() => list.filter((r) => r._sourceTab === "active"), [list]);
  const archive = useMemo(() => list.filter((r) => r._sourceTab === "archive"), [list]);
  const jangheungData = useMemo(() => active.filter((r) => r._branch === "장흥"), [active]);
  const gangjinData = useMemo(() => active.filter((r) => r._branch === "강진"), [active]);

  return {
    allData: active,
    allWithArchive: list,
    jangheungData,
    gangjinData,
    completedArchive: archive,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}
