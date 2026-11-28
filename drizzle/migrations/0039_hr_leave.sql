-- 인사관리: 인사카드 항목, 휴가(연차·반차·병가 등) 신청/승인, 연차 조정, 휴가 달력.
-- 쓰기는 RPC 로만: 직원은 자기 휴가만 신청·취소, 승인/반려와 대신 등록은 관리자만.

-- 1) 인사카드 항목
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_type text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS branch text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact text;

-- 2) 공휴일: 2027년 추가 (주말·공휴일은 휴가 일수에서 빠진다, 초과근무 계산과 같은 표)
CREATE OR REPLACE FUNCTION public.kr_is_holiday(_d date)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT extract(isodow FROM _d) IN (6,7) OR _d = ANY (ARRAY[
    '2025-01-01','2025-01-28','2025-01-29','2025-01-30','2025-03-01','2025-05-01','2025-05-05','2025-05-06',
    '2025-06-06','2025-08-15','2025-10-03','2025-10-05','2025-10-06','2025-10-07','2025-10-08','2025-10-09','2025-12-25',
    '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-03-01','2026-03-02','2026-05-01','2026-05-05',
    '2026-05-24','2026-06-06','2026-08-15','2026-09-24','2026-09-25','2026-09-26','2026-10-03','2026-10-09','2026-12-25',
    '2027-01-01','2027-02-06','2027-02-07','2027-02-08','2027-02-09','2027-03-01','2027-05-01','2027-05-05','2027-05-13',
    '2027-06-06','2027-08-15','2027-08-16','2027-09-14','2027-09-15','2027-09-16','2027-10-03','2027-10-04',
    '2027-10-09','2027-10-11','2027-12-25','2027-12-27'
  ]::date[])
$function$;

-- 3) 휴가
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('연차','오전반차','오후반차','병가','경조사','공가','대체휴무','무급휴가')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days numeric(5,1) NOT NULL CHECK (days >= 0),
  reason text,
  status text NOT NULL DEFAULT '신청' CHECK (status IN ('신청','승인','반려','취소')),
  requested_by uuid DEFAULT auth.uid(),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS leave_requests_emp_idx ON public.leave_requests (employee_id, start_date);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx ON public.leave_requests (status, start_date);

-- 연차 조정 (이월, 포상, 사용 보정 등): 그 연차 기간(period_start)에 더하거나 뺀다
CREATE TABLE IF NOT EXISTS public.leave_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  days numeric(5,1) NOT NULL,
  reason text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leave_adjustments_emp_idx ON public.leave_adjustments (employee_id, period_start);

GRANT SELECT ON public.leave_requests, public.leave_adjustments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.leave_adjustments TO authenticated;
GRANT UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests, public.leave_adjustments TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_adjustments ENABLE ROW LEVEL SECURITY;

-- 본인 것 또는 관리자만 읽는다 (다른 직원은 이름·날짜만 leave_calendar 로)
CREATE POLICY "Own or admin read leave" ON public.leave_requests FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    OR employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = (SELECT auth.uid())));
CREATE POLICY "Admin edit leave" ON public.leave_requests FOR UPDATE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));
CREATE POLICY "Admin delete leave" ON public.leave_requests FOR DELETE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

CREATE POLICY "Own or admin read leave adjustments" ON public.leave_adjustments FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    OR employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = (SELECT auth.uid())));
CREATE POLICY "Admin write leave adjustments" ON public.leave_adjustments FOR ALL TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

