import { supabase } from "@/integrations/supabase/client";
import { resolvePartPrice, type PartPrice } from "@/lib/partPricing";

export type DiagramInventoryRow = {
  id: string; part_code: string; alt_part_code: string | null; part_name: string | null;
  branch: string; quantity: number | null; location_main: string | null; location_sub: string | null;
  purchase_price: number | null; sales_price: number | null;
};

export function matchesInventory(code: string, row: Pick<DiagramInventoryRow, "part_code" | "alt_part_code">) {
  const target = code.trim().toUpperCase();
  return [row.part_code, row.alt_part_code].some((value) => {
    const candidate = value?.trim().toUpperCase();
    return !!candidate && (candidate === target || candidate.startsWith(`${target}-`));
  });
}

export async function fetchDiagramInventory(codes: string[], signal?: AbortSignal): Promise<DiagramInventoryRow[]> {
  const safeCodes = [...new Set(codes.map((c) => c.trim().toUpperCase()))].filter((c) => /^[A-Z0-9-]+$/.test(c));
  const rows = new Map<string, DiagramInventoryRow>();
  for (let offset = 0; offset < safeCodes.length; offset += 20) {
    const batch = safeCodes.slice(offset, offset + 20);
    const filter = batch.flatMap((c) => [`part_code.eq.${c}`, `alt_part_code.eq.${c}`, `part_code.like.${c}-*`, `alt_part_code.like.${c}-*`]).join(",");
    for (let from = 0; ; from += 1000) {
      let query = supabase.from("inventory").select("id, part_code, alt_part_code, part_name, branch, quantity, location_main, location_sub, purchase_price, sales_price")
        .or(filter).order("id").range(from, from + 999);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (error) throw error;
      (data || []).forEach((row) => rows.set(row.id, row as DiagramInventoryRow));
      if ((data || []).length < 1000) break;
    }
  }
  return [...rows.values()];
}

export function inventoryBranchName(branch: string) {
  if (/^(Jangheung|00|장흥)/i.test(branch)) return "장흥";
  if (/^(Gangjin|01|강진)/i.test(branch)) return "강진";
  return branch;
}
const safeCode = (c: string) => c.trim().toUpperCase();

/** 재고에 등록된 매출가(0원은 미등록으로 본다) */
export function inventoryPriceOf(code: string, rows: DiagramInventoryRow[]): number | null {
  const hit = rows.find((r) => matchesInventory(code, r) && Number(r.sales_price) > 0);
  return hit ? Number(hit.sales_price) : null;
}

/** 얀마 공급가표(부가세 별도) 공급가: 부품번호(대문자) → 공급가 */
export async function fetchSupplyPrices(codes: string[], signal?: AbortSignal): Promise<Map<string, number>> {
  const list = [...new Set(codes.map(safeCode))].filter((c) => /^[A-Z0-9-]+$/.test(c));
  const out = new Map<string, number>();
  for (let i = 0; i < list.length; i += 150) {
    let query = (supabase as any).from("yanmar_supply_prices").select("part_code, supply_price").in("part_code", list.slice(i, i + 150));
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    for (const r of data || []) if (Number(r.supply_price) > 0) out.set(safeCode(r.part_code), Number(r.supply_price));
  }
  return out;
}

/** 재고 매출가 → 없으면 공급가표 매출가. 재고 행을 이미 받아 왔으면 rows로 넘긴다 */
export async function fetchPartPrices(codes: string[], rows?: DiagramInventoryRow[], signal?: AbortSignal): Promise<Map<string, PartPrice | null>> {
  const [inv, supply] = await Promise.all([
    rows ? Promise.resolve(rows) : fetchDiagramInventory(codes, signal).catch(() => [] as DiagramInventoryRow[]),
    fetchSupplyPrices(codes, signal).catch(() => new Map<string, number>()),
  ]);
  return new Map(codes.map((c) => [c, resolvePartPrice(inventoryPriceOf(c, inv), supply.get(safeCode(c)))]));
}
