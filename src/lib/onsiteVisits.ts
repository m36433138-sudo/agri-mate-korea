import { supabase } from "@/integrations/supabase/client";
import { ONSITE_TAB, buildOnsiteValues, parseOnsiteRows, type OnsiteField, type OnsiteLayout, type OnsiteRow } from "./onsiteSheet";

/**
 * 방문수리의 원본은 onsite_visits. 구글 시트 「출장」 탭은 백업으로만 따라 쓴다(실패해도 앱 저장은 유지).
 * 시트에서 읽어 오는 건 표가 비었을 때 한 번, 그리고 관리자 「시트 가져오기」 때뿐이다.
 */
export const VISIT_STATUSES = ["대기", "진행중", "보류", "완료"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export interface OnsiteVisit {
  id: string;
  sheet_row: number | null;
  sheet_raw: string[] | null;
  status: VisitStatus;
  category: string | null;
  branch: string | null;
  priority: string | null;
  requested: string | null;
  customer_name: string;
  phone: string | null;
  address: string | null;
  detail: string | null;
  machine: string | null;
  model: string | null;
  technician: string | null;
  scheduled_on: string | null;
  completed_on: string | null;
  customer_id: string | null;
  lat: number | null;
  lng: number | null;
  geocoded_address: string | null;
  created_at: string;
  updated_at: string;
}

export type VisitInput = Omit<OnsiteVisit, "id" | "created_at" | "updated_at" | "sheet_row" | "sheet_raw" | "lat" | "lng" | "geocoded_address"> &
  Partial<Pick<OnsiteVisit, "sheet_row" | "sheet_raw" | "lat" | "lng" | "geocoded_address">>;

const n = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null);
const db = supabase as any;

/** 시트 「분류」 칸은 상태와 종류(출장·50시간 A/S)가 섞여 있다 → 상태/종류로 나눈다 */
export function statusFromSheet(cls: string, completed: string): { status: VisitStatus; category: string | null } {
  const c = (cls || "").trim();
  if (c === "완료" || c.includes("완료")) return { status: "완료", category: null };
  if (c.includes("진행")) return { status: "진행중", category: null };
  if (c.includes("보류")) return { status: "보류", category: null };
  if ((completed || "").trim()) return { status: "완료", category: n(c) };
  return { status: "대기", category: n(c) };
}

/** 앱 상태 → 시트 「분류」 칸: 대기는 종류(출장 등)를 그대로 쓰고, 나머지는 상태 이름 */
export function sheetClassOf(v: Pick<OnsiteVisit, "status" | "category">): string {
  return v.status === "대기" ? v.category || "출장" : v.status;
}

