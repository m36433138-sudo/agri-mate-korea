import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SheetRow, parseRows } from "@/types/operations";
import { Branch, fetchBranchRows, importBranchFromSheet, mirrorToSheet, updateOperationRow } from "@/lib/operationRows";

const branchOfSheet = (sheetName: string): Branch => (sheetName.includes("강진") ? "강진" : "장흥");

async function fetchTab(_tab: string, branch: Branch): Promise<SheetRow[]> {
  const rows = await fetchBranchRows(branch);
  if (rows.length > 0) return rows;
  // 처음 한 번: 앱에 아무것도 없으면 시트 내용을 가져와 시작
  try { await importBranchFromSheet(branch); } catch { return []; }
  return fetchBranchRows(branch);
}

/** 완료 처리 — 앱에 먼저 저장하고 시트 백업은 가능할 때만 */
export async function markRowComplete(sheetName: string, rowIndex: number, col: string = "P"): Promise<void> {
  await updateOperationRow(branchOfSheet(sheetName), rowIndex, { is_completed: true, status_label: "완료" });
  if (rowIndex > 0) {
    await mirrorToSheet({ action: "markComplete", sheetName, rowIndex, col });
    await mirrorToSheet({ action: "updateCell", sheetName, rowIndex, col: "A", value: "완료" });
  }
}

export async function updateRowStatus(sheetName: string, rowIndex: number, newStatus: string): Promise<void> {
  await updateOperationRow(branchOfSheet(sheetName), rowIndex, { status_label: newStatus });
  if (rowIndex > 0) await mirrorToSheet({ action: "updateCell", sheetName, rowIndex, col: "A", value: newStatus });
}

export function useGoogleSheets() {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 다른 직원이 바꾸면 바로 반영
  useEffect(() => {
    const ch = supabase
      .channel("operation_rows_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "operation_rows" }, () => {
        queryClient.invalidateQueries({ queryKey: ["sheets", "장흥"] });
        queryClient.invalidateQueries({ queryKey: ["sheets", "강진"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const { data: jangheungData, isLoading: jLoading, error: jError } = useQuery({
    queryKey: ["sheets", "장흥"],
    queryFn: async () => {
      const rows = await fetchTab("장흥(입출수)", "장흥");
      setLastUpdated(new Date());
      return rows;
    },
    staleTime: 2 * 60 * 1000,
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
    queryKey: ["sheets", "완료된 항목"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("google-sheets", {
          body: { tab: "완료된 항목" },
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
