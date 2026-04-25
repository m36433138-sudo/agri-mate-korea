import { useEffect, useId, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Supabase Realtime changes on a table
 * and auto-invalidate the given query keys.
 *
 * 가드 계층:
 * 1) instance ref      → 같은 컴포넌트 인스턴스의 StrictMode 더블 effect 방지
 * 2) module registry   → 같은 페이지 세션 내 (table+instanceId) 채널 중복 생성 방지
 */

// 페이지 세션 동안 활성 채널을 추적 (key = `${table}::${instanceId}`)
const activeChannels = new Map<string, ReturnType<typeof supabase.channel>>();

export function useRealtimeSync(
  table: string,
  queryKeys: string[][]
) {
  const qc = useQueryClient();
  const instanceId = useId();

  // 최신 queryKeys를 ref로 추적 (재구독 없이 콜백에서 최신값 사용)
  const queryKeysRef = useRef(queryKeys);
  queryKeysRef.current = queryKeys;

  // 인스턴스 로컬 활성 채널 ref
  const activeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const registryKey = `${table}::${instanceId}`;

    // (1) 인스턴스 ref 가드
    if (activeChannelRef.current) {
      console.log(
        `[useRealtimeSync] skip — instance ref already has channel for "${registryKey}"`
      );
      return;
    }

    // (2) 모듈 레지스트리 가드
    if (activeChannels.has(registryKey)) {
      console.log(
        `[useRealtimeSync] skip — module registry already has channel for "${registryKey}"`
      );
      activeChannelRef.current = activeChannels.get(registryKey)!;
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

    channel.subscribe((status, err) => {
      console.log(`[useRealtimeSync] subscribe status for "${channelName}":`, status, err ?? "");
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        toast.error("실시간 동기화 연결에 문제가 있습니다.", {
          id: `realtime-error-${table}`,
          description: `${table} 테이블의 실시간 업데이트가 일시적으로 중단되었습니다. 화면은 정상 사용 가능합니다.`,
        });
      }
    });

    activeChannelRef.current = channel;
    activeChannels.set(registryKey, channel);

    return () => {
      const ch = activeChannelRef.current;
      activeChannelRef.current = null;
      activeChannels.delete(registryKey);
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
