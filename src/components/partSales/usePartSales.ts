import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PartSaleRow } from "./types";

const SELECT = "*, customers(id, name, phone, address), part_sale_items(*)";

/** 기간별 부품 판매 (1,000건 넘어도 범위 단위로 모두 읽음) */
export function usePartSales(from: string | null, to: string | null) {
  return useQuery({
    queryKey: ["part-sales", from, to],
    queryFn: async () => {
      const all: PartSaleRow[] = [];
      const PAGE = 500;
      for (let start = 0; ; start += PAGE) {
        let q = (supabase as any).from("part_sales").select(SELECT)
          .order("sale_date", { ascending: false }).order("created_at", { ascending: false }).order("id")
          .range(start, start + PAGE - 1);
        if (from) q = q.gte("sale_date", from);
        if (to) q = q.lte("sale_date", to);
        const { data, error } = await q;
        if (error) throw error;
        all.push(...(data as PartSaleRow[]));
        if (!data || data.length < PAGE) break;
      }
      return all;
    },
  });
}

export function useCustomerPartSales(customerId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["customer-part-sales", customerId],
    enabled: !!customerId && enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("part_sales").select(SELECT)
        .eq("customer_id", customerId).order("sale_date", { ascending: false }).limit(200);
      if (error) throw error;
      return data as PartSaleRow[];
    },
  });
}
