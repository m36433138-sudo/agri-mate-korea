import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Document } from "@/types/workspace";

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
