import { Link } from "react-router-dom";
import { MessageSquare, ChevronRight, Paperclip } from "lucide-react";
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

export default function MessengerFeedCard() {
  const { data: messages, isLoading } = useRecentChatMessages(6);
  const unread = useUnreadCount();

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-bold text-sm">사내 메신저</h3>
          {unread > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
        <Link
          to="/messenger"
          className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5 group"
        >
          열기 <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : !messages?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">새로운 메시지가 없습니다.</p>
        ) : (
          <div className="space-y-1">
            {messages.map((m) => (
              <Link
                key={m.id}
                to="/messenger"
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-accent/40 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{m.senderName[0]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate leading-none">
                    {m.senderName}
                    <span className="text-xs text-muted-foreground font-normal"> · {m.roomName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-1 flex items-center gap-1">
                    {!m.content && m.file_name && <Paperclip className="h-3 w-3 shrink-0" />}
                    {m.content?.trim() || m.file_name || "새 메시지"}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(m.created_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
