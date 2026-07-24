import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const CHECK_INTERVAL_MS = 30_000; // 정상 시 30초마다 헬스체크
const RETRY_BASE_MS = 5_000;      // 실패 시 재시도 시작 간격
const RETRY_MAX_MS = 60_000;      // 재시도 간격 상한

/**
 * 백엔드(Lovable Cloud) 헬스 모니터.
 * - 주기적으로 가벼운 쿼리로 상태를 확인합니다.
 * - 실패(타임아웃/504/네트워크 오류) 감지 시 사용자에게 안내 토스트를 띄우고
 *   지수 백오프로 자동 재시도합니다.
 * - 회복되면 안내를 갱신하고 열려 있던 쿼리들을 무효화하여 화면을 되살립니다.
 */
export default function BackendHealthMonitor() {
  const { toast, dismiss } = useToast();
  const queryClient = useQueryClient();
  const [, setUnhealthy] = useState(false);
  const timerRef = useRef<number | null>(null);
  const toastIdRef = useRef<string | null>(null);
  const retryDelayRef = useRef<number>(RETRY_BASE_MS);
  const unhealthyRef = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function ping(): Promise<boolean> {
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 8000);
        // 가벼운 count 쿼리로 REST 응답 여부만 확인
        const { error } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .abortSignal(controller.signal)
          .limit(1);
        window.clearTimeout(timeoutId);
        // RLS로 인한 권한 오류는 무시(백엔드는 살아있음). 네트워크/게이트웨이 계열만 실패로 판정.
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (
            msg.includes("failed to fetch") ||
            msg.includes("network") ||
            msg.includes("timeout") ||
            msg.includes("504") ||
            msg.includes("502") ||
            msg.includes("503")
          ) {
            return false;
          }
        }
        return true;
      } catch (e: any) {
        const msg = (e?.message || "").toLowerCase();
        if (msg.includes("aborted")) return false;
        return false;
      }
    }

    function scheduleNext(delay: number) {
      if (cancelled) return;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(runCheck, delay);
    }

    async function runCheck() {
      const ok = await ping();
      if (cancelled) return;

      if (!ok) {
        // 실패 처리
        if (!unhealthyRef.current) {
          unhealthyRef.current = true;
          setUnhealthy(true);
          const t = toast({
            title: "백엔드 연결 지연",
            description:
              "서버 응답이 지연되고 있습니다. 자동으로 재시도 중입니다…",
            duration: Infinity,
            action: (
              <ToastAction
                altText="지금 다시 시도"
                onClick={() => {
                  retryDelayRef.current = RETRY_BASE_MS;
                  scheduleNext(0);
                }}
              >
                지금 재시도
              </ToastAction>
            ),
          });
          toastIdRef.current = t.id;
        }
        const next = Math.min(retryDelayRef.current * 2, RETRY_MAX_MS);
        retryDelayRef.current = next;
        scheduleNext(next);
      } else {
        // 성공 처리
        if (unhealthyRef.current) {
          unhealthyRef.current = false;
          setUnhealthy(false);
          if (toastIdRef.current) dismiss(toastIdRef.current);
          toastIdRef.current = null;
          toast({
            title: "백엔드 연결 복구",
            description: "서버 응답이 정상으로 돌아왔습니다.",
            duration: 4000,
          });
          // 지연 중 실패했을 수 있는 쿼리들 새로고침
          queryClient.invalidateQueries();
        }
        retryDelayRef.current = RETRY_BASE_MS;
        scheduleNext(CHECK_INTERVAL_MS);
      }
    }

    // 첫 체크는 살짝 지연 후 시작 (초기 로딩과 겹치지 않게)
    scheduleNext(3_000);

    const onOnline = () => {
      retryDelayRef.current = RETRY_BASE_MS;
      scheduleNext(0);
    };
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
