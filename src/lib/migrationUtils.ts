import * as XLSX from "xlsx";

// ── 현재 재직 기사 (이 목록 외 이름은 null 처리) ────────────────────────
export const VALID_TECHNICIANS = new Set(["유호상", "김영일", "마성수", "이재현", "이동진", "주희로"]);

export function normalizeTechnician(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return VALID_TECHNICIANS.has(trimmed) ? trimmed : null;
}

// ── 전화번호 정규화 (하이픈/공백 제거) ────────────────────────────────────
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return String(phone).replace(/[-\s]/g, "").trim();
}

// ── 브랜드 → manufacturer 변환 ────────────────────────────────────────────
export function normalizeManufacturer(brand: string): string {
  const b = String(brand || "").trim();
  if (b === "얀마") return "얀마";
  return b || "기타";
}

// ── 기계 모델명 정규화 ────────────────────────────────────────────────────
// 동일 모델의 다양한 표기를 통일:
//   JD145R, 145R, JD-145R → 145R (존디어)
//   YT5113, YT5113A, YT-5113 → YT5113 (얀마)
const MODEL_ALIASES: Array<{ pattern: RegExp; canonical: string; manufacturer: string }> = [
  // 존디어
  { pattern: /^(?:JD[-\s]?)(\d{2,4}[A-Z]?)$/i,   canonical: "$1",    manufacturer: "존디어" },
  // 얀마 트랙터 (YT, YM 시리즈) - A/B suffix 정규화
  { pattern: /^(YT\d+)[A-Z]?$/i,                   canonical: "$1",    manufacturer: "얀마" },
  { pattern: /^(YM\d+)[A-Z]?$/i,                   canonical: "$1",    manufacturer: "얀마" },
  // 얀마 콤바인 (YH, AW 시리즈)
  { pattern: /^(YH\d+)[A-Z]?$/i,                   canonical: "$1",    manufacturer: "얀마" },
  { pattern: /^(AW\d+)[A-Z]?$/i,                   canonical: "$1",    manufacturer: "얀마" },
  // 얀마 이앙기 (YR, VP 시리즈)
  { pattern: /^(YR\d+)[A-Z]?$/i,                   canonical: "$1",    manufacturer: "얀마" },
  { pattern: /^(VP\d+[A-Z]+?)\d*$/i,               canonical: "$1",    manufacturer: "얀마" },
];

export function normalizeModelName(rawHeader: string, brand: string): string {
  // 기계 헤더에서 첫 번째 모델명 토큰 추출 (공백/괄호 기준)
  const token = (rawHeader || "").split(/[\s\(\/]/)[0].trim().toUpperCase();
  if (!token) return rawHeader?.trim() || "미상";

  for (const alias of MODEL_ALIASES) {
    const m = token.match(alias.pattern);
    if (m) {
      return token.replace(alias.pattern, alias.canonical).toUpperCase();
    }
  }
  return token;
}

export function inferManufacturer(rawHeader: string, brand: string, serialNumber: string): string {
  const s = (serialNumber || "").toUpperCase();
  const h = (rawHeader || "").toUpperCase();

  // 얀마 시리얼 패턴: YMJL, YMJC, YMJS, YMJN ...
  if (/^YMJL|^YMJC|^YMJS|^YMJN/.test(s)) return "얀마";
  // 헤더에서 JD 패턴 → 존디어
  if (/\bJD[-\s]?\d/.test(h)) return "존디어";
  // 얀마 모델명 패턴
  if (/\b(YT|YM|YH|AW|YR|VP)\d/.test(h)) return "얀마";

  return normalizeManufacturer(brand);
}

// ── 수리 유형 매핑 ─────────────────────────────────────────────────────────
export function normalizeRepairType(raw: string): string {
  const t = String(raw || "").trim();
  const map: Record<string, string> = {
    "수리": "수리", "입고수리": "입고수리", "출장수리": "출장수리",
    "정기점검": "정기점검", "클레임": "클레임", "보험수리": "보험수리",
  };
  return map[t] ?? t;
}

// ── 엑셀 날짜 숫자 → YYYY-MM-DD 문자열 ────────────────────────────────────
export function excelDateToString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return String(val).slice(0, 10) || null;
}

