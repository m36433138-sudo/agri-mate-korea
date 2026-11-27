CREATE OR REPLACE FUNCTION public.guard_customer_user_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION '고객 계정 연결은 관리자만 바꿀 수 있습니다.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_customer_user_link ON public.customers;
CREATE TRIGGER guard_customer_user_link BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.guard_customer_user_link();

CREATE OR REPLACE FUNCTION public.guard_chat_room_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION '방 만든 사람은 바꿀 수 없습니다.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_chat_room_owner ON public.chat_rooms;
CREATE TRIGGER guard_chat_room_owner BEFORE UPDATE ON public.chat_rooms
FOR EACH ROW EXECUTE FUNCTION public.guard_chat_room_owner();

CREATE OR REPLACE FUNCTION public.guard_attendance_break()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.started_at := now();
    IF NEW.ended_at IS NOT NULL THEN NEW.ended_at := now(); END IF;
  ELSE
    NEW.started_at := OLD.started_at;
    IF OLD.ended_at IS NOT NULL THEN
      NEW.ended_at := OLD.ended_at;
    ELSIF NEW.ended_at IS NOT NULL THEN
      NEW.ended_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_attendance_break ON public.attendance_breaks;
CREATE TRIGGER guard_attendance_break BEFORE INSERT OR UPDATE ON public.attendance_breaks
FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_break();

CREATE OR REPLACE FUNCTION public.kr_is_holiday(_d date)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT extract(isodow FROM _d) IN (6,7) OR _d = ANY (ARRAY[
    '2025-01-01','2025-01-28','2025-01-29','2025-01-30','2025-03-01','2025-05-01','2025-05-05','2025-05-06',
    '2025-06-06','2025-08-15','2025-10-03','2025-10-05','2025-10-06','2025-10-07','2025-10-08','2025-10-09','2025-12-25',
    '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-03-01','2026-03-02','2026-05-01','2026-05-05',
    '2026-05-24','2026-06-06','2026-08-15','2026-09-24','2026-09-25','2026-09-26','2026-10-03','2026-10-09','2026-12-25'
  ]::date[])
$$;

CREATE OR REPLACE FUNCTION public.guard_attendance_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i timestamptz; o timestamptz; d date; away int := 0; net int;
  ms timestamptz; ee timestamptz; m int := 0; a int := 0;
  r record;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.clock_in IS NOT NULL THEN NEW.clock_in := now(); END IF;
    NEW.clock_out := NULL;
  ELSE
    IF OLD.clock_in IS NOT NULL THEN NEW.clock_in := OLD.clock_in;
    ELSIF NEW.clock_in IS NOT NULL THEN NEW.clock_in := now(); END IF;
    IF OLD.clock_out IS NOT NULL THEN NEW.clock_out := OLD.clock_out;
    ELSIF NEW.clock_out IS NOT NULL THEN NEW.clock_out := now(); END IF;
  END IF;

  NEW.overtime_minutes := 0; NEW.morning_ot_minutes := 0; NEW.afternoon_ot_minutes := 0;
  i := NEW.clock_in; o := NEW.clock_out;
  IF i IS NULL OR o IS NULL OR o <= i THEN RETURN NEW; END IF;

  FOR r IN SELECT started_at s, COALESCE(ended_at, o) e FROM public.attendance_breaks
           WHERE employee_id = NEW.employee_id AND date = NEW.date LOOP
    away := away + GREATEST(0, floor(extract(epoch FROM (LEAST(o, r.e) - GREATEST(i, r.s))) / 60)::int);
  END LOOP;
  NEW.break_minutes := away;
  net := GREATEST(0, floor(extract(epoch FROM (o - i)) / 60)::int - away);
  d := (i AT TIME ZONE 'Asia/Seoul')::date;
  IF public.kr_is_holiday(d) THEN
    NEW.overtime_minutes := net; NEW.afternoon_ot_minutes := net; RETURN NEW;
  END IF;
  IF net < 480 THEN RETURN NEW; END IF;
  ms := (d::text || ' 08:30:00+09')::timestamptz;
  ee := (d::text || ' 18:00:00+09')::timestamptz;
  IF i < ms THEN
    m := GREATEST(0, floor(extract(epoch FROM (LEAST(o, ms) - i)) / 60)::int);
    FOR r IN SELECT started_at s, COALESCE(ended_at, o) e FROM public.attendance_breaks
             WHERE employee_id = NEW.employee_id AND date = NEW.date LOOP
      m := m - GREATEST(0, floor(extract(epoch FROM (LEAST(ms, o, r.e) - GREATEST(i, r.s))) / 60)::int);
    END LOOP;
    m := GREATEST(0, m);
  END IF;
  IF o > ee THEN
    a := GREATEST(0, floor(extract(epoch FROM (o - GREATEST(ee, i))) / 60)::int);
    FOR r IN SELECT started_at s, COALESCE(ended_at, o) e FROM public.attendance_breaks
             WHERE employee_id = NEW.employee_id AND date = NEW.date LOOP
      a := a - GREATEST(0, floor(extract(epoch FROM (LEAST(o, r.e) - GREATEST(ee, i, r.s))) / 60)::int);
    END LOOP;
    a := GREATEST(0, a);
  END IF;
  NEW.morning_ot_minutes := m; NEW.afternoon_ot_minutes := a; NEW.overtime_minutes := m + a;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_attendance_record ON public.attendance_records;
CREATE TRIGGER guard_attendance_record BEFORE INSERT OR UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_record();

REVOKE EXECUTE ON FUNCTION public.guard_customer_user_link(), public.guard_chat_room_owner(),
  public.guard_attendance_break(), public.guard_attendance_record() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.merge_customers(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid, text) TO service_role;