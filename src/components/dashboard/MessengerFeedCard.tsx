import { Link } from "react-router-dom";
import { Paperclip } from "lucide-react";
import { Panel } from "./Panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecentChatMessages } from "@/hooks/useMessengerNotifications";
import { useUnreadCount } from "@/hooks/useMessenger";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function MessengerFeedCard({ limit = 6, className }: { limit?: number; className?: string }) {
  const { data: messages, isLoading } = useRecentChatMessages(limit);
  const unread = useUnreadCount();

  return (
    <Panel
      title="사내 메신저"
      to="/messenger"
      linkLabel="열기"
      className={className}
      badge={unread > 0 ? (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-white text-[11px] font-bold flex items-center justify-center">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : undefined}
    >
      {isLoading ? (
        <div className="space-y-2 px-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      ) : !messages?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">새로운 메시지가 없습니다.</p>
      ) : (
        <div>
          {messages.map((m) => (
            <Link
              key={m.id}
              to="/messenger"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/60 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{m.senderName[0]}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate leading-tight">
                  {m.senderName}
                  <span className="text-xs text-muted-foreground font-normal"> · {m.roomName}</span>
                </p>
                <p className="text-[13px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                  {!m.content && m.file_name && <Paperclip className="h-3 w-3 shrink-0" />}
                  {m.content?.trim() || m.file_name || "새 메시지"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{timeAgo(m.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}
