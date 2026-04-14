
-- 출퇴근 기록 테이블
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  overtime_minutes INTEGER NOT NULL DEFAULT 0,
  morning_ot_minutes INTEGER NOT NULL DEFAULT 0,
  afternoon_ot_minutes INTEGER NOT NULL DEFAULT 0,
  is_holiday BOOLEAN NOT NULL DEFAULT false,
  is_modified BOOLEAN NOT NULL DEFAULT false,
  modification_reason TEXT,
  is_settled BOOLEAN NOT NULL DEFAULT false,
  latitude_in DOUBLE PRECISION,
  longitude_in DOUBLE PRECISION,
  latitude_out DOUBLE PRECISION,
  longitude_out DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- 관리자: 전체 접근
CREATE POLICY "Admin full access attendance_records"
  ON public.attendance_records FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 직원: 본인 기록만 조회 (employee_id의 user_id가 본인인 경우)
CREATE POLICY "Employee view own attendance"
  ON public.attendance_records FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'employee'::app_role)
    AND employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- 직원: 본인 출퇴근 기록 생성/수정
CREATE POLICY "Employee insert own attendance"
  ON public.attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'::app_role))
    OR (
      public.has_role(auth.uid(), 'employee'::app_role)
      AND employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Employee update own attendance"
  ON public.attendance_records FOR UPDATE
  TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin'::app_role))
    OR (
      public.has_role(auth.uid(), 'employee'::app_role)
      AND employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

-- 초과근무 정산 테이블
CREATE TABLE public.overtime_settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_overtime_minutes INTEGER NOT NULL DEFAULT 0,
  hourly_rate INTEGER NOT NULL DEFAULT 0,
  bonus_amount INTEGER NOT NULL DEFAULT 0,
  total_payment INTEGER NOT NULL DEFAULT 0,
  settled_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.overtime_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access overtime_settlements"
  ON public.overtime_settlements FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employee view own settlements"
  ON public.overtime_settlements FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- employees 테이블에 시간당 초과수당 컬럼 추가
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS overtime_hourly_rate INTEGER DEFAULT 0;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_attendance_updated_at();

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
