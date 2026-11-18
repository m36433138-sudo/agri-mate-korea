/** 얀마 공급가 표는 부가세 별도, 우리 매출가는 부가세 포함. */
export const PART_VAT_RATE = 0.1;
export const YANMAR_MARGIN_RATE = 0.35;

/** 100원 단위 반올림(십의 자리에서 반올림). */
export function roundTo100(value: number): number {
  return Math.floor(value / 100 + 0.5 + 1e-9) * 100;
}

/** 얀마 공급가(부가세 별도) → 매출가(부가세 포함). 공급가가 없거나 0이면 null. */
export function yanmarSalesPrice(
  supplyPrice: number | null | undefined,
  margin = YANMAR_MARGIN_RATE,
  vat = PART_VAT_RATE,
): number | null {
  if (supplyPrice == null || !Number.isFinite(supplyPrice) || supplyPrice <= 0) return null;
  return roundTo100(supplyPrice * (1 + vat) * (1 + margin));
}

export function normalizePartCode(code: string): string {
  return code.trim().toUpperCase();
}

export type PartOrigin = "yanmar" | "other";

/** 저장 전 필수값 확인: 타사 부품은 매입가·매출가 모두 필요. */
export function missingPriceFields(origin: PartOrigin, purchase: string, sales: string): string[] {
  const missing: string[] = [];
  if (origin === "other") {
    if (!purchase.trim()) missing.push("매입가");
    if (!sales.trim()) missing.push("매출가");
  }
  return missing;
}
