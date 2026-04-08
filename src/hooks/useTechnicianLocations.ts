import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TechnicianLocation {
  technician_name: string;
  action: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  created_at: string;
}

export function useTechnicianLocations() {
  return useQuery({
    queryKey: ["technician-latest-locations"],
    queryFn: async () => {
      // Get all locations ordered by time, then pick latest per technician client-side
      const { data, error } = await supabase
        .from("technician_locations")
        .select("technician_name, action, latitude, longitude, accuracy, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const latestMap = new Map<string, TechnicianLocation>();
      for (const row of data || []) {
        if (!latestMap.has(row.technician_name)) {
          latestMap.set(row.technician_name, row);
        }
      }
      return Array.from(latestMap.values());
    },
    refetchInterval: 60_000,
  });
}
