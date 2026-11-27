import { useQuery } from "@tanstack/react-query";
import { db } from "@/components/partReceipts/receiptData";

export const WAREHOUSES = ["장흥", "강진"] as const;
export type Warehouse = (typeof WAREHOUSES)[number];
export const otherWarehouse = (w: Warehouse): Warehouse => (w === "장흥" ? "강진" : "장흥");

/** 옮길 줄: 보내는 창고 재고(stock)를 넘을 수 없다 */
export type TransferLine = { part_code: string; part_name: string; quantity: number; stock: number; to_location: string; dest_qty: number | null; dest_location: string | null };

export function addTransferLine(list: TransferLine[], it: Omit<TransferLine, "quantity" | "to_location">): TransferLine[] {
  const i = list.findIndex((x) => x.part_code === it.part_code);
  if (i >= 0) return list.map((x, j) => (j === i ? { ...x, quantity: Math.min(x.stock, x.quantity + 1) } : x));
  return [...list, { ...it, quantity: Math.min(1, it.stock), to_location: "" }];
}

export function validateTransfer(lines: TransferLine[]): string | null {
  if (!lines.length) return "옮길 부품을 담아 주세요";
  const bad = lines.find((l) => !(l.quantity > 0));
  if (bad) return `${bad.part_name || bad.part_code}: 수량은 1개 이상이어야 해요`;
  const over = lines.find((l) => l.quantity > l.stock);
  if (over) return `${over.part_name || over.part_code}: 보내는 창고 재고가 ${over.stock}개뿐이에요`;
  return null;
}

export function transferPayload(lines: TransferLine[]) {
  return lines.map((l) => ({ part_code: l.part_code, quantity: l.quantity, to_location: l.to_location.trim() || null }));
}

export type PartTransfer = {
  id: string; from_branch: string; to_branch: string; memo: string | null; moved_by_name: string | null; created_at: string;
  part_transfer_items: { id: string; part_code: string; part_name: string; quantity: number; from_qty_after: number | null; to_qty_after: number | null; to_location: string | null }[];
};

export function usePartTransfers() {
  return useQuery({
    queryKey: ["part-transfers"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db.from("part_transfers")
        .select("*, part_transfer_items(id, part_code, part_name, quantity, from_qty_after, to_qty_after, to_location)")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as PartTransfer[];
    },
  });
}

export async function transferParts(from: Warehouse, to: Warehouse, lines: TransferLine[], memo: string, byName: string | null): Promise<string> {
  const { data, error } = await db.rpc("transfer_parts", { _from: from, _to: to, _items: transferPayload(lines), _memo: memo || null, _by_name: byName });
  if (error) throw new Error(error.message);
  return data as string;
}
