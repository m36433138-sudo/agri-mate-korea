import { errorCodeKey, errorCodeSearchText } from "./errorCodes";

export type CatalogEntry = {
  id: string;
  code: string;
  machine_types: string[];
  series: string;
  controller: string | null;
  part: string | null;
  symptom: string | null;
  cause: string | null;
  remedy: string | null;
  recovery: string | null;
  source: string;
  source_url: string | null;
  sort_order: number;
};

export const MACHINE_TYPES = ["이앙기", "트랙터", "콤바인"] as const;

/** Index technicians' records once so each manual code can look up its repairs quickly. */
export function buildRecordIndex<T extends { error_code: string }>(records: T[]) {
  const exact = new Map<string, T[]>();
  const keyed = records.map((record) => ({ record, ...errorCodeKey(record.error_code) }));
  keyed.forEach(({ record, key }) => {
    if (!key) return;
    const list = exact.get(key) ?? [];
    list.push(record);
    exact.set(key, list);
  });
  return (manualCode: string): T[] => {
    const m = errorCodeKey(manualCode);
    if (!m.key) return [];
    if (!m.wildcard) {
      const direct = exact.get(m.key) ?? [];
      const loose = keyed.filter((k) => k.wildcard && k.key && m.key.startsWith(k.key)).map((k) => k.record);
      return loose.length ? [...direct, ...loose] : direct;
    }
    return keyed.filter((k) => k.key.startsWith(m.key)).map((k) => k.record);
  };
}

/** Lowercased haystack for the catalogue search box (code variants + text fields). */
export function catalogHaystack(entry: CatalogEntry): string {
  return [
    errorCodeSearchText(entry.code),
    entry.code,
    entry.series,
    entry.controller,
    entry.part,
    entry.symptom,
    entry.cause,
    entry.remedy,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** "04610", "c1 220", "02000 03" → compact form compared against the code variants. */
export function catalogQueryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,]+/u)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => (/^[0-9a-f.*\-]+$/u.test(token) ? token.replace(/[.\-*]/g, "") : token));
}

export function matchesCatalogQuery(haystack: string, query: string): boolean {
  const tokens = catalogQueryTokens(query);
  if (!tokens.length) return true;
  const compact = haystack.replace(/[\s.\-*]/g, "");
  // 숫자·영문 코드 조각은 띄어쓰기 없이 이어 붙인 형태에서도 찾는다 ("02000 03" → "0200003")
  const joinedCode = tokens.every((t) => /^[0-9a-f]+$/u.test(t)) ? tokens.join("") : null;
  if (joinedCode && compact.includes(joinedCode)) return true;
  return tokens.every((token) => haystack.includes(token) || compact.includes(token));
}

/**
 * 고른 기계에 맞는 매뉴얼인지 점수 (높을수록 먼저): 시리즈에 모델명(YH1150)이 들어 있으면 3,
 * 모델 앞글자 계열(YT·YH·YR·AW·VP·EG·GS)이 같으면 2, 기계 종류(트랙터·콤바인·이앙기)만 같으면 1.
 */
export function machineFitScore(entry: Pick<CatalogEntry, "series" | "machine_types">, model?: string | null, machineType?: string | null): number {
  const series = (entry.series ?? "").toUpperCase();
  const m = (model ?? "").toUpperCase().replace(/\s+/g, "");
  const base = m.match(/^[A-Z]{2,4}\d{2,4}/)?.[0];
  if (base && series.replace(/\s+/g, "").includes(base)) return 3;
  const family = m.match(/^[A-Z]{2}/)?.[0];
  if (family && new RegExp(`\\b${family}\\d|\\b${family}\\s*시리즈`).test(series)) return 2;
  const type = (machineType ?? "").trim() || (/^YT|^EG|^YM/.test(m) ? "트랙터" : /^YH|^AW|^GS/.test(m) ? "콤바인" : /^YR|^VP/.test(m) ? "이앙기" : "");
  if (type && (entry.machine_types ?? []).includes(type)) return 1;
  return 0;
}

/** 검색어에 맞는 매뉴얼 코드를 기계에 맞는 것부터 (검색어가 없으면 빈 목록) */
export function searchCatalogForMachine(entries: CatalogEntry[], query: string, model?: string | null, machineType?: string | null, limit = 12) {
  if (!query.trim()) return [];
  return entries
    .filter((e) => matchesCatalogQuery(catalogHaystack(e), query))
    .map((e) => ({ e, s: machineFitScore(e, model, machineType) }))
    .sort((a, b) => b.s - a.s || a.e.sort_order - b.e.sort_order)
    .slice(0, limit)
    .map(({ e, s }) => ({ entry: e, fit: s }));
}
