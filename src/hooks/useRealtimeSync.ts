import { useEffect, useId, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Supabase Realtime changes on a table
 * and auto-invalidate the given query keys.
 *
 * StrictMode/dev에서 effect가 두 번 실행되어도 동일 (table+instanceId)
 * 조합으로는 단 하나의 채널만 활성 상태로 유지되도록 가드합니다.
 */
export function useRealtimeSync(
  table: string,
  queryKeys: string[][]
) {
  const qc = useQueryClient();
  const instanceId = useId();

  // 최신 queryKeys를 ref로 추적 (재구독 없이 콜백에서 최신값 사용)
  const queryKeysRef = useRef(queryKeys);
  queryKeysRef.current = queryKeys;

  // 활성 채널 추적 (중복 구독 방지)
  const activeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (activeChannelRef.current) {
      console.log(
        `[useRealtimeSync] skip duplicate effect — table="${table}" instance="${instanceId}" (channel already active)`
      );
      return;
    }

    const channelName = `realtime-${table}-${instanceId.replace(/:/g, "")}`;
    console.log(`[useRealtimeSync] create channel "${channelName}"`);
    const channel = supabase.channel(channelName);

    // 반드시 subscribe() 이전에 .on() 콜백 등록
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => {
        queryKeysRef.current.forEach((key) =>
          qc.invalidateQueries({ queryKey: key })
        );
      }
    );
    console.log(`[useRealtimeSync] registered postgres_changes callback on "${channelName}"`);

    channel.subscribe((status) => {
      console.log(`[useRealtimeSync] subscribe status for "${channelName}":`, status);
    });
    activeChannelRef.current = channel;

    return () => {
      const ch = activeChannelRef.current;
      activeChannelRef.current = null;
      if (!ch) return;
      console.log(`[useRealtimeSync] cleanup channel "${channelName}"`);
      try {
        ch.unsubscribe();
      } catch {
        // ignore
      }
      supabase.removeChannel(ch);
    };
  }, [table, instanceId, qc]);
}
