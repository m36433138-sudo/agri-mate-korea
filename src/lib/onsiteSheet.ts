/** 방문수리 화면은 구글 시트 「출장」 탭을 읽고 쓴다. 칸 위치는 머리글 이름으로 찾아, 시트 칸 순서가 바뀌어도 맞게 동작한다. */
export const ONSITE_TAB = "출장";

export type OnsiteField = "status" | "branch" | "name" | "phone" | "address" | "detail" | "machine" | "model" | "technician" | "priority" | "requested" | "completed";
export type OnsiteLayout = Record<OnsiteField, number>;

export interface OnsiteRow {
  진행사항: string;
  지점: string;
  손님성함: string;
  기계: string;
  품목: string;
  전화번호: string;
  주소: string;
  내역: string;
  출장기사: string;
  우선순위: string;
  요구날짜: string;
  완료날짜: string;
  _rowIndex: number;
  _raw: string[];
}

// 「출장」 탭 기본 칸 순서 (머리글을 못 찾을 때)
const DEFAULT_LAYOUT: OnsiteLayout = { status: 0, branch: 1, priority: 2, requested: 3, name: 4, phone: 5, address: 7, detail: 8, machine: 9, model: 10, technician: 11, completed: 12 };

const clean = (s: string) => (s || "").replace(/\s+/g, "");

export function onsiteLayout(headerRow: string[] | undefined): OnsiteLayout {
  const h = (headerRow || []).map(clean);
  const find = (test: (x: string) => boolean) => h.findIndex(test);
  const pick = (k: OnsiteField, test: (x: string) => boolean) => { const i = find(test); return i >= 0 ? i : DEFAULT_LAYOUT[k]; };
  return {
    status: pick("status", (x) => x === "분류" || x.includes("진행")),
    branch: pick("branch", (x) => x === "업무분류" || x === "지점"),
    name: pick("name", (x) => x.includes("손님") || x.includes("성함") || x.includes("성명")),
    phone: pick("phone", (x) => x.includes("전화")),
    address: pick("address", (x) => x.includes("주소")),
    detail: pick("detail", (x) => x.includes("요구사항") || x.includes("에러") || x.includes("내역")),
    machine: pick("machine", (x) => x === "기계"),
    model: pick("model", (x) => x.includes("품목")),
    technician: pick("technician", (x) => x.includes("기사")),
    priority: pick("priority", (x) => x.includes("우선")),
    requested: pick("requested", (x) => x.includes("요구날짜") || x.includes("요청일") || x.includes("요청날짜")),
    completed: pick("completed", (x) => x.includes("완료날짜") || x.includes("완료일")),
  };
}

export function parseOnsiteRows(values: string[][]): { rows: OnsiteRow[]; layout: OnsiteLayout } {
  const layout = onsiteLayout(values?.[0]);
  if (!values || values.length < 2) return { rows: [], layout };
  const g = (row: string[], k: OnsiteField) => (row[layout[k]] || "").trim();
  const rows = values.slice(1)
    .map((row, idx) => ({
      진행사항: g(row, "status"),
      지점: g(row, "branch"),
      손님성함: g(row, "name"),
      기계: g(row, "machine"),
      품목: g(row, "model"),
      전화번호: g(row, "phone"),
      주소: g(row, "address"),
      내역: g(row, "detail"),
      출장기사: g(row, "technician"),
      우선순위: g(row, "priority"),
      요구날짜: g(row, "requested"),
      완료날짜: g(row, "completed"),
      _rowIndex: idx + 2,
      _raw: row,
    }))
    .filter((r) => r.손님성함);
  return { rows, layout };
}

/** 저장할 한 줄: 기존 줄의 다른 칸(우선순위·요구 날짜·완료날짜 등)은 그대로 두고 화면에서 고친 칸만 바꾼다 */
export function buildOnsiteValues(layout: OnsiteLayout, fields: Partial<Record<OnsiteField, string>>, raw: string[] = []): string[] {
  const width = Math.max(raw.length, ...Object.values(layout).map((i) => i + 1));
  const out = Array.from({ length: width }, (_, i) => raw[i] ?? "");
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) out[layout[k as OnsiteField]] = v;
  return out;
}
