/** 부품 입고(거래명세서 → 입고 대기 → 창고 확인) 공용 계산 */

export type Branch = "장흥" | "강진";
export type VendorRow = { id: string; name: string; business_number: string | null; items?: string | null };
export type StockRow = { branch: string; part_code: string; part_name?: string | null; location_main: string | null; sales_price?: number | null; quantity?: number | null };

/** 사업자번호는 숫자만 비교 */
export const bizDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** 상호 비교용: (주)·주식회사·㈜·공백·특수문자 제거, 소문자 */
export function normalizeVendorName(s: string | null | undefined) {
  return (s ?? "")
    .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|co\.?,?\s*ltd\.?|inc\.?/gi, "")
    .replace(/[\s()[\]{}.,·\-_/]/g, "")
    .toLowerCase();
}

/** 거래처 찾기: 사업자번호가 같으면 확정, 아니면 상호가 같거나 한쪽이 다른 쪽을 포함 */
export function matchVendor(vendors: VendorRow[], name: string | null, businessNumber: string | null): VendorRow | null {
  const biz = bizDigits(businessNumber);
  if (biz.length >= 10) {
    const byBiz = vendors.find((v) => bizDigits(v.business_number) === biz);
    if (byBiz) return byBiz;
  }
  const n = normalizeVendorName(name);
  if (n.length < 2) return null;
  return (
    vendors.find((v) => normalizeVendorName(v.name) === n) ??
    vendors.find((v) => {
      const vn = normalizeVendorName(v.name);
      return vn.length >= 2 && (vn.includes(n) || n.includes(vn));
    }) ??
    null
  );
}

/** 얀마 거래처: 이름에 얀마/YANMAR가 들어간 거래처 */
export const findYanmarVendor = (vendors: VendorRow[]) =>
  vendors.find((v) => /얀마|yanmar/i.test(v.name)) ?? null;

/**
 * 명세서의 위치 칸이 어느 지점 재고 위치와 많이 겹치는지로 지점을 추정.
 * 같은 부품이 같은 위치에 있으면 1점. 근거가 없으면 null.
 */
export function guessBranch(lines: { partCode: string; location: string | null }[], stock: StockRow[]): Branch | null {
  const score: Record<Branch, number> = { 장흥: 0, 강진: 0 };
  for (const l of lines) {
    if (!l.location) continue;
    for (const s of stock) {
      if (s.part_code === l.partCode && (s.location_main ?? "").trim().toUpperCase() === l.location.toUpperCase()) {
        if (s.branch === "장흥" || s.branch === "강진") score[s.branch] += 1;
      }
    }
  }
  if (score.장흥 === score.강진) return null;
  return score.장흥 > score.강진 ? "장흥" : "강진";
}

/**
 * 부품번호가 없는 일반 부품의 재고 번호. 같은 거래처의 같은 품명이면 같은 번호가 되어
 * 다음 입고 때 같은 재고에 더해진다. (직원이 입고 화면에서 고칠 수 있다)
 */
export function generalPartCode(vendorName: string | null, description: string) {
  const v = normalizeVendorName(vendorName).slice(0, 8) || "일반";
  const d = description.normalize("NFC").replace(/\s+/g, "").replace(/[^0-9A-Za-z가-힣\-x×*/.]/g, "").toUpperCase().slice(0, 24);
  return `${v}-${d || "품목"}`;
}

/** 이미 부품번호처럼 생긴 글자를 품목 설명에서 뽑는다 (예: "필터 1A1040-26060") */
export function codeFromDescription(description: string): string | null {
  const m = /\b([0-9A-Z]{2,}[0-9A-Z]*(?:-[0-9A-Z]{2,})+)\b/.exec(description.toUpperCase());
  return m ? m[1] : null;
}

/** 위치 기본값: 명세서 위치 → 그 지점의 기존 재고 위치 */
export function defaultLocation(branch: string, partCode: string, statementLocation: string | null, stock: StockRow[]) {
  if (statementLocation) return statementLocation;
  return stock.find((s) => s.branch === branch && s.part_code === partCode)?.location_main ?? null;
}
