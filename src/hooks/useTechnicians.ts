import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffEntry = { id: string; name: string; team: string | null; user_id: string | null; is_admin: boolean };

/**
 * 담당자로 고를 수 있는 사람: 재직 중인 직원 전부 + 직원 정보가 연결된 관리자.
 * 직원은 다른 직원 정보를 직접 못 읽으므로 이름·팀만 주는 staff_directory 함수를 쓴다.
 */
export function useStaffDirectory() {
  return useQuery<StaffEntry[]>({
    queryKey: ["staff-directory"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("staff_directory");
      if (error) throw error;
      return (data ?? []) as StaffEntry[];
    },
  });
}

/** 예전 이름 유지: 이제 기사팀만이 아니라 고를 수 있는 모든 사람 (기사팀이 먼저) */
export function useTechnicians() {
  const q = useStaffDirectory();
  const data = (q.data ?? []).slice().sort((a, b) => Number(b.team === "기사팀") - Number(a.team === "기사팀") || a.name.localeCompare(b.name, "ko"));
  return { ...q, data };
}

/** 「김영일, 마성수」 같은 담당자 칸을 사람 이름 목록으로 */
export const splitNames = (v: string | null | undefined) => (v ?? "").split(/[,·/]+|\s{2,}/).map((s) => s.trim()).filter(Boolean);
