import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface ProfileBasic {
  id: string;
  display_name: string | null;
  team: string | null;
  branch: string | null;
}

export function useProfiles() {
  const { data: profiles = [] } = useQuery<ProfileBasic[]>({
    queryKey: ["profiles-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, team, branch");
      if (error) return [];
      return data as ProfileBasic[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const profileMap = useMemo(() => {
    const map: Record<string, ProfileBasic> = {};
    profiles.forEach((p) => { map[p.id] = p; });
    return map;
  }, [profiles]);

  const getDisplayName = (userId: string) =>
    profileMap[userId]?.display_name ?? "알 수 없음";

  return { profiles, profileMap, getDisplayName };
}
