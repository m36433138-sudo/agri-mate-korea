import type { EstimateItem } from "@/lib/insuranceEstimate";

type RowLike = { part_number: string; quantity: number; unit_price: number; fromTemplate?: string };

const norm = (c: string | null | undefined) => (c || "").replace(/\s+/g, "").toUpperCase();

/** "YH6140 (SN123)" → "YH6140" — 도면 기종 필터에 쓸 모델명 */
export const modelFromMachineLabel = (label?: string | null) => {
  const m = (label || "").replace(/\s*\(.*$/, "").trim();
  return m || null;
};

/**
 * 도면에서 고른 부품을 수리 부품 목록에 합친다.
 * 같은 부품번호(템플릿 줄 제외)가 있으면 수량을 더하고, 단가가 비어 있으면 도면 쪽 가격으로 채운다.
 */
export function mergeDiagramParts<T extends RowLike>(rows: T[], picked: EstimateItem[], make: (it: EstimateItem) => T): T[] {
  const next = [...rows];
  for (const it of picked) {
    const code = norm(it.part_code);
    const idx = code ? next.findIndex((r) => !r.fromTemplate && norm(r.part_number) === code) : -1;
    if (idx >= 0) {
      const r = next[idx];
      next[idx] = { ...r, quantity: (Number(r.quantity) || 0) + it.quantity, unit_price: r.unit_price || it.unit_price || 0 };
    } else {
      next.push(make(it));
    }
  }
  return next;
}

/** 수리 부품 줄을 도면 창 오른쪽 목록 형식으로 보여 주기 위한 변환 (key = 줄 번호) */
export const rowsToPanelItems = (rows: { part_number: string; part_name: string; quantity: number; unit_price: number }[]): EstimateItem[] =>
  rows.map((r, i) => ({
    key: String(i),
    item_type: "부품" as const,
    part_code: r.part_number || "",
    part_name: r.part_name,
    quantity: Number(r.quantity) || 1,
    unit_price: Number(r.unit_price) || 0,
  }));
