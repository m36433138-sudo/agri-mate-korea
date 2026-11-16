/**
 * 부품번호 검색어 → 서버 조회 조건.
 * 「77200」처럼 뒷자리만, 「12996177200」처럼 하이픈 없이 쳐도 129961-77200을 찾는다.
 */
export function partQueryVariants(term: string): string[] {
  const t = term.trim().replace(/[,()*%\\]/g, "");
  if (!t) return [];
  const out = new Set<string>([t]);
  const bare = t.replace(/[\s-]/g, "").toUpperCase();
  if (/^[0-9A-Z]{9,14}$/.test(bare) && !t.includes("-")) {
    // 얀마 번호는 5-6 / 6-5 / 6-6 자리 묶음이라 하이픈을 넣어 본다
    for (const cut of [5, 6]) if (bare.length - cut >= 4) out.add(`${bare.slice(0, cut)}-${bare.slice(cut)}`);
  }
  return [...out];
}

/** PostgREST .or() 문자열 (부품코드·부품명·설계변경코드 부분 일치) */
export function inventorySearchFilter(term: string): string {
  const parts: string[] = [];
  for (const v of partQueryVariants(term)) {
    parts.push(`part_code.ilike.%${v}%`, `alt_part_code.ilike.%${v}%`);
  }
  const name = term.trim().replace(/[,()*%\\]/g, "");
  if (name) parts.push(`part_name.ilike.%${name}%`);
  return parts.join(",");
}
