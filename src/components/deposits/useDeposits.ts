import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BankDeposit {
  id: string;
  source: "sms" | "paste";
  bank: string;
  depositor_name: string | null;
  amount: number;
  deposited_at: string;
  balance: number | null;
  raw_text: string;
  status: "pending" | "approved" | "ignored";
  customer_id: string | null;
  allocations: { finance_id: string; amount: number; payment_id?: string }[];
  unallocated_amount: number;
  decided_at: string | null;
  created_at: string;
  customers?: { id: string; name: string } | null;
}

export function useDeposits(status: "pending" | "done") {
  return useQuery({
    queryKey: ["bank-deposits", status],
    refetchInterval: status === "pending" ? 30_000 : false,
    queryFn: async () => {
      let q = (supabase as any).from("bank_deposits").select("*, customers(id, name)").order("deposited_at", { ascending: false });
      q = status === "pending" ? q.eq("status", "pending").limit(200) : q.neq("status", "pending").limit(50);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as BankDeposit[];
    },
  });
}

export const fmtDepositTime = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
