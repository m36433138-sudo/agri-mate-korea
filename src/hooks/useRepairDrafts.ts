import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RepairDraftPart = {
  id: string;
  draft_id: string;
  part_code: string | null;
  part_name: string;
  quantity: number;
  unit_price: number;
  created_at: string;
};

export type RepairDraft = {
  id: string;
  branch: string;
  row_index: number;
  customer_name: string | null;
  machine_type: string | null;
  model: string | null;
  technician: string | null;
  description: string | null;
  labor_cost: number;
  operating_hours: number | null;
  created_at: string;
  updated_at: string;
  is_finalized: boolean;
  parts?: RepairDraftPart[];
};

export function useRepairDrafts() {
  const qc = useQueryClient();

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["repair-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operation_repair_drafts")
        .select("*")
        .eq("is_finalized", false)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as RepairDraft[];
    },
    staleTime: 1000 * 15,
  });

  const getDraftForRow = (branch: string, rowIndex: number) =>
    drafts.find(d => d.branch === branch && d.row_index === rowIndex) || null;

  const fetchDraftWithParts = async (branch: string, rowIndex: number): Promise<RepairDraft | null> => {
    const { data: draft } = await supabase
      .from("operation_repair_drafts")
      .select("*")
      .eq("branch", branch)
      .eq("row_index", rowIndex)
      .eq("is_finalized", false)
      .maybeSingle();

    if (!draft) return null;

    const { data: parts } = await supabase
      .from("operation_repair_draft_parts")
      .select("*")
      .eq("draft_id", draft.id)
      .order("created_at", { ascending: true });

    return { ...draft, parts: parts || [] } as RepairDraft;
  };

  const upsertDraft = useMutation({
    mutationFn: async (input: {
      branch: string;
      row_index: number;
      customer_name?: string;
      machine_type?: string;
      model?: string;
      technician?: string;
      description?: string;
      labor_cost?: number;
    }) => {
      const { data, error } = await supabase
        .from("operation_repair_drafts")
        .upsert(
          {
            branch: input.branch,
            row_index: input.row_index,
            customer_name: input.customer_name || null,
            machine_type: input.machine_type || null,
            model: input.model || null,
            technician: input.technician || null,
            description: input.description || null,
            labor_cost: input.labor_cost || 0,
            updated_at: new Date().toISOString(),
            is_finalized: false,
          },
          { onConflict: "branch,row_index" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repair-drafts"] }),
  });

  const addDraftPart = useMutation({
    mutationFn: async (input: {
      draft_id: string;
      part_code?: string;
      part_name: string;
      quantity: number;
      unit_price: number;
    }) => {
      const { error } = await supabase.from("operation_repair_draft_parts").insert({
        draft_id: input.draft_id,
        part_code: input.part_code || null,
        part_name: input.part_name,
        quantity: input.quantity,
        unit_price: input.unit_price,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repair-drafts"] }),
  });

  const removeDraftPart = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operation_repair_draft_parts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repair-drafts"] }),
  });

  const finalizeDraft = useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase
        .from("operation_repair_drafts")
        .update({ is_finalized: true, updated_at: new Date().toISOString() })
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repair-drafts"] }),
  });

  return {
    drafts,
    isLoading,
    getDraftForRow,
    fetchDraftWithParts,
    upsertDraft,
    addDraftPart,
    removeDraftPart,
    finalizeDraft,
  };
}
