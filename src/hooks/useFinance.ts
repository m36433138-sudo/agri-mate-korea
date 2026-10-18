import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Document, FinancePayment, FinanceRecord } from "@/types/workspace";

const db = supabase as any;

export function useDocuments() {
  const qc = useQueryClient();

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await db
        .from("documents")
        .select("*, customers(id, name), machines(id, model_name, serial_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Document[];
    },
  });

  const addDocument = useMutation({
    mutationFn: async (doc: Omit<Document, "id" | "created_at" | "customers" | "machines">) => {
      const { error } = await db.from("documents").insert(doc);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const updateDocument = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Document> & { id: string }) => {
      const { error } = await db.from("documents").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  return { documents, isLoading, addDocument, updateDocument, deleteDocument };
}

export function useFinance() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["finance"] });
    qc.invalidateQueries({ queryKey: ["customer-receivables"] });
  };

  const { data: finance = [], isLoading } = useQuery<FinanceRecord[]>({
    queryKey: ["finance"],
    queryFn: async () => {
      const { data, error } = await db
        .from("finance_records")
        .select("*, customers(id, name), documents(id, title, doc_type), finance_payments(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FinanceRecord[];
    },
  });

  const addFinance = useMutation({
    mutationFn: async (
      record: Omit<FinanceRecord, "id" | "created_at" | "updated_at" | "customers" | "documents" | "finance_payments">
    ) => {
      const { error } = await db.from("finance_records").insert(record);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateFinance = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FinanceRecord> & { id: string }) => {
      const { error } = await db.from("finance_records").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteFinance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("finance_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** 전액 입금 처리 */
  const markPaid = useMutation({
    mutationFn: async ({ id, paid_date, amount }: { id: string; paid_date: string; amount: number }) => {
      const { error } = await db
        .from("finance_records")
        .update({ is_paid: true, paid_date, paid_amount: amount })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** 부분 입금 기록 — 입금 누계가 총액에 도달하면 완납 처리 */
  const addPayment = useMutation({
    mutationFn: async (input: {
      finance_id: string;
      amount: number;
      paid_date: string;
      method: string | null;
      notes: string | null;
      created_by: string | null;
      totalAmount: number;
      currentPaid: number;
    }) => {
      const { error: pErr } = await db.from("finance_payments").insert({
        finance_id: input.finance_id,
        amount: input.amount,
        paid_date: input.paid_date,
        method: input.method,
        notes: input.notes,
        created_by: input.created_by,
      });
      if (pErr) throw pErr;

      const newPaid = Number(input.currentPaid) + Number(input.amount);
      const { error: rErr } = await db
        .from("finance_records")
        .update({
          paid_amount: newPaid,
          is_paid: newPaid >= Number(input.totalAmount),
          paid_date: input.paid_date,
        })
        .eq("id", input.finance_id);
      if (rErr) throw rErr;
    },
    onSuccess: invalidate,
  });

  /** 입금 기록 삭제 — 남은 입금으로 누계·완납 상태 재계산 */
  const deletePayment = useMutation({
    mutationFn: async (payment: FinancePayment) => {
      const { error: dErr } = await db.from("finance_payments").delete().eq("id", payment.id);
      if (dErr) throw dErr;

      const { data: rest, error: rErr } = await db
        .from("finance_payments")
        .select("amount, paid_date")
        .eq("finance_id", payment.finance_id)
        .order("paid_date", { ascending: false });
      if (rErr) throw rErr;

      const paid = (rest ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const { data: rec, error: recErr } = await db
        .from("finance_records")
        .select("amount")
        .eq("id", payment.finance_id)
        .single();
      if (recErr) throw recErr;

      const { error: uErr } = await db
        .from("finance_records")
        .update({
          paid_amount: paid,
          is_paid: paid >= Number(rec.amount),
          paid_date: paid > 0 ? rest?.[0]?.paid_date ?? null : null,
        })
        .eq("id", payment.finance_id);
      if (uErr) throw uErr;
    },
    onSuccess: invalidate,
  });

  return { finance, isLoading, addFinance, updateFinance, deleteFinance, markPaid, addPayment, deletePayment };
}
