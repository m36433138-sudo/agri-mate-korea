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
