-- 직원 인사 정보 테이블
CREATE TABLE public.employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text,
  address text,
  resident_number text,        -- 주민등록번호 (실서비스에서는 암호화 권장)
  team text,                   -- 영업팀 | 기사팀 | 사무팀
  position text,               -- 직책 (과장, 기사 등)
  salary integer,              -- 급여 (원)
  join_date date,              -- 입사일
  notes text,                  -- 비고
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- 계정 연동
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_employees"
  ON public.employees FOR ALL
  USING (true) WITH CHECK (true);