// ── 엑셀 파싱 결과 타입 ───────────────────────────────────────────────────
export interface RawCustomer {
  agrimate_id: number;
  branch: string;
  legacy_code: string;
  name: string;
  phone: string;
  address: string;
  registered_at: string;
}

export interface RawMachine {
  branch: string;
  legacy_code: string;     // 고객코드
  customer_name: string;
  machine_category: string; // 트랙터/콤바인/이앙기
  brand: string;
  serial_number: string;
  model_header: string;    // 기계 헤더(컨텍스트)
  entry_date: string;
}

export interface RawAttachment {
  branch: string;
  legacy_code: string;
  customer_name: string;
  parent_serial: string;   // 본기 제조번호
  attach_type: string;     // 작업기 유형
  serial_number: string;
  model_header: string;
  date: string;
}

export interface RawRepair {
  branch: string;
  legacy_code: string;
  customer_name: string;
  repair_date: string;
  serial_number: string;
  model_header: string;
  repair_type: string;
  technician: string;
  hours: string;
  cost_labor: number;
  cost_parts: number;
  parts_count: number;
  content: string;
}

// ── 엑셀 파일 → 4개 시트 파싱 ────────────────────────────────────────────
export function parseExcel(file: File): Promise<{
  customers: RawCustomer[];
  machines: RawMachine[];
  attachments: RawAttachment[];
  repairs: RawRepair[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: false });

        const toRows = (sheetIdx: number): string[][] => {
          const ws = wb.Sheets[wb.SheetNames[sheetIdx]];
          return XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
        };

        // Sheet2: 고객 (헤더 1행, 데이터 2행~)
        const custRows = toRows(1).slice(1);
        const customers: RawCustomer[] = custRows
          .filter(r => r[0] && r[4])
          .map(r => ({
            agrimate_id: Number(r[0]),
            branch: String(r[2] || "").trim(),
            legacy_code: String(r[3] || "").trim(),
            name: String(r[4] || "").trim(),
            phone: normalizePhone(r[5]),
            address: String(r[7] || "").trim(),
            registered_at: excelDateToString(r[8]) ?? "",
          }));

        // Sheet3: 본기 (헤더 1행)
        const machRows = toRows(2).slice(1);
        const machines: RawMachine[] = machRows
          .filter(r => r[5] && String(r[5]).trim())
          .map(r => ({
            branch: String(r[0] || "").trim(),
            legacy_code: String(r[1] || "").trim(),
            customer_name: String(r[2] || "").trim(),
            machine_category: String(r[3] || "").trim(),
            brand: String(r[4] || "").trim(),
            serial_number: String(r[5] || "").trim(),
            model_header: String(r[6] || "").trim(),
            entry_date: excelDateToString(r[7]) ?? "",
          }));

        // Sheet4: 작업기 (헤더 1행)
        const attachRows = toRows(3).slice(1);
        const attachments: RawAttachment[] = attachRows
          .filter(r => r[5] && String(r[5]).trim())
          .map(r => ({
            branch: String(r[0] || "").trim(),
            legacy_code: String(r[1] || "").trim(),
            customer_name: String(r[2] || "").trim(),
            parent_serial: String(r[3] || "").trim(),
            attach_type: String(r[4] || "").trim(),
            serial_number: String(r[5] || "").trim(),
            model_header: String(r[6] || "").trim(),
            date: excelDateToString(r[7]) ?? "",
          }));

        // Sheet6: 수리이력 (헤더 1행) — 날짜 오름차순 정렬
        const repairRows = toRows(5).slice(1);
        const repairs: RawRepair[] = repairRows
          .filter(r => r[3] && r[13])
          .map(r => ({
            branch: String(r[0] || "").trim(),
            legacy_code: String(r[1] || "").trim(),
            customer_name: String(r[2] || "").trim(),
            repair_date: excelDateToString(r[3]) ?? "",
            serial_number: String(r[4] || "").trim(),
            model_header: String(r[5] || "").trim(),
            repair_type: normalizeRepairType(r[6]),
            technician: String(r[7] || "").trim(),
            hours: String(r[9] || "").trim(),
            cost_labor: Number(r[10]) || 0,
            cost_parts: Number(r[11]) || 0,
            parts_count: Number(r[12]) || 0,
            content: String(r[13] || "").trim(),
          }))
          .sort((a, b) => (a.repair_date > b.repair_date ? 1 : -1));

        resolve({ customers, machines, attachments, repairs });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
