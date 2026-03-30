import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RepairNote = {
  id: string;
  branch: string;
  row_index: number;
  content: string;
  is_done: boolean;
  created_at: string;
  done_at: string | null;
};

export function useRepairNotes() {
  const qc = useQueryClient();

  const { data: allNotes = [], isLoading } = useQuery({
    queryKey: ["repair-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_notes")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as RepairNote[];
    },
    staleTime: 1000 * 30,
  });

  const getNotesForRow = (branch: string, rowIndex: number) =>
    allNotes.filter(n => n.branch === branch && n.row_index === rowIndex);

  const pendingCount = allNotes.filter(n => !n.is_done).length;

  const addNote = useMutation({
    mutationFn: async ({ branch, rowIndex, content }: { branch: string; rowIndex: number; content: string }) => {
      const { error } = await supabase.from("repair_notes").insert({
        branch,
        row_index: rowIndex,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repair-notes"] }),
  });

  const toggleDone = useMutation({
    mutationFn: async ({ id, isDone }: { id: string; isDone: boolean }) => {
      const { error } = await supabase
        .from("repair_notes")
        .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repair-notes"] }),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("repair_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repair-notes"] }),
  });

  return { allNotes, isLoading, getNotesForRow, pendingCount, addNote, toggleDone, deleteNote };
}
