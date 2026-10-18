import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

const db = supabase as any;
const ROOM_NAME = "미수금 알림";

/**
 * 하루 1회, 만기일이 지난 미수금이 있으면 "미수금 알림" 단체방에
 * 요약 메시지를 자동 발송한다. (localStorage로 중복 방지)
 */
export function useReceivablesAlert() {
  const { userId, isCustomer, isLoading } = useUserRole();

  useEffect(() => {
    if (isLoading || !userId || isCustomer) return;

    const today = new Date().toISOString().slice(0, 10);
    const guardKey = `receivables-alert-${today}`;
    if (localStorage.getItem(guardKey)) return;

    (async () => {
      try {
        // 연체 미수금 조회
        const { data: overdue } = await db
          .from("finance_records")
          .select("id, amount, paid_amount, due_date, customers(name)")
          .eq("record_type", "receivable")
          .eq("is_paid", false)
          .not("due_date", "is", null)
          .lt("due_date", today);

        const rows = (overdue ?? []).filter(
          (r: any) => Number(r.amount) - Number(r.paid_amount ?? 0) > 0
        );
        if (!rows.length) {
          localStorage.setItem(guardKey, "1");
          return;
        }

        const total = rows.reduce(
          (s: number, r: any) => s + Number(r.amount) - Number(r.paid_amount ?? 0),
          0
        );

        // "미수금 알림" 방 찾기 or 생성
        let roomId: string | null = null;
        const { data: room } = await db
          .from("chat_rooms")
          .select("id")
          .eq("name", ROOM_NAME)
          .maybeSingle();

        if (room) {
          roomId = room.id;
        } else {
          const { data: newRoom, error } = await db
            .from("chat_rooms")
            .insert({ room_type: "group", name: ROOM_NAME, created_by: userId })
            .select()
            .single();
          if (error || !newRoom) {
            localStorage.setItem(guardKey, "1");
            return;
          }
          roomId = newRoom.id;

          // 관리자·직원 전원 초대
          const { data: staff } = await db.rpc("list_chat_staff");
          const memberIds = Array.from(
            new Set<string>([userId, ...((staff ?? []) as any[]).map((s) => s.user_id)])
          );
          await db
            .from("chat_room_members")
            .insert(memberIds.map((id) => ({ room_id: roomId, user_id: id })));
        }

        if (!roomId) {
          localStorage.setItem(guardKey, "1");
          return;
        }

        const lines = rows.slice(0, 5).map(
          (r: any) =>
            `· ${r.customers?.name ?? "고객 미지정"} ${(
              Number(r.amount) - Number(r.paid_amount ?? 0)
            ).toLocaleString("ko-KR")}원 (만기 ${r.due_date})`
        );
        const content =
          `⏰ 연체 미수금 ${rows.length}건, 총 ${total.toLocaleString("ko-KR")}원\n` +
          lines.join("\n") +
          (rows.length > 5 ? `\n외 ${rows.length - 5}건` : "") +
          `\n→ 미수금 관리에서 확인하세요`;

        await db.from("chat_messages").insert({
          room_id: roomId,
          sender_id: userId,
          content,
        });

        localStorage.setItem(guardKey, "1");
      } catch {
        // 조용히 무시 — 다음 접속 시 재시도
      }
    })();
  }, [userId, isCustomer, isLoading]);
}
