#!/usr/bin/env node
/**
 * 1회성 데이터 이전 스크립트:
 *   구글시트(장흥/강진/완료된 항목/방문수리) → Supabase (operation_rows / visit_repair_rows)
 *
 * 사용법:
 *   node scripts/import-sheet-to-db.mjs
 *
 * 필요 ENV:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_SHEETS_ID, GOOGLE_SHEETS_API_KEY  (읽기 전용으로 충분)
 *
 * 멱등성: branch+row_index UNIQUE → 같은 행은 upsert로 덮어씀.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing SUPABASE_URL / SERVICE_ROLE_KEY"); process.exit(1); }
if (!SHEET_ID || !SHEETS_API_KEY) { console.error("Missing GOOGLE_SHEETS_ID / GOOGLE_SHEETS_API_KEY"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function fetchTab(tab) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tab)}?key=${SHEETS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.values || [];
}

function colIdx(headers, ...keys) {
  for (const k of keys) {
    const i = headers.findIndex((h) => (h || "").includes(k));
    if (i >= 0) return i;
  }
  return -1;
}

function parseOperationRows(values, branch, sourceTab) {
  if (values.length < 2) return [];
  const headers = values[0].map((h) => (h || "").trim());
  const iName = colIdx(headers, "성함", "성명");
  const iMachine = colIdx(headers, "기계");
  const iModel = colIdx(headers, "품목");
  const iPhone = colIdx(headers, "전화");
  const iAddr = colIdx(headers, "주소");
  const iLoc = colIdx(headers, "위치");
  const iTech = colIdx(headers, "수리기사");
  const iReq = colIdx(headers, "요구사항");
  const iSerial = colIdx(headers, "제조번호");
  const iEntry = colIdx(headers, "입고일");
  const iRepStart = colIdx(headers, "수리시작");
  const iRepDone = colIdx(headers, "수리완료");
  const iExit = colIdx(headers, "출고일");
  const iContact = colIdx(headers, "통화", "연락여부");
  const iContactNote = colIdx(headers, "견적", "연락사항");
  const iDone = colIdx(headers, "전체", "완료");
  const iNote = colIdx(headers, "비고");
  const iWriter = colIdx(headers, "입력자");

  const out = [];
  values.slice(1).forEach((row, idx) => {
    const name = (row[iName] || "").trim();
    if (!name) return;
    const doneVal = (row[iDone] || "").trim();
    out.push({
      branch, source_tab: sourceTab, row_index: idx + 2,
      status_label: (row[0] || "").trim() || null,
      customer_name: name,
      machine: (row[iMachine] || "").trim() || null,
      model: (row[iModel] || "").trim() || null,
      phone: (row[iPhone] || "").trim() || null,
      address: (row[iAddr] || "").trim() || null,
      location: (row[iLoc] || "").trim() || null,
      technician: (row[iTech] || "").trim() || null,
      requirements: (row[iReq] || "").trim() || null,
      serial_number: (row[iSerial] || "").trim() || null,
      entry_date: (row[iEntry] || "").trim() || null,
      repair_start_date: (row[iRepStart] || "").trim() || null,
      repair_done_date: (row[iRepDone] || "").trim() || null,
      dispatch_date: (row[iExit] || "").trim() || null,
      contacted: (row[iContact] || "").trim() || null,
      contact_note: (row[iContactNote] || "").trim() || null,
      is_completed: ["TRUE", "true", "1", "✓"].includes(doneVal),
      notes: (row[iNote] || "").trim() || null,
      writer: iWriter >= 0 ? ((row[iWriter] || "").trim() || null) : null,
    });
  });
  return out;
}

function parseVisitRows(values) {
  if (values.length < 2) return [];
  const headers = values[0].map((h) => (h || "").trim());
  const iStatus = colIdx(headers, "진행");
  const iName = colIdx(headers, "성함", "성명");
  const iMachine = colIdx(headers, "기계");
  const iModel = colIdx(headers, "품목");
  const iPhone = colIdx(headers, "전화");
  const iAddr = colIdx(headers, "주소");
  const iDetail = colIdx(headers, "내역");

  const out = [];
  values.slice(1).forEach((row, idx) => {
    const name = (row[iName] || "").trim();
    if (!name) return;
    const status = (row[iStatus] || "").trim();
    out.push({
      row_index: idx + 2,
      status_label: status || null,
      customer_name: name,
      machine: (row[iMachine] || "").trim() || null,
      model: (row[iModel] || "").trim() || null,
      phone: (row[iPhone] || "").trim() || null,
      address: (row[iAddr] || "").trim() || null,
      requirements: (row[iDetail] || "").trim() || null,
      is_completed: status === "완료",
    });
  });
  return out;
}

async function upsertChunked(table, rows, conflictKeys) {
  if (rows.length === 0) return 0;
  const SIZE = 200;
  let total = 0;
  for (let i = 0; i < rows.length; i += SIZE) {
    const chunk = rows.slice(i, i + SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: conflictKeys });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
    total += chunk.length;
  }
  return total;
}

(async () => {
  console.log("→ 장흥(입출수)");
  const jh = parseOperationRows(await fetchTab("장흥(입출수)"), "장흥", "active");
  console.log(`  ${jh.length}행 파싱됨`);

  console.log("→ 강진(입출수)");
  const gj = parseOperationRows(await fetchTab("강진(입출수)"), "강진", "active");
  console.log(`  ${gj.length}행 파싱됨`);

  let archive = [];
  try {
    console.log("→ 완료된 항목");
    const arc = await fetchTab("완료된 항목");
    archive = parseOperationRows(arc, "장흥", "archive").map((r) => ({
      ...r, branch: r.location?.includes("강진") ? "강진" : "장흥",
    }));
    console.log(`  ${archive.length}행 파싱됨`);
  } catch (e) { console.warn("  완료된 항목 탭 건너뜀:", e.message); }

  let visits = [];
  try {
    console.log("→ 방문수리");
    visits = parseVisitRows(await fetchTab("방문수리"));
    console.log(`  ${visits.length}행 파싱됨`);
  } catch (e) { console.warn("  방문수리 탭 건너뜀:", e.message); }

  console.log("\n← Supabase upsert");
  const opCount = await upsertChunked("operation_rows", [...jh, ...gj, ...archive], "branch,source_tab,row_index");
  const vcCount = await upsertChunked("visit_repair_rows", visits, "row_index");
  console.log(`✓ operation_rows: ${opCount}건`);
  console.log(`✓ visit_repair_rows: ${vcCount}건`);
  console.log("\n완료. 앱은 즉시 새 데이터를 사용합니다.");
})().catch((e) => { console.error("실패:", e); process.exit(1); });