-- 휴가 일수: 반차 0.5, 그 밖에는 기간 중 주말·공휴일을 뺀 날 수
CREATE OR REPLACE FUNCTION public.leave_days(_kind text, _start date, _end date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN _kind IN ('오전반차','오후반차') THEN 0.5
    ELSE (SELECT count(*) FROM generate_series(_start, _end, interval '1 day') g(d) WHERE NOT public.kr_is_holiday(g.d::date))::numeric END
$function$;

-- 휴가 신청. _employee_id 를 주면 관리자가 대신 등록(바로 승인)한다.
CREATE OR REPLACE FUNCTION public.request_leave(_kind text, _start date, _end date, _reason text DEFAULT NULL, _employee_id uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _admin boolean; _emp uuid; _days numeric; _id uuid;
BEGIN
  IF _uid IS NULL OR NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'employee')) THEN
    RAISE EXCEPTION '직원만 휴가를 신청할 수 있어요';
  END IF;
  _admin := public.has_role(_uid, 'admin');
  IF _employee_id IS NOT NULL AND NOT _admin THEN RAISE EXCEPTION '다른 사람 휴가는 관리자만 등록할 수 있어요'; END IF;
  _emp := coalesce(_employee_id, (SELECT id FROM public.employees WHERE user_id = _uid ORDER BY created_at LIMIT 1));
  IF _emp IS NULL THEN RAISE EXCEPTION '이 계정에 직원 정보가 연결돼 있지 않아요'; END IF;
  IF _start IS NULL OR _end IS NULL OR _end < _start THEN RAISE EXCEPTION '날짜를 확인해 주세요'; END IF;
  IF _kind IN ('오전반차','오후반차') AND _end <> _start THEN RAISE EXCEPTION '반차는 하루만 고를 수 있어요'; END IF;
  IF _end - _start > 60 THEN RAISE EXCEPTION '한 번에 60일까지만 신청할 수 있어요'; END IF;
  _days := public.leave_days(_kind, _start, _end);
  IF _days <= 0 THEN RAISE EXCEPTION '고른 기간이 모두 주말·공휴일이에요'; END IF;
  IF EXISTS (SELECT 1 FROM public.leave_requests WHERE employee_id = _emp AND status IN ('신청','승인')
             AND start_date <= _end AND end_date >= _start
             AND NOT (kind = '오전반차' AND _kind = '오후반차') AND NOT (kind = '오후반차' AND _kind = '오전반차')) THEN
    RAISE EXCEPTION '그 기간에 이미 신청한 휴가가 있어요';
  END IF;
  INSERT INTO public.leave_requests (employee_id, kind, start_date, end_date, days, reason, status, decided_by, decided_at)
  VALUES (_emp, _kind, _start, _end, _days, NULLIF(btrim(_reason), ''),
          CASE WHEN _employee_id IS NOT NULL THEN '승인' ELSE '신청' END,
          CASE WHEN _employee_id IS NOT NULL THEN _uid END, CASE WHEN _employee_id IS NOT NULL THEN now() END)
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$;

-- 본인 취소: 승인 전이거나, 승인됐어도 아직 시작 전이면
CREATE OR REPLACE FUNCTION public.cancel_leave(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.leave_requests%ROWTYPE; _uid uuid := auth.uid();
BEGIN
  SELECT * INTO r FROM public.leave_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '휴가 신청을 찾을 수 없어요'; END IF;
  IF NOT (public.has_role(_uid, 'admin') OR r.employee_id IN (SELECT id FROM public.employees WHERE user_id = _uid)) THEN
    RAISE EXCEPTION '본인 휴가만 취소할 수 있어요';
  END IF;
  IF r.status NOT IN ('신청','승인') THEN RAISE EXCEPTION '이미 %된 휴가예요', r.status; END IF;
  IF r.status = '승인' AND r.start_date <= (now() AT TIME ZONE 'Asia/Seoul')::date AND NOT public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION '이미 시작한 휴가는 관리자에게 취소를 부탁해 주세요';
  END IF;
  UPDATE public.leave_requests SET status = '취소' WHERE id = _id;
END;
$function$;

-- 관리자 승인/반려
CREATE OR REPLACE FUNCTION public.decide_leave(_id uuid, _approve boolean, _note text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_uid, 'admin') THEN RAISE EXCEPTION '관리자만 승인할 수 있어요'; END IF;
  UPDATE public.leave_requests
     SET status = CASE WHEN _approve THEN '승인' ELSE '반려' END, decided_by = _uid, decided_at = now(), decision_note = NULLIF(btrim(_note), '')
   WHERE id = _id AND status = '신청';
  IF NOT FOUND THEN RAISE EXCEPTION '승인 대기 중인 신청이 아니에요'; END IF;
END;
$function$;

-- 휴가 달력: 직원 누구나 「누가 언제 쉬는지」만 본다 (사유는 빼고)
CREATE OR REPLACE FUNCTION public.leave_calendar(_from date, _to date)
 RETURNS TABLE (id uuid, employee_id uuid, name text, team text, kind text, start_date date, end_date date, days numeric, status text)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION '직원만 볼 수 있어요'; END IF;
  RETURN QUERY
    SELECT l.id, l.employee_id, e.name, e.team, l.kind, l.start_date, l.end_date, l.days, l.status
      FROM public.leave_requests l JOIN public.employees e ON e.id = l.employee_id
     WHERE l.status IN ('신청','승인') AND l.start_date <= _to AND l.end_date >= _from
     ORDER BY l.start_date, e.name;
END;
$function$;

REVOKE ALL ON FUNCTION public.request_leave(text, date, date, text, uuid), public.cancel_leave(uuid), public.decide_leave(uuid, boolean, text), public.leave_calendar(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_leave(text, date, date, text, uuid), public.cancel_leave(uuid), public.decide_leave(uuid, boolean, text), public.leave_calendar(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_days(text, date, date) TO authenticated;
