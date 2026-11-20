export interface PartSaleItemRow {
  id: string;
  sale_id: string;
  branch: string;
  part_code: string;
  part_name: string;
  quantity: number;
  unit_price: number;
}

export interface PartSaleRow {
  id: string;
  sale_date: string;
  branch: string;
  customer_id: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  subtotal: number;
  discount: number;
  total_amount: number;
  payment_mode: "paid" | "unpaid" | "partial";
  paid_amount: number;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  customers?: { id: string; name: string; phone: string | null; address: string | null } | null;
  part_sale_items?: PartSaleItemRow[];
}

export const PAYMENT_MODE_LABELS: Record<PartSaleRow["payment_mode"], string> = {
  paid: "완납",
  unpaid: "외상",
  partial: "일부 입금",
};

export const buyerOf = (s: PartSaleRow) => s.customers?.name ?? s.buyer_name ?? "손님";