/** 「2026-11-24」 같은 날짜, 「11/24」·「11.24」 → ISO 날짜. 못 읽으면 null */
export function parseLooseDate(s: string | null | undefined, now = new Date()): string | null {
  const t = (s || "").trim();
  if (!t) return null;
  let m = t.match(/(20\d{2})[./-](\d{1,2})[./-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[./-](\d{1,2})$/) ?? t.match(/^(\d{1,2})월\s*(\d{1,2})일$/);
  if (m) return `${now.getFullYear()}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

export function sheetRowToVisit(r: OnsiteRow): VisitInput {
  const { status, category } = statusFromSheet(r.진행사항, r.완료날짜);
  return {
    sheet_row: r._rowIndex,
    sheet_raw: r._raw,
    status,
    category,
    branch: n(r.지점),
    priority: n(r.우선순위),
    requested: n(r.요구날짜),
    customer_name: r.손님성함.trim(),
    phone: n(r.전화번호),
    address: n(r.주소),
    detail: n(r.내역),
    machine: n(r.기계),
    model: n(r.품목),
    technician: n(r.출장기사),
    scheduled_on: null,
    completed_on: parseLooseDate(r.완료날짜),
    customer_id: null,
  };
}

/** 앱 기록 → 시트 칸 값 (시트에만 있는 칸은 buildOnsiteValues가 원래 줄에서 그대로 둔다) */
export function visitToSheetFields(v: VisitInput): Partial<Record<OnsiteField, string>> {
  return {
    status: sheetClassOf(v),
    branch: v.branch ?? "",
    priority: v.priority ?? "",
    requested: v.requested ?? "",
    name: v.customer_name,
    phone: v.phone ?? "",
    address: v.address ?? "",
    detail: v.detail ?? "",
    machine: v.machine ?? "",
    model: v.model ?? "",
    technician: v.technician ?? "",
    completed: v.status === "완료" ? v.completed_on ?? "" : "",
  };
}

export async function fetchVisits(): Promise<OnsiteVisit[]> {
  const all: OnsiteVisit[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("onsite_visits").select("*").order("created_at", { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

async function readSheet(): Promise<{ rows: OnsiteRow[]; layout: OnsiteLayout }> {
  const { data, error } = await supabase.functions.invoke("google-sheets", { body: { tab: ONSITE_TAB } });
  if (error || data?.error) throw new Error(data?.error || error?.message || "시트를 읽지 못했어요");
  return parseOnsiteRows(data?.values || []);
}

/**
 * 시트 → 앱. 같은 줄 번호는 시트 내용으로 덮고(앱 전용 칸: 일정·고객 연결·좌표는 유지), 새 줄은 추가한다.
 * 시트에 없는 앱 기록은 그대로 둔다.
 */
export async function importVisitsFromSheet(): Promise<number> {
  const { rows } = await readSheet();
  const records = rows.map(sheetRowToVisit).map(({ scheduled_on: _s, customer_id: _c, ...rest }) => rest);
  for (let i = 0; i < records.length; i += 500) {
    const { error } = await db.from("onsite_visits").upsert(records.slice(i, i + 500), { onConflict: "sheet_row" });
    if (error) throw new Error(error.message);
  }
  return records.length;
}

/** 시트에서 이 기록의 줄 찾기: 줄 번호의 이름이 같으면 그 줄, 아니면 이름+전화로 다시 찾는다 (누가 시트에서 줄을 지웠을 때) */
export function findSheetRow(rows: OnsiteRow[], v: Pick<OnsiteVisit, "sheet_row" | "customer_name" | "phone">, previousName?: string): OnsiteRow | undefined {
  const same = (r: OnsiteRow, name: string) => r.손님성함.trim() === name.trim();
  const names = [previousName, v.customer_name].filter(Boolean) as string[];
  const byRow = v.sheet_row ? rows.find((r) => r._rowIndex === v.sheet_row) : undefined;
  if (byRow && names.some((nm) => same(byRow, nm))) return byRow;
  const digits = (p: string | null | undefined) => (p || "").replace(/\D/g, "");
  return rows.find((r) => names.some((nm) => same(r, nm)) && (!v.phone || digits(r.전화번호) === digits(v.phone)));
}

/** 앱에 저장한 뒤 시트에 따라 쓰기. 실패해도 throw 하지 않고 false. */
export async function mirrorVisit(v: OnsiteVisit, previousName?: string): Promise<boolean> {
  try {
    const { rows, layout } = await readSheet();
    const hit = findSheetRow(rows, v, previousName);
    const values = buildOnsiteValues(layout, visitToSheetFields(v), hit?._raw ?? []);
    if (hit) {
      const { data, error } = await supabase.functions.invoke("google-sheets", { body: { action: "updateRow", sheetName: ONSITE_TAB, rowIndex: hit._rowIndex, values } });
      if (error || data?.error) return false;
      if (hit._rowIndex !== v.sheet_row) await db.from("onsite_visits").update({ sheet_row: hit._rowIndex }).eq("id", v.id);
      return true;
    }
    const { data, error } = await supabase.functions.invoke("google-sheets", { body: { action: "addRow", sheetName: ONSITE_TAB, values } });
    if (error || data?.error) return false;
    const range: string = data?.result?.updates?.updatedRange ?? "";
    const row = Number(range.match(/![A-Z]+(\d+)/)?.[1]);
    if (row > 0) await db.from("onsite_visits").update({ sheet_row: row, sheet_raw: values }).eq("id", v.id);
    return true;
  } catch {
    return false;
  }
}

/** 시트에서 이 기록의 줄 비우기 (앱에서 지웠을 때). 실패해도 false. */
export async function mirrorDelete(v: OnsiteVisit): Promise<boolean> {
  try {
    if (!v.sheet_row) return true;
    const { rows } = await readSheet();
    const hit = findSheetRow(rows, v);
    if (!hit) return true;
    const { data, error } = await supabase.functions.invoke("google-sheets", { body: { action: "clearRow", sheetName: ONSITE_TAB, rowIndex: hit._rowIndex } });
    return !error && !data?.error;
  } catch {
    return false;
  }
}
