import { supabase } from "@/integrations/supabase/client";

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