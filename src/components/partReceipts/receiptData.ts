import { supabase } from "@/integrations/supabase/client";
import type { StockRow, VendorRow } from "@/lib/partReceipts";
import { findYanmarVendor, matchVendor } from "@/lib/partReceipts";

export const db = supabase as any;
export const RECEIPT_BUCKET = "receipts";
export const PHOTO_BUCKET = "part-photos";

export type ReceiptItemDraft = {
  line_no: number;
  part_code: string;
  alt_part_code: string | null;
  part_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  location: string | null;
};

export type PartReceipt = {
  id: string;
  source: "yanmar" | "general";
  vendor_id: string | null;
  vendor_name: string | null;
  business_number: string | null;
  doc_number: string | null;
  doc_date: string;
  branch: "장흥" | "강진";
  status: "pending" | "partial" | "done" | "cancelled";
  supply_amount: number | null;
  vat_amount: number | null;
  total_amount: number | null;
  expense_group: string | null;
  file_path: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  part_receipt_items?: { id: string; status: string; quantity: number }[];
};

export type PartReceiptItem = {
  id: string;
  receipt_id: string;
  line_no: number;
  part_code: string;
  alt_part_code: string | null;
  part_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  location: string | null;
  status: "pending" | "received" | "missing";
  received_qty: number | null;
  received_location: string | null;
  received_at: string | null;
};

export async function loadVendors(): Promise<VendorRow[]> {
  const { data, error } = await db.from("vendors").select("id, name, business_number, items").order("name");
  if (error) throw error;
  return data ?? [];
}

/** 두 지점 재고에서 부품번호들 찾기 (이름·위치·매출가 채우기용) */
export async function loadStockFor(codes: string[]): Promise<StockRow[]> {
  const uniq = [...new Set(codes.filter(Boolean))];
  const out: StockRow[] = [];
  for (let i = 0; i < uniq.length; i += 200) {
    const { data, error } = await db.from("inventory")
      .select("branch, part_code, part_name, location_main, sales_price, quantity")
      .in("part_code", uniq.slice(i, i + 200));
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

/** 거래처를 찾고, 없으면 새로 등록한다 (얀마는 이름으로 따로 찾는다) */
export async function ensureVendor(
  vendors: VendorRow[],
  v: { name: string | null; business_number: string | null; yanmar?: boolean; itemsHint?: string },
): Promise<VendorRow | null> {
  const found = v.yanmar ? findYanmarVendor(vendors) : matchVendor(vendors, v.name, v.business_number);
  if (found) {
    if (!found.business_number && v.business_number) {
      await db.from("vendors").update({ business_number: v.business_number }).eq("id", found.id);
    }
    return found;
  }
  const name = (v.yanmar ? "얀마" : v.name)?.trim();
  if (!name) return null;
  const { data, error } = await db.from("vendors")
    .insert({ name, business_number: v.business_number || null, items: v.itemsHint ?? (v.yanmar ? "얀마 순정부품" : null), notes: "거래명세서로 자동 등록" })
    .select("id, name, business_number, items").single();
  if (error) throw error;
  return data;
}

/** 입고 대기 문서 + 줄 저장. 줄 저장이 실패하면 문서도 지운다. */
export async function createPartReceipt(
  receipt: Omit<PartReceipt, "id" | "status" | "created_at" | "completed_at" | "part_receipt_items">,
  items: ReceiptItemDraft[],
): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await db.from("part_receipts").insert({ ...receipt, created_by: u.user?.id }).select("id").single();
  if (error) {
    if (String(error.message).includes("part_receipts_doc_uniq")) throw new Error(`이미 올린 명세서예요 (${receipt.doc_number}). 부품 입고에서 확인해 주세요.`);
    throw error;
  }
  const { error: itemErr } = await db.from("part_receipt_items").insert(items.map((it) => ({ ...it, receipt_id: data.id })));
  if (itemErr) {
    await db.from("part_receipts").delete().eq("id", data.id);
    throw itemErr;
  }
  return data.id as string;
}
