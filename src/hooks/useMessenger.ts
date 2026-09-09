import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

const db = supabase as any;

export interface StaffMember {
  user_id: string;
  display_name: string;
  team: string | null;
  branch: string | null;
  role: "admin" | "employee";
}

export interface ChatRoom {
  id: string;
  name: string | null;
  room_type: "direct" | "group";
  created_by: string | null;
  related_customer_id: string | null;
  related_machine_id: string | null;
  last_message_at: string;
  last_message_preview: string | null;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface RoomSummary extends ChatRoom {
  memberIds: string[];
  unread: number;
  myLastReadAt: string;
}

/** 사내 직원 목록 (관리자·직원만) */
export function useChatStaff() {
  return useQuery<StaffMember[]>({
    queryKey: ["chat-staff"],
    queryFn: async () => {
      const { data, error } = await db.rpc("list_chat_staff");
      if (error) throw error;
      return (data ?? []) as StaffMember[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

/** 내가 참여한 대화방 목록 + 안읽은 개수 */
export function useChatRooms() {
  const { userId } = useUserRole();
  const qc = useQueryClient();

  const query = useQuery<RoomSummary[]>({
    queryKey: ["chat-rooms", userId],
    enabled: !!userId,
    staleTime: 1000 * 20,
    queryFn: async () => {
      const { data: myMemberships, error: mErr } = await db
        .from("chat_room_members")
        .select("room_id, last_read_at")
        .eq("user_id", userId);
      if (mErr) throw mErr;
      const roomIds = (myMemberships ?? []).map((m: any) => m.room_id);
      if (roomIds.length === 0) return [];

      const [roomsRes, membersRes, msgsRes] = await Promise.all([
        db.from("chat_rooms").select("*").in("id", roomIds).order("last_message_at", { ascending: false }),
        db.from("chat_room_members").select("room_id, user_id").in("room_id", roomIds),
        db.from("chat_messages").select("room_id, sender_id, created_at").in("room_id", roomIds)
          .order("created_at", { ascending: false }).limit(1000),
      ]);
      if (roomsRes.error) throw roomsRes.error;

      const readMap: Record<string, string> = {};
      (myMemberships ?? []).forEach((m: any) => { readMap[m.room_id] = m.last_read_at; });

      const memberMap: Record<string, string[]> = {};
      (membersRes.data ?? []).forEach((m: any) => {
        (memberMap[m.room_id] ||= []).push(m.user_id);
      });

      const unreadMap: Record<string, number> = {};
      (msgsRes.data ?? []).forEach((m: any) => {
        if (m.sender_id === userId) return;
        if (new Date(m.created_at) > new Date(readMap[m.room_id] ?? 0)) {
          unreadMap[m.room_id] = (unreadMap[m.room_id] ?? 0) + 1;
        }
      });

      return (roomsRes.data ?? []).map((r: any) => ({
        ...r,
        memberIds: memberMap[r.id] ?? [],
        unread: unreadMap[r.id] ?? 0,
        myLastReadAt: readMap[r.id],
      })) as RoomSummary[];
    },
  });

  // 실시간 갱신
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("messenger-rooms")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-rooms", userId] });
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_rooms" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-rooms", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  const totalUnread = useMemo(
    () => (query.data ?? []).reduce((s, r) => s + r.unread, 0),
    [query.data],
  );

  return { ...query, rooms: query.data ?? [], totalUnread };
}

/** 사이드바 배지용 안읽은 총 개수 */
export function useUnreadCount() {
  const { userId, isCustomer } = useUserRole();
  const { data } = useQuery<number>({
    queryKey: ["chat-unread-total", userId],
    enabled: !!userId && !isCustomer,
    refetchInterval: 1000 * 60,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data: memberships } = await db
        .from("chat_room_members").select("room_id, last_read_at").eq("user_id", userId);
      const rows = memberships ?? [];
      if (rows.length === 0) return 0;
      const { data: msgs } = await db
        .from("chat_messages")
        .select("room_id, sender_id, created_at")
        .in("room_id", rows.map((r: any) => r.room_id))
        .order("created_at", { ascending: false })
        .limit(1000);
      const readMap: Record<string, string> = {};
      rows.forEach((r: any) => { readMap[r.room_id] = r.last_read_at; });
      return (msgs ?? []).filter((m: any) =>
        m.sender_id !== userId && new Date(m.created_at) > new Date(readMap[m.room_id] ?? 0),
      ).length;
    },
  });
  return data ?? 0;
}

/** 특정 방의 메시지 */
export function useChatMessages(roomId: string | null) {
  return useQuery<ChatMessage[]>({
    queryKey: ["chat-messages", roomId],
    enabled: !!roomId,
    staleTime: 1000 * 10,
    queryFn: async () => {
      const { data, error } = await db
        .from("chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });
}

export function useMessengerActions() {
  const { userId } = useUserRole();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["chat-rooms", userId] });
    qc.invalidateQueries({ queryKey: ["chat-messages"] });
    qc.invalidateQueries({ queryKey: ["chat-unread-total", userId] });
  };

  /** 1:1 대화방 찾기 또는 생성 */
  const openDirect = useMutation({
    mutationFn: async (otherUserId: string) => {
      const { data: mine } = await db
        .from("chat_room_members").select("room_id").eq("user_id", userId);
      const myRoomIds = (mine ?? []).map((r: any) => r.room_id);
      if (myRoomIds.length) {
        const { data: rooms } = await db
          .from("chat_rooms").select("id, room_type").in("id", myRoomIds).eq("room_type", "direct");
        const directIds = (rooms ?? []).map((r: any) => r.id);
        if (directIds.length) {
          const { data: members } = await db
            .from("chat_room_members").select("room_id, user_id").in("room_id", directIds);
          const grouped: Record<string, string[]> = {};
          (members ?? []).forEach((m: any) => { (grouped[m.room_id] ||= []).push(m.user_id); });
          const found = Object.entries(grouped).find(
            ([, ids]) => ids.length === 2 && ids.includes(otherUserId) && ids.includes(userId!),
          );
          if (found) return found[0];
        }
      }
      const { data: room, error } = await db
        .from("chat_rooms")
        .insert({ room_type: "direct", created_by: userId })
        .select()
        .single();
      if (error) throw error;
      const { error: memErr } = await db.from("chat_room_members").insert([
        { room_id: room.id, user_id: userId },
        { room_id: room.id, user_id: otherUserId },
      ]);
      if (memErr) throw memErr;
      return room.id as string;
    },
    onSuccess: invalidate,
  });

  /** 단체 대화방 생성 */
  const createGroup = useMutation({
    mutationFn: async (input: {
      name: string;
      memberIds: string[];
      customerId?: string | null;
      machineId?: string | null;
    }) => {
      const { data: room, error } = await db
        .from("chat_rooms")
        .insert({
          room_type: "group",
          name: input.name,
          created_by: userId,
          related_customer_id: input.customerId ?? null,
          related_machine_id: input.machineId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const ids = Array.from(new Set([userId!, ...input.memberIds]));
      const { error: memErr } = await db
        .from("chat_room_members")
        .insert(ids.map((id) => ({ room_id: room.id, user_id: id })));
      if (memErr) throw memErr;
      return room.id as string;
    },
    onSuccess: invalidate,
  });

  const sendMessage = useMutation({
    mutationFn: async (input: { roomId: string; content?: string; file?: File | null }) => {
      let filePath: string | null = null;
      let fileName: string | null = null;
      let mimeType: string | null = null;
      let fileSize: number | null = null;

      if (input.file) {
        const ext = input.file.name.split(".").pop() ?? "bin";
        const path = `${input.roomId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-files")
          .upload(path, input.file, { contentType: input.file.type || undefined });
        if (upErr) throw upErr;
        filePath = path;
        fileName = input.file.name;
        mimeType = input.file.type || null;
        fileSize = input.file.size;
      }

      const { error } = await db.from("chat_messages").insert({
        room_id: input.roomId,
        sender_id: userId,
        content: input.content?.trim() || null,
        file_path: filePath,
        file_name: fileName,
        mime_type: mimeType,
        file_size: fileSize,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("chat_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const markRead = useMutation({
    mutationFn: async (roomId: string) => {
      await db
        .from("chat_room_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-rooms", userId] });
      qc.invalidateQueries({ queryKey: ["chat-unread-total", userId] });
    },
  });

  const leaveRoom = useMutation({
    mutationFn: async (roomId: string) => {
      const { error } = await db
        .from("chat_room_members").delete().eq("room_id", roomId).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addMembers = useMutation({
    mutationFn: async (input: { roomId: string; userIds: string[] }) => {
      const { error } = await db
        .from("chat_room_members")
        .insert(input.userIds.map((id) => ({ room_id: input.roomId, user_id: id })));
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { openDirect, createGroup, sendMessage, deleteMessage, markRead, leaveRoom, addMembers };
}

/** 메시지 검색 (내가 참여한 방 전체) */
export function useMessageSearch(keyword: string) {
  const { userId } = useUserRole();
  const term = keyword.trim();
  return useQuery<ChatMessage[]>({
    queryKey: ["chat-search", userId, term],
    enabled: !!userId && term.length >= 2,
    queryFn: async () => {
      const { data, error } = await db
        .from("chat_messages")
        .select("*")
        .ilike("content", `%${term}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });
}

export async function getChatFileUrl(path: string) {
  const { data } = await supabase.storage.from("chat-files").createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}
