import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useChatStaff, type ChatMessage } from "@/hooks/useMessenger";
import { toast } from "@/hooks/use-toast";

const db = supabase as any;

export interface RecentMessage extends ChatMessage {
  senderName: string;
  roomName: string | null;
}

/** 내가 참여한 방의 최근 메시지 (대시보드 알림용) */
export function useRecentChatMessages(limit = 6) {
  const { userId, isCustomer } = useUserRole();
  const { data: staff } = useChatStaff();

  return useQuery<RecentMessage[]>({
    queryKey: ["chat-recent-messages", userId, limit],
    enabled: !!userId && !isCustomer,
    staleTime: 1000 * 20,
    queryFn: async () => {
      const { data: memberships } = await db
        .from("chat_room_members")
        .select("room_id, last_read_at")
        .eq("user_id", userId);
      const rows = memberships ?? [];
      if (rows.length === 0) return [];

      const roomIds = rows.map((r: any) => r.room_id);
      const [msgsRes, roomsRes] = await Promise.all([
        db.from("chat_messages").select("*").in("room_id", roomIds)
          .order("created_at", { ascending: false }).limit(limit),
        db.from("chat_rooms").select("id, name, room_type").in("id", roomIds),
      ]);

      const roomMap: Record<string, any> = {};
      (roomsRes.data ?? []).forEach((r: any) => { roomMap[r.id] = r; });
      const nameMap: Record<string, string> = {};
      (staff ?? []).forEach((s) => { nameMap[s.user_id] = s.display_name; });

      return (msgsRes.data ?? []).map((m: any) => ({
        ...m,
        senderName: m.sender_id === userId ? "나" : (nameMap[m.sender_id] ?? "직원"),
        roomName: roomMap[m.room_id]?.name ?? (roomMap[m.room_id]?.room_type === "direct" ? "1:1 대화" : "대화방"),
      })) as RecentMessage[];
    },
  });
}

/** 새 메시지 도착 시 토스트·브라우저 알림 (앱 전역) */
export function useMessengerNotifications() {
  const { userId, isCustomer } = useUserRole();
  const { data: staff } = useChatStaff();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const roomIdsRef = useRef<Set<string>>(new Set());
  const pathRef = useRef(location.pathname);
  const staffRef = useRef(staff);

  pathRef.current = location.pathname;
  staffRef.current = staff;

  // 알림 권한 요청 (1회)
  useEffect(() => {
    if (isCustomer || !userId) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [userId, isCustomer]);

  useEffect(() => {
    if (!userId || isCustomer) return;
    let cancelled = false;

    const loadRooms = async () => {
      const { data } = await db
        .from("chat_room_members").select("room_id").eq("user_id", userId);
      if (!cancelled) roomIdsRef.current = new Set((data ?? []).map((r: any) => r.room_id));
    };
    loadRooms();

    const channel = supabase
      .channel("messenger-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new as any;
          if (!msg || msg.sender_id === userId) return;
          if (!roomIdsRef.current.has(msg.room_id)) return;

          qc.invalidateQueries({ queryKey: ["chat-unread-total", userId] });
          qc.invalidateQueries({ queryKey: ["chat-recent-messages", userId] });
          qc.invalidateQueries({ queryKey: ["chat-rooms", userId] });

          // 메신저 화면을 보고 있으면 토스트 생략
          if (pathRef.current.startsWith("/messenger")) return;

          const sender =
            (staffRef.current ?? []).find((s) => s.user_id === msg.sender_id)?.display_name ?? "직원";
          const body = msg.content?.trim() || (msg.file_name ? `📎 ${msg.file_name}` : "새 메시지");

          toast({
            title: `${sender} 님의 새 메시지`,
            description: body.length > 80 ? `${body.slice(0, 80)}…` : body,
            onClick: () => navigate("/messenger"),
          } as any);

          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              const n = new Notification(`${sender} 님의 새 메시지`, { body, tag: msg.room_id });
              n.onclick = () => { window.focus(); navigate("/messenger"); };
            } catch { /* 무시 */ }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_room_members" },
        () => { loadRooms(); },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId, isCustomer, qc, navigate]);
}
