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
  입력자: string;
  _branch: "장흥" | "강진";
  _rowIndex: number;
  _doneCol: string; // Column letter for 전체완료 (for write-back)
}

export type OperationStatus = "입고대기" | "수리대기" | "수리중" | "수리완료" | "출고대기" | "보류";

const VALID_STATUSES: OperationStatus[] = ["입고대기", "수리대기", "수리중", "수리완료", "출고대기", "보류"];

// Normalize status label variations (e.g. 강진 uses "입고대기중" instead of "입고대기")
function normalizeStatus(label: string): OperationStatus | null {
  if (!label) return null;
  if (VALID_STATUSES.includes(label as OperationStatus)) return label as OperationStatus;
  // Handle common variations
  if (label.includes("입고대기")) return "입고대기";
  if (label.includes("수리대기") || label.includes("수리 대기")) return "수리대기";
  if (label.includes("수리중") || label.includes("수리 중")) return "수리중";
  if (label.includes("수리완료") || label.includes("수리 완료")) return "수리완료";
  if (label.includes("출고대기") || label.includes("출고 대기")) return "출고대기";
  if (label.includes("보류")) return "보류";
  return null;
}

export function getStatus(row: SheetRow): OperationStatus {
  const label = row.status_label?.trim();
  const normalized = normalizeStatus(label);
  if (normalized) return normalized;
  // Fallback to date-based logic
  if (row.수리완료일 && !row.출고일) return "출고대기";
  if (row.수리시작일 && !row.수리완료일) return "수리중";
  if (row.입고일 && !row.수리시작일) return "수리대기";
  return "입고대기";
}

export function isCompleted(val: string): boolean {
  if (!val) return false;
  const v = String(val).trim();
  return ["TRUE", "true", "1", "✓"].includes(v);
}

export function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Handle Korean datetime: "2026. 3. 17 오후 12:46:45" or "2026. 3. 17."
  const koMatch = dateStr.match(
    /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(?:(오전|오후)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (koMatch) {
    const [, y, mo, d, ampm, h, mi, s] = koMatch;
    let hour = h ? parseInt(h, 10) : 0;
    if (ampm === "오후" && hour < 12) hour += 12;
    if (ampm === "오전" && hour === 12) hour = 0;
    return new Date(
      parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10),
      hour, mi ? parseInt(mi, 10) : 0, s ? parseInt(s, 10) : 0
    );
  }

  // Fallback: strip whitespace, replace dots with dashes
  const cleaned = dateStr.replace(/\s/g, "").replace(/\./g, "-").replace(/-+$/, "");
  const dt = new Date(cleaned);
  return isNaN(dt.getTime()) ? null : dt;
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
  // Use header-based mapping for robustness
  const headers = values[0].map(h => (h || "").trim());
  const colIdx = (name: string) => headers.findIndex(h => h.includes(name));

  const iName = colIdx("성함") >= 0 ? colIdx("성함") : colIdx("성명") >= 0 ? colIdx("성명") : 1;
  const iMachine = colIdx("기계") >= 0 ? colIdx("기계") : 2;
  const iModel = colIdx("품목") >= 0 ? colIdx("품목") : 3;
  const iPhone = colIdx("전화") >= 0 ? colIdx("전화") : 4;
  const iAddr = colIdx("주소") >= 0 ? colIdx("주소") : 5;
  const iLoc = colIdx("위치") >= 0 ? colIdx("위치") : 6;
  const iTech = colIdx("수리기사") >= 0 ? colIdx("수리기사") : 7;
  const iReq = colIdx("요구사항") >= 0 ? colIdx("요구사항") : 8;
  const iEntry = colIdx("입고일") >= 0 ? colIdx("입고일") : 9;
  const iRepStart = colIdx("수리시작") >= 0 ? colIdx("수리시작") : 10;
  const iRepDone = colIdx("수리완료") >= 0 ? colIdx("수리완료") : 11;
  const iExit = colIdx("출고일") >= 0 ? colIdx("출고일") : 12;
  const iContact = colIdx("통화") >= 0 ? colIdx("통화") : colIdx("연락여부") >= 0 ? colIdx("연락여부") : 13;
  const iContactNote = colIdx("견적") >= 0 ? colIdx("견적") : colIdx("연락사항") >= 0 ? colIdx("연락사항") : 14;
  const iDone = colIdx("전체") >= 0 ? colIdx("전체") : colIdx("완료") >= 0 ? colIdx("완료") : 15;
  const iNote = colIdx("비고") >= 0 ? colIdx("비고") : 16;

  // Store the actual column letter for the "전체완료" field (for write-back)
  const doneColLetter = String.fromCharCode(65 + iDone); // A=65

  return values.slice(1)
    .map((row, idx) => ({
      status_label: (row[0] || "").trim(),
      손님성명: (row[iName] || "").trim(),
      기계: (row[iMachine] || "").trim(),
      품목: (row[iModel] || "").trim(),
      전화번호: (row[iPhone] || "").trim(),
      주소: (row[iAddr] || "").trim(),
      위치: (row[iLoc] || "").trim(),
      수리기사: (row[iTech] || "").trim(),
      손님요구사항: (row[iReq] || "").trim(),
      입고일: (row[iEntry] || "").trim(),
      수리시작일: (row[iRepStart] || "").trim(),
      수리완료일: (row[iRepDone] || "").trim(),
      수리관료일: "",
      출고일: (row[iExit] || "").trim(),
      연락여부: (row[iContact] || "").trim(),
      연락사항: (row[iContactNote] || "").trim(),
      전체완료: (row[iDone] || "").trim(),
      비고: (row[iNote] || "").trim(),
      _branch: branch,
      _rowIndex: idx + 2,
      _doneCol: doneColLetter,
    }))
    .filter(row => row.손님성명?.trim());
}
