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
      const rows = await fetchTab("강진(입출고)", "강진");
      setLastUpdated(new Date());
      return rows;
    },
    staleTime: 5 * 60 * 1000,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sheets"] });
  }, [queryClient]);

  const allData = [...(jangheungData || []), ...(gangjinData || [])];
  const isLoading = jLoading || gLoading;
  const error = jError || gError;

  return { allData, jangheungData: jangheungData || [], gangjinData: gangjinData || [], isLoading, error, lastUpdated, refresh };
}
