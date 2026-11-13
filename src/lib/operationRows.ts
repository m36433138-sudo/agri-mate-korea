import { supabase } from "@/integrations/supabase/client";
import { SheetRow, parseRows, isCompleted } from "@/types/operations";

/** 작업현황판의 원본은 operation_rows. 구글시트는 백업으로만 따라 씀. */
export type Branch = "장흥" | "강진";
export const sheetNameOf = (b: Branch) => (b === "강진" ? "강진(입출수)" : "장흥(입출수)");

export interface OperationRowRecord {
  branch: Branch;
  source_tab: "active";
  row_index: number;
  status_label: string | null;
  customer_name: string | null;
  machine: string | null;
  model: string | null;
  phone: string | null;
  address: string | null;
  location: string | null;
  technician: string | null;
  requirements: string | null;
  serial_number?: string | null;
  entry_date: string | null;
  repair_start_date: string | null;
  repair_done_date: string | null;
  dispatch_date: string | null;
  contacted: string | null;
  contact_note: string | null;
  is_completed: boolean;
  notes: string | null;
  writer: string | null;
}

const n = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null);

export function dbToSheetRow(r: any): SheetRow {
  return {
    status_label: r.status_label || "",
    손님성명: r.customer_name || "",
    기계: r.machine || "",
    품목: r.model || "",
    전화번호: r.phone || "",
    주소: r.address || "",
    위치: r.location || "",
    수리기사: r.technician || "",
    손님요구사항: r.requirements || "",
    제조번호: r.serial_number || "",
    입고일: r.entry_date || "",
    수리시작일: r.repair_start_date || "",
    수리완료일: r.repair_done_date || "",
    수리관료일: "",
    출고일: r.dispatch_date || "",
    연락여부: r.contacted || "",
    연락사항: r.contact_note || "",
    전체완료: r.is_completed ? "TRUE" : "",
    비고: r.notes || "",
    입력자: r.writer || "",
    _branch: r.branch,
    _rowIndex: r.row_index,
    _doneCol: "P",
  };
}

/** 시트 행 → DB 레코드 (S/N은 앱 전용이라 포함하지 않음) */
export function sheetRowToDb(row: SheetRow): OperationRowRecord {
  return {
    branch: row._branch,
    source_tab: "active",
    row_index: row._rowIndex,
    status_label: n(row.status_label),
    customer_name: n(row.손님성명),
    machine: n(row.기계),
    model: n(row.품목),
    phone: n(row.전화번호),
    address: n(row.주소),
    location: n(row.위치),
    technician: n(row.수리기사),
    requirements: n(row.손님요구사항),
    entry_date: n(row.입고일),
    repair_start_date: n(row.수리시작일),
    repair_done_date: n(row.수리완료일),
    dispatch_date: n(row.출고일),
    contacted: n(row.연락여부),
    contact_note: n(row.연락사항),
    is_completed: isCompleted(row.전체완료),
    notes: n(row.비고),
    writer: n(row.입력자),
  };
}

/** 시트에 없는 앱 전용 행 번호(음수). 시트 백업이 실패해도 저장되게 함. */
export const localRowIndex = () => -Math.floor(Date.now() % 2_000_000_000);

export async function fetchBranchRows(branch: Branch): Promise<SheetRow[]> {
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await (supabase as any)
      .from("operation_rows").select("*")
      .eq("branch", branch).eq("source_tab", "active")
      .order("row_index").range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return all.filter((r) => r.customer_name).map(dbToSheetRow);
}

/** 구글시트 내용을 앱으로 가져오기 (S/N 등 앱 전용 값은 유지). */
export async function importBranchFromSheet(branch: Branch): Promise<number> {
  const { data, error } = await supabase.functions.invoke("google-sheets", { body: { tab: sheetNameOf(branch) } });
  if (error || data?.error) throw new Error(data?.error || error?.message || "시트를 읽지 못했어요");
  const rows = parseRows(data?.values || [], branch).map(sheetRowToDb);
  for (let i = 0; i < rows.length; i += 500) {
    const { error: e } = await (supabase as any)
      .from("operation_rows").upsert(rows.slice(i, i + 500), { onConflict: "branch,source_tab,row_index" });
    if (e) throw new Error(e.message);
  }
  return rows.length;
}

/** 시트 백업 쓰기 — 실패해도 앱 저장은 유지. 성공 여부 반환. */
export async function mirrorToSheet(body: Record<string, unknown>): Promise<{ ok: boolean; data?: any }> {
  try {
    const { data, error } = await supabase.functions.invoke("google-sheets", { body });
    if (error || data?.error) return { ok: false };
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export async function updateOperationRow(branch: Branch, rowIndex: number, patch: Record<string, unknown>) {
  const { error } = await (supabase as any).from("operation_rows").update(patch)
    .eq("branch", branch).eq("source_tab", "active").eq("row_index", rowIndex);
  if (error) throw new Error(error.message);
}
