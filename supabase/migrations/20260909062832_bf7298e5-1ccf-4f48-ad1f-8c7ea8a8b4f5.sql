-- 대화방
CREATE TABLE public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  room_type text NOT NULL DEFAULT 'group',
  created_by uuid REFERENCES auth.users(id),
  related_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  related_machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_rooms TO authenticated;
GRANT ALL ON public.chat_rooms TO service_role;

-- 참여자
CREATE TABLE public.chat_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_room_members TO authenticated;
GRANT ALL ON public.chat_room_members TO service_role;

-- 메시지
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  file_path text,
  file_name text,
  mime_type text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

CREATE INDEX idx_chat_messages_room_created ON public.chat_messages (room_id, created_at DESC);
CREATE INDEX idx_chat_messages_content_search ON public.chat_messages USING gin (to_tsvector('simple', coalesce(content,'')));
CREATE INDEX idx_chat_room_members_user ON public.chat_room_members (user_id);
CREATE INDEX idx_chat_rooms_last_msg ON public.chat_rooms (last_message_at DESC);

-- 방 참여 여부 확인 (RLS 재귀 방지)
CREATE OR REPLACE FUNCTION public.is_chat_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE room_id = _room_id AND user_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_chat_room_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_room_member(uuid, uuid) TO authenticated, service_role;

-- 사내 사용자(관리자/직원)만 사용
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','employee')
  )
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- chat_rooms
CREATE POLICY "staff view own rooms" ON public.chat_rooms FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) AND (public.is_chat_room_member(id, auth.uid()) OR created_by = auth.uid()));

CREATE POLICY "staff create rooms" ON public.chat_rooms FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "creator or admin update rooms" ON public.chat_rooms FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()) AND (public.is_chat_room_member(id, auth.uid()) OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "creator or admin delete rooms" ON public.chat_rooms FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- chat_room_members
CREATE POLICY "members view members" ON public.chat_room_members FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) AND (user_id = auth.uid() OR public.is_chat_room_member(room_id, auth.uid())));

CREATE POLICY "staff add members" ON public.chat_room_members FOR INSERT TO authenticated
WITH CHECK (
  public.is_staff(auth.uid()) AND (
    public.is_chat_room_member(room_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.created_by = auth.uid())
  )
);

CREATE POLICY "update own membership" ON public.chat_room_members FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "remove membership" ON public.chat_room_members FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.created_by = auth.uid())
);

-- chat_messages
CREATE POLICY "members view messages" ON public.chat_messages FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) AND public.is_chat_room_member(room_id, auth.uid()));

CREATE POLICY "members send messages" ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND sender_id = auth.uid() AND public.is_chat_room_member(room_id, auth.uid()));

CREATE POLICY "sender edit messages" ON public.chat_messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

CREATE POLICY "sender or admin delete messages" ON public.chat_messages FOR DELETE TO authenticated
USING (sender_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- updated_at 트리거
CREATE TRIGGER trg_chat_rooms_updated_at BEFORE UPDATE ON public.chat_rooms
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_chat_messages_updated_at BEFORE UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 새 메시지 시 방 미리보기 갱신
CREATE OR REPLACE FUNCTION public.touch_chat_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_rooms
  SET last_message_at = NEW.created_at,
      last_message_preview = COALESCE(NULLIF(NEW.content,''), CASE WHEN NEW.file_path IS NOT NULL THEN '[첨부파일] ' || COALESCE(NEW.file_name,'') ELSE '' END)
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_messages_touch_room AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_chat_room();

-- 실시간 반영
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
