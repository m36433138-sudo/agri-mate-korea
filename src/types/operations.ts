export interface SheetRow {
  status_label: string;
  손님성명: string;
  기계: string;
  품목: string;
  전화번호: string;
  주소: string;
  위치: string;
  수리기사: string;
  손님요구사항: string;
  입고일: string;
  수리시작일: string;
  수리완료일: string;
  수리관료일: string;
  출고일: string;
  연락여부: string;
  연락사항: string;
  전체완료: string;
  비고: string;
  _branch: "장흥" | "강진";
  _rowIndex: number; // 1-based row index in the sheet (for write-back)
}

export type OperationStatus = "입고대기" | "수리중" | "출고대기" | "완료";

export function getStatus(row: SheetRow): OperationStatus {
  if (isCompleted(row.전체완료)) return "완료";
  if (row.수리완료일 && !row.출고일) return "출고대기";
  if (row.입고일 && !row.수리완료일) return "수리중";
  return "입고대기";
}

export function isCompleted(val: string): boolean {
  if (!val) return false;
  const v = String(val).trim();
  return ["TRUE", "true", "1", "✓"].includes(v);
}

export function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const cleaned = dateStr.replace(/\s/g, "").replace(/\./g, "-").replace(/-+$/, "");
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

export function formatSheetDate(dateStr: string): string {
  const d = parseSheetDate(dateStr);
  if (!d) return "";
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export function formatSheetDateFull(dateStr: string): string {
  const d = parseSheetDate(dateStr);
  if (!d) return "";
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export function daysBetween(from: string, to: string): number | null {
  const a = parseSheetDate(from);
  const b = parseSheetDate(to);
  if (!a || !b) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

const TECH_COLORS = [
  "#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed",
  "#0891b2", "#be185d", "#65a30d", "#ea580c", "#6366f1",
];

export function getTechnicianColor(name: string): string {
  if (!name) return "#94a3b8";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TECH_COLORS[Math.abs(hash) % TECH_COLORS.length];
}

export function getMachineTypeColor(type: string): { bg: string; text: string } {
  if (type?.includes("트랙터")) return { bg: "bg-green-100", text: "text-green-700" };
  if (type?.includes("콤바인")) return { bg: "bg-blue-100", text: "text-blue-700" };
  if (type?.includes("이앙기")) return { bg: "bg-orange-100", text: "text-orange-700" };
  return { bg: "bg-gray-100", text: "text-gray-600" };
}

export function parseRows(values: string[][], branch: "장흥" | "강진"): SheetRow[] {
  if (!values || values.length < 2) return [];
  return values.slice(1)
    .map((row, idx) => ({
      status_label: (row[0] || "").trim(),
      손님성명: (row[1] || "").trim(),
      기계: (row[2] || "").trim(),
      품목: (row[3] || "").trim(),
      전화번호: (row[4] || "").trim(),
      주소: (row[5] || "").trim(),
      위치: (row[6] || "").trim(),
      수리기사: (row[7] || "").trim(),
      손님요구사항: (row[8] || "").trim(),
      입고일: (row[9] || "").trim(),
      수리시작일: (row[10] || "").trim(),
      수리완료일: (row[11] || "").trim(),
      수리관료일: (row[12] || "").trim(),
      출고일: (row[13] || "").trim(),
      연락여부: (row[14] || "").trim(),
      연락사항: (row[15] || "").trim(),
      전체완료: (row[16] || "").trim(),
      비고: (row[17] || "").trim(),
      _branch: branch,
      _rowIndex: idx + 2, // +2 because row 1 is header, idx is 0-based
    }))
    .filter(row => row.손님성명?.trim()); // CRITICAL: filter empty rows
}
