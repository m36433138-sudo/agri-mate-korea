import { useEffect, useState } from "react";
import { Wifi, WifiOff, Loader2, AlertTriangle } from "lucide-react";
import type { RealtimeSyncState, RealtimeStatus } from "@/hooks/useRealtimeSync";

const STATUS_META: Record<
  RealtimeStatus,
  { label: string; dot: string; text: string; icon: typeof Wifi }
> = {
  connecting:   { label: "연결 중",   dot: "bg-muted-foreground animate-pulse", text: "text-muted-foreground", icon: Loader2 },
  connected:    { label: "연결됨",    dot: "bg-emerald-400",                    text: "text-emerald-400",      icon: Wifi },
  reconnecting: { label: "재연결 중", dot: "bg-amber-400 animate-pulse",        text: "text-amber-400",        icon: Loader2 },
  disconnected: { label: "끊김",      dot: "bg-muted-foreground",               text: "text-muted-foreground", icon: WifiOff },
  failed:       { label: "연결 실패", dot: "bg-destructive",                    text: "text-destructive",      icon: AlertTriangle },
};

function formatRelative(date: Date | null, now: number): string {
  if (!date) return "업데이트 없음";
  const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (diffSec < 5) return "방금 전";
  if (diffSec < 60) return `${diffSec}초 전`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return date.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export interface RealtimeStatusBadgeProps {
  /** 단일 또는 다중 구독 상태 — 가장 우선순위 높은 상태 표시 */
  states: RealtimeSyncState | RealtimeSyncState[];
  className?: string;
}

const PRIORITY: RealtimeStatus[] = ["failed", "reconnecting", "disconnected", "connecting", "connected"];

export function RealtimeStatusBadge({ states, className = "" }: RealtimeStatusBadgeProps) {
  const list = Array.isArray(states) ? states : [states];

  // 가장 심각한 상태를 대표 상태로
  const aggregateStatus: RealtimeStatus =
    PRIORITY.find((s) => list.some((x) => x.status === s)) ?? "connecting";

  // 가장 최신 업데이트 시각
  const latest = list.reduce<Date | null>((acc, s) => {
    if (!s.lastUpdateAt) return acc;
    if (!acc || s.lastUpdateAt > acc) return s.lastUpdateAt;
    return acc;
  }, null);

  const meta = STATUS_META[aggregateStatus];
  const Icon = meta.icon;

  // 상대 시간 매초 갱신
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-3 py-1.5 text-xs ${className}`}
      title={latest ? `마지막 업데이트: ${latest.toLocaleString("ko-KR")}` : "아직 업데이트 없음"}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
      <Icon
        className={`h-3.5 w-3.5 ${meta.text} ${
          aggregateStatus === "connecting" || aggregateStatus === "reconnecting" ? "animate-spin" : ""
        }`}
        aria-hidden
      />
      <span className={`font-semibold ${meta.text}`}>{meta.label}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground tabular-nums">{formatRelative(latest, now)}</span>
    </div>
  );
}

export default RealtimeStatusBadge;
