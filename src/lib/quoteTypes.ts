export type Company = {
  id: string;
  company_name: string;
  business_number: string | null;
  ceo_name: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  stamp_url: string | null;
  is_default: boolean;
  sort_order: number;
};

export type QuoteProduct = {
  id: string;
  name: string;
  spec: string | null;
  unit_price: number;
  category: string | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
};

export type QuoteItem = {
  id?: string;
  product_id: string | null;
  product_name: string;
  spec: string | null;
  quantity: number;
  unit_price: number;
  discount_rate: number;
  line_total: number;
  sort_order: number;
};

export type Quote = {
  id: string;
  quote_number: string;
  quote_date: string;
  company_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_ssn: string | null;
  trade_in_amount: number;
  memo: string | null;
  signature_data: string | null;
  subtotal: number;
  discount_total: number;
  total_amount: number;
  branch: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const won = (n: number) =>
  new Intl.NumberFormat("ko-KR").format(Math.round(n || 0)) + " 원";

export const calcLine = (qty: number, price: number, discount: number) =>
  Math.round(qty * price * (1 - (discount || 0) / 100));
