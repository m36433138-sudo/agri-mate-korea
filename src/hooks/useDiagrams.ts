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
  /** 제조사 (기본 얀마) */
  manufacturer?: string | null;
};

// 목록에 필요한 칸만 받는다 (1만 장이어도 가볍게)
const LIST_COLUMNS = "id,title,model_name,machine_type,image_path,kind,sort_order,created_at,manufacturer";
const CACHE_KEY = "diagrams.list.v2";

function readCachedList(): { at: number; rows: Diagram[] } | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const v = JSON.parse(raw);
    return Array.isArray(v?.rows) ? v : undefined;
  } catch { return undefined; }
}
function writeCachedList(rows: Diagram[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rows })); } catch { /* 저장 공간 부족 시 다음에 다시 받음 */ }
}

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

  // 지난번 목록을 기기에 저장해 두고 바로 보여준 뒤, 뒤에서 새로 받아 바꾼다
  const [cached] = useState(readCachedList);
  const { data: diagrams = [], isLoading } = useQuery<Diagram[]>({
    queryKey: ["diagrams"],
    initialData: cached?.rows,
    initialDataUpdatedAt: cached?.at,
    staleTime: 5 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: async () => {
      const PAGE = 1000;
      const page = (from: number) =>
        db.from("diagrams")
          .select(LIST_COLUMNS)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
      // 전체 개수를 먼저 알고 1000장씩 동시에 받는다 (순서대로 받으면 10번 기다림)
      const { count, error: cErr } = await db.from("diagrams").select("id", { count: "exact", head: true });
      if (cErr) throw cErr;
      const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
      const results = await Promise.all(Array.from({ length: pages }, (_, i) => page(i * PAGE)));
      const all: Diagram[] = [];
      for (const { data, error } of results) {
        if (error) throw error;
        all.push(...((data ?? []) as Diagram[]));
      }
      // 받는 사이 새 도면이 늘었으면 끝 페이지를 한 번 더 이어 받는다
      for (let from = pages * PAGE; ; from += PAGE) {
        const { data, error } = await page(from);
        if (error) throw error;
        all.push(...((data ?? []) as Diagram[]));
        if (!data || data.length < PAGE) break;
      }
      const seen = new Set<string>();
      const rows = all.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
      writeCachedList(rows);
      return rows;
    },
  });

  const addDiagram = useMutation({
    mutationFn: async (d: { title: string; model_name?: string; machine_type?: string; notes?: string; image_path: string; kind?: "diagram" | "photo"; manufacturer?: string }) => {
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
const THUMB_CACHE = "diagrams.thumbs.v1";
const THUMB_TTL = 45 * 60_000; // 서명은 1시간 유효 → 45분 안이면 다시 서명하지 않는다

function readThumbCache(): Map<string, string> | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(THUMB_CACHE) ?? "null");
    if (!v || Date.now() - v.at > THUMB_TTL) return null;
    return new Map(Object.entries(v.urls as Record<string, string>));
  } catch { return null; }
}

export function useDiagramThumbUrls(paths: string[]) {
  const key = useMemo(() => `${paths.length}:${paths[0] ?? ""}:${paths[paths.length - 1] ?? ""}`, [paths]);
  return useQuery({
    queryKey: ["diagram-thumb-urls", key],
    enabled: paths.length > 0,
    queryFn: async () => {
      const cached = readThumbCache();
      const missing = cached ? paths.filter((p) => !cached.has(p)) : paths;
      const out = cached ?? new Map<string, string>();
      if (missing.length === 0) return out;
      const chunks: string[][] = [];
      for (let i = 0; i < missing.length; i += 500) chunks.push(missing.slice(i, i + 500));
      // 500장씩 동시에 서명해 도면이 늘어도 첫 화면이 늦어지지 않게 한다
      const signed = await Promise.all(
        chunks.map((chunk) =>
          supabase.storage.from(DIAGRAM_BUCKET).createSignedUrls(chunk.map((p) => `thumbs/${p}`), 3600),
        ),
      );
      signed.forEach(({ data, error }, k) => {
        if (error) throw error;
        data?.forEach((d, j) => { if (d.signedUrl) out.set(chunks[k][j], d.signedUrl); });
      });
      try {
        const prevAt = cached ? JSON.parse(sessionStorage.getItem(THUMB_CACHE) ?? "{}").at : Date.now();
        sessionStorage.setItem(THUMB_CACHE, JSON.stringify({ at: prevAt ?? Date.now(), urls: Object.fromEntries(out) }));
      } catch { /* 저장 공간 부족 */ }
      return out;
    },
    staleTime: 1000 * 60 * 50,
    gcTime: 1000 * 60 * 60,
  });
}
