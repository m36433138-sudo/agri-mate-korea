export interface SheetRow {
  L: string;
  손님성명: string;
  기계: string;
  품목: string;
  전화번호: string;
  주소: string;
  위치: string;
  수리기사: string;
  손님요구사항: string;
  수리대기기간: string;
  입고일: string;
  수리시작일: string;
  수리완료일: string;
  수리관료일: string;
  출고일: string;
  연락여부: string;
  연락사항: string;
  전체완료: string;
  _branch: "장흥" | "강진";
}

export type OperationStatus = "입고대기" | "수리중" | "출고대기" | "완료";

export function getStatus(row: SheetRow): OperationStatus {
  const completed = isCompleted(row.전체완료);
  if (completed) return "완료";
  if (row.수리완료일 && !row.출고일) return "출고대기";
  if (row.입고일 && !row.수리완료일) return "수리중";
  return "입고대기";
}

export function isCompleted(val: string): boolean {
  if (!val) return false;
  const v = val.trim().toUpperCase();
  return v === "TRUE" || v === "1" || v === "✓" || v === "O" || v === "완료";
}

export function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Handle formats: "2026. 3. 9", "2026.3.9", "2026-03-09", "2026. 03. 09"
  const cleaned = dateStr.replace(/\s/g, "").replace(/\./g, "-").replace(/-+$/, "");
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

export function formatSheetDate(dateStr: string): string {
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

// Consistent color for technician names
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

export function parseRows(values: string[][], branch: "장흥" | "강진"): SheetRow[] {
  if (!values || values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(row => row.some(cell => cell?.trim())).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h?.trim() || `col${i}`] = (row[i] || "").trim();
    });
    return {
      L: obj["L"] || obj["l"] || row[0] || "",
      손님성명: obj["손님 성명"] || obj["손님성명"] || row[1] || "",
      기계: obj["기계"] || row[2] || "",
      품목: obj["품목"] || row[3] || "",
      전화번호: obj["전화번호"] || row[4] || "",
      주소: obj["주소"] || row[5] || "",
      위치: obj["위치"] || row[6] || "",
      수리기사: obj["수리기사"] || row[7] || "",
      손님요구사항: obj["손님 요구사항"] || obj["손님요구사항"] || row[8] || "",
      수리대기기간: obj["수리대기기간"] || obj["수리대기기간"] || row[9] || "",
      입고일: obj["입고일"] || row[10] || "",
      수리시작일: obj["수리시작일"] || row[11] || "",
      수리완료일: obj["수리완료일"] || row[12] || "",
      수리관료일: obj["수리관료일"] || row[13] || "",
      출고일: obj["출고일"] || row[14] || "",
      연락여부: obj["연락여부"] || row[15] || "",
      연락사항: obj["연락 사항/특번"] || obj["연락사항"] || row[16] || "",
      전체완료: obj["전체 완료"] || obj["전체완료"] || row[17] || "",
      _branch: branch,
    };
  });
}
