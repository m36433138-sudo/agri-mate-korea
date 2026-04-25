import { useEffect, useId, useRef, useState } from "react";
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
 *
 * 연결이 끊기면 (CHANNEL_ERROR / TIMED_OUT / CLOSED) 지수 백오프로 자동 재구독합니다.
 *
 * 반환값: { status, lastUpdateAt } — UI 인디케이터용
 */

export type RealtimeStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "failed";

export interface RealtimeSyncState {
  status: RealtimeStatus;
  lastUpdateAt: Date | null;
}

// 페이지 세션 동안 활성 채널을 추적 (key = `${table}::${instanceId}`)
const activeChannels = new Map<string, ReturnType<typeof supabase.channel>>();

// 백오프 설정
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 8;

export function useRealtimeSync(
  table: string,
  queryKeys: string[][]
): RealtimeSyncState {
  const qc = useQueryClient();
  const instanceId = useId();

  const queryKeysRef = useRef(queryKeys);
  queryKeysRef.current = queryKeys;

  const activeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [state, setState] = useState<RealtimeSyncState>({
    status: "connecting",
    lastUpdateAt: null,
  });

  useEffect(() => {
    const registryKey = `${table}::${instanceId}`;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    if (activeChannelRef.current) {
      console.log(`[useRealtimeSync] skip — instance ref already has channel for "${registryKey}"`);
      return;
    }
    if (activeChannels.has(registryKey)) {
      console.log(`[useRealtimeSync] skip — module registry already has channel for "${registryKey}"`);
      activeChannelRef.current = activeChannels.get(registryKey)!;
      return;
    }

    const teardownChannel = (ch: ReturnType<typeof supabase.channel> | null) => {
      if (!ch) return;
      try {
        ch.unsubscribe();
      } catch {
        // ignore
      }
      supabase.removeChannel(ch);
    };

    const connect = () => {
      if (cancelled) return;

      const channelName = `realtime-${table}-${instanceId.replace(/:/g, "")}-a${attempts}`;
      console.log(`[useRealtimeSync] create channel "${channelName}" (attempt ${attempts + 1})`);
      const channel = supabase.channel(channelName);

      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          queryKeysRef.current.forEach((key) =>
            qc.invalidateQueries({ queryKey: key })
          );
          setState((s) => ({ ...s, lastUpdateAt: new Date() }));
        }
      );

      channel.subscribe((status, err) => {
        console.log(`[useRealtimeSync] status "${channelName}":`, status, err ?? "");

        if (status === "SUBSCRIBED") {
          attempts = 0;
          toast.dismiss(`realtime-error-${table}`);
          setState((s) => ({ ...s, status: "connected" }));
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (activeChannelRef.current === channel) {
            activeChannelRef.current = null;
            activeChannels.delete(registryKey);
          }
          teardownChannel(channel);

          if (cancelled) return;

          if (attempts >= MAX_ATTEMPTS) {
            toast.error("실시간 동기화 재연결 실패", {
              id: `realtime-error-${table}`,
              description: `${table} 테이블의 실시간 업데이트를 복구하지 못했습니다. 페이지를 새로고침해 주세요.`,
            });
            setState((s) => ({ ...s, status: "failed" }));
            return;
          }

          const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempts);
          const jitter = delay * (0.8 + Math.random() * 0.4);
          attempts += 1;

          toast.error("실시간 동기화 재연결 중…", {
            id: `realtime-error-${table}`,
            description: `${table} 연결이 끊겼습니다. ${Math.round(jitter / 1000)}초 후 재시도합니다. (${attempts}/${MAX_ATTEMPTS})`,
          });

          setState((s) => ({ ...s, status: "reconnecting" }));
          console.log(`[useRealtimeSync] reconnect "${registryKey}" in ${Math.round(jitter)}ms`);
          retryTimer = setTimeout(connect, jitter);
        }
      });

      activeChannelRef.current = channel;
      activeChannels.set(registryKey, channel);
    };

    setState({ status: "connecting", lastUpdateAt: null });
    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      const ch = activeChannelRef.current;
      activeChannelRef.current = null;
      activeChannels.delete(registryKey);
      console.log(`[useRealtimeSync] cleanup "${registryKey}"`);
      teardownChannel(ch);
      setState((s) => ({ ...s, status: "disconnected" }));
    };
  }, [table, instanceId, qc]);

  return state;
}
