import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FinanceRecord } from "@/types/workspace";

const db = supabase as any;

export function useFinance() {
  const qc = useQueryClient();

  const { data: finance = [], isLoading } = useQuery<FinanceRecord[]>({
    queryKey: ["finance"],
    queryFn: async () => {
      const { data, error } = await db
        .from("finance_records")
        .select("*, customers(id, name), documents(id, title, doc_type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FinanceRecord[];
    },
  });

  const addFinance = useMutation({
    mutationFn: async (
      record: Omit<FinanceRecord, "id" | "created_at" | "customers" | "documents">
    ) => {
      const { error } = await db.from("finance_records").insert(record);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });

  const updateFinance = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FinanceRecord> & { id: string }) => {
      const { error } = await db.from("finance_records").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });

  const deleteFinance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("finance_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });

  const markPaid = useMutation({
    mutationFn: async ({ id, paid_date }: { id: string; paid_date: string }) => {
      const { error } = await db
        .from("finance_records")
        .update({ is_paid: true, paid_date })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });

  return { finance, isLoading, addFinance, updateFinance, deleteFinance, markPaid };
}
