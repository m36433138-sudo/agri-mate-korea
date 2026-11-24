-- 외출: 근무 중 잠깐 나갔다 오는 시간. 업무 시간에서 빼고(초과근무 계산 포함), 외출 중에는 위치를 공유하지 않는다.
-- 외출 시작·복귀 때 위치는 기록하지 않는다. 하루 합계는 attendance_records.break_minutes 에 남긴다.
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS break_minutes integer NOT NULL DEFAULT 0;

CREATE TABLE public.attendance_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
-- 한 사람이 동시에 두 번 외출할 수는 없다
CREATE UNIQUE INDEX attendance_breaks_one_open ON public.attendance_breaks (employee_id) WHERE ended_at IS NULL;
CREATE INDEX attendance_breaks_day_idx ON public.attendance_breaks (employee_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_breaks TO authenticated;
GRANT ALL ON public.attendance_breaks TO service_role;
ALTER TABLE public.attendance_breaks ENABLE ROW LEVEL SECURITY;

-- 출퇴근 기록과 같은 범위: 본인 것만, 관리자는 전부. 지우기는 관리자만.
CREATE POLICY "own or admin read breaks" ON public.attendance_breaks FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR employee_id IN (SELECT id FROM public.employees WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "own or admin add breaks" ON public.attendance_breaks FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR employee_id IN (SELECT id FROM public.employees WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "own or admin end breaks" ON public.attendance_breaks FOR UPDATE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR employee_id IN (SELECT id FROM public.employees WHERE user_id = (SELECT auth.uid())))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR employee_id IN (SELECT id FROM public.employees WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "admin delete breaks" ON public.attendance_breaks FOR DELETE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')));
