import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const DIAGRAM_BUCKET = "diagram-images";

export type Diagram = {
  id: string;
  title: string;
  model_name: string | null;
  machine_type: string | null;
  notes: string | null;
  image_path: string;
  created_at: string;
};

export type DiagramHotspot = {
  id: string;
  diagram_id: string;
  part_code: string;
  part_name: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  notes: string | null;
};

export function useDiagrams() {
  const qc = useQueryClient();

  const { data: diagrams = [], isLoading } = useQuery<Diagram[]>({
    queryKey: ["diagrams"],
    queryFn: async () => {
      const { data, error } = await db
        .from("diagrams")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Diagram[];
    },
  });

  const addDiagram = useMutation({
    mutationFn: async (d: { title: string; model_name?: string; machine_type?: string; notes?: string; image_path: string }) => {
      const { data, error } = await db.from("diagrams").insert(d).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagrams"] }),
  });

  const deleteDiagram = useMutation({
    mutationFn: async (d: Diagram) => {
      const { error } = await db.from("diagrams").delete().eq("id", d.id);
      if (error) throw error;
      await supabase.storage.from(DIAGRAM_BUCKET).remove([d.image_path]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagrams"] }),
  });

  return { diagrams, isLoading, addDiagram, deleteDiagram };
}

export function useHotspots(diagramId: string | null) {
  const qc = useQueryClient();

  const { data: hotspots = [], isLoading } = useQuery<DiagramHotspot[]>({
    queryKey: ["diagram-hotspots", diagramId],
    enabled: !!diagramId,
    queryFn: async () => {
      const { data, error } = await db
        .from("diagram_hotspots")
        .select("*")
        .eq("diagram_id", diagramId)
        .order("created_at");
      if (error) throw error;
      return data as DiagramHotspot[];
    },
  });

  const addHotspot = useMutation({
    mutationFn: async (h: Omit<DiagramHotspot, "id">) => {
      const { error } = await db.from("diagram_hotspots").insert(h);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagram-hotspots", diagramId] }),
  });

  const deleteHotspot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("diagram_hotspots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagram-hotspots", diagramId] }),
  });

  return { hotspots, isLoading, addHotspot, deleteHotspot };
}

/** 도면 이미지 서명 URL (1시간) */
export function useDiagramImageUrl(imagePath: string | null) {
  return useQuery({
    queryKey: ["diagram-image-url", imagePath],
    enabled: !!imagePath,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(DIAGRAM_BUCKET)
        .createSignedUrl(imagePath!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 1000 * 60 * 50,
  });
}
