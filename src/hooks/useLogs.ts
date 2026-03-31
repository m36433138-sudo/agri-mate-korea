import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Log } from "@/types/workspace";

const db = supabase as any;

export function useLogs() {
  const qc = useQueryClient();

  const { data: logs = [], isLoading } = useQuery<Log[]>({
    queryKey: ["logs"],
    queryFn: async () => {
      const { data, error } = await db
        .from("logs")
        .select("*, customers(id, name), machines(id, model_name, serial_number)")
        .order("log_date", { ascending: false });
      if (error) throw error;
      return data as Log[];
    },
  });

  const addLog = useMutation({
    mutationFn: async (log: Omit<Log, "id" | "created_at" | "customers" | "machines">) => {
      const { error } = await db.from("logs").insert(log);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs"] }),
  });

  const updateLog = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Log> & { id: string }) => {
      const { error } = await db.from("logs").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs"] }),
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs"] }),
  });

  return { logs, isLoading, addLog, updateLog, deleteLog };
}
