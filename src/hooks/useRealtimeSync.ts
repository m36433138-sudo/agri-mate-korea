import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Supabase Realtime changes on a table
 * and auto-invalidate the given query keys.
 */
export function useRealtimeSync(
  table: string,
  queryKeys: string[][]
) {
  const qc = useQueryClient();

  useEffect(() => {
    // 채널 이름을 고유하게 만들어 여러 컴포넌트가 동일 테이블을 구독해도 충돌하지 않도록 함
    const uniqueId = `${Math.random().toString(36).slice(2)}-${Date.now()}`;
    const channel = supabase
      .channel(`realtime-${table}-${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          queryKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, qc]); // queryKeys intentionally excluded to avoid re-subscribing
}
