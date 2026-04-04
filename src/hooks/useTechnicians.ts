import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTechnicians() {
  return useQuery({
    queryKey: ["technicians-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, team")
        .eq("team", "기사팀")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}
