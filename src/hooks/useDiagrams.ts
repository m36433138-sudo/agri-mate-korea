import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isSearchTerm, type PartHit } from "@/lib/diagramSearch";

const db = supabase as any;

export const DIAGRAM_BUCKET = "diagram-images";

export type Diagram = {
  id: string;
  title: string;
  model_name: string | null;
  machine_type: string | null;
  notes: string | null;
  image_path: string;
  kind: "diagram" | "photo";
  sort_order: number;
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
  target_diagram_id: string | null;
};

export function useDiagrams() {
  const qc = useQueryClient();

  const { data: diagrams = [], isLoading } = useQuery<Diagram[]>({
    queryKey: ["diagrams"],
    queryFn: async () => {
      const all: Diagram[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db
          .from("diagrams")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        all.push(...((data ?? []) as Diagram[]));
        if (!data || data.length < PAGE) break;
      }
      return all;
    },
  });

  const addDiagram = useMutation({
    mutationFn: async (d: { title: string; model_name?: string; machine_type?: string; notes?: string; image_path: string; kind?: "diagram" | "photo" }) => {
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

/**
 * 부품번호·부품명으로 도면 찾기 (서버). 250ms 기다렸다가 한 번만 묻고,
 * 더 늦게 온 응답이 먼저 온 응답을 덮지 못하게 요청을 취소한다.
 */
export function useDiagramPartSearch(term: string) {
  const q = term.trim();
  const active = isSearchTerm(q);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(timer);
  }, [q]);

  const search = useQuery({
    queryKey: ["diagram-part-search", debounced],
    enabled: active && debounced === q,
    queryFn: async ({ signal }) => {
      const { data, error } = await db
        .rpc("search_diagram_parts", { query: debounced, result_limit: 300 })
        .abortSignal(signal);
      if (error) throw error;
      return (data ?? []) as { diagram_id: string; part_codes: string[] | null; match_count: number }[];
    },
    staleTime: 120_000,
    gcTime: 600_000,
    retry: 1,
  });

  const current = active && debounced === q;
  const hits = useMemo(() => {
    const map = new Map<string, PartHit>();
    if (!current) return map;
    for (const row of search.data ?? []) {
      map.set(row.diagram_id, { codes: row.part_codes ?? [], count: row.match_count });
    }
    return map;
  }, [current, search.data]);

  return {
    hits,
    pending: active && (!current || search.isPending),
    isError: current && search.isError,
  };
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

  const updateHotspot = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<DiagramHotspot> & { id: string }) => {
      const { error } = await db.from("diagram_hotspots").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagram-hotspots", diagramId] }),
  });

  return { hotspots, isLoading, addHotspot, deleteHotspot, updateHotspot };
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

/** Pre-made small previews live at thumbs/<image_path>; signed in bulk so the list shows instantly. */
export function useDiagramThumbUrls(paths: string[]) {
  const key = paths.join("|");
  return useQuery({
    queryKey: ["diagram-thumb-urls", key],
    enabled: paths.length > 0,
    queryFn: async () => {
      const out = new Map<string, string>();
      for (let i = 0; i < paths.length; i += 500) {
        const chunk = paths.slice(i, i + 500);
        const { data, error } = await supabase.storage
          .from(DIAGRAM_BUCKET)
          .createSignedUrls(chunk.map((p) => `thumbs/${p}`), 3600);
        if (error) throw error;
        data?.forEach((d, j) => { if (d.signedUrl) out.set(chunk[j], d.signedUrl); });
      }
      return out;
    },
    staleTime: 1000 * 60 * 50,
    gcTime: 1000 * 60 * 60,
  });
}
