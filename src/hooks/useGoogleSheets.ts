import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SheetRow, parseRows } from "@/types/operations";

async function fetchTab(tab: string, branch: "장흥" | "강진"): Promise<SheetRow[]> {
  const { data, error } = await supabase.functions.invoke("google-sheets", {
    body: { tab },
  });
  if (error) throw new Error(error.message || "Failed to fetch sheet data");
  if (data?.error) throw new Error(data.error);
  return parseRows(data?.values || [], branch);
}

export async function markRowComplete(sheetName: string, rowIndex: number, col: string = "P"): Promise<void> {
  const { data, error } = await supabase.functions.invoke("google-sheets", {
    body: { action: "markComplete", sheetName, rowIndex, col },
  });
  if (error) throw new Error(error.message || "Failed to update sheet");
  if (data?.error) throw new Error(data.error);
}

export function useGoogleSheets() {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { data: jangheungData, isLoading: jLoading, error: jError } = useQuery({
    queryKey: ["sheets", "장흥"],
    queryFn: async () => {
      const rows = await fetchTab("장흥(입출수)", "장흥");
      setLastUpdated(new Date());
      return rows;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: gangjinData, isLoading: gLoading, error: gError } = useQuery({
    queryKey: ["sheets", "강진"],
    queryFn: async () => {
      const rows = await fetchTab("강진(입출수)", "강진");
      setLastUpdated(new Date());
      return rows;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: completedArchive, isLoading: cLoading } = useQuery({
    queryKey: ["sheets", "완료된항목"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("google-sheets", {
          body: { tab: "완료된항목" },
        });
        if (error || data?.error) return [];
        const rows = parseRows(data?.values || [], "장흥");
        return rows.map(r => ({
          ...r,
          _branch: (r.위치?.includes("강진") ? "강진" : "장흥") as "장흥" | "강진",
        }));
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sheets"] });
  }, [queryClient]);

  const allData = [...(jangheungData || []), ...(gangjinData || [])];
  const allWithArchive = [...allData, ...(completedArchive || [])];
  const isLoading = jLoading || gLoading || cLoading;
  const error = jError || gError;

  return {
    allData,
    allWithArchive,
    jangheungData: jangheungData || [],
    gangjinData: gangjinData || [],
    completedArchive: completedArchive || [],
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}
