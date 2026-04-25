import { useEffect, useId } from "react";
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
  // useId는 컴포넌트 인스턴스마다 안정적인 고유 키를 보장 (렌더마다 변하지 않음)
  const instanceId = useId();

  useEffect(() => {
    // 컴포넌트 인스턴스별 결정적 채널 이름 → 동일 테이블을 여러 곳에서 구독해도 충돌 없음
    const channelName = `realtime-${table}-${instanceId.replace(/:/g, "")}`;
    const channel = supabase.channel(channelName);

    // 반드시 subscribe() 이전에 .on() 콜백을 등록해야 함
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => {
        queryKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      }
    );

    channel.subscribe();

    // 언마운트 시 구독 해제 후 채널 제거 (중복 콜백 방지)
    return () => {
      try {
        channel.unsubscribe();
      } catch {
        // ignore
      }
      supabase.removeChannel(channel);
    };
  }, [table, instanceId, qc]); // queryKeys intentionally excluded to avoid re-subscribing
}
