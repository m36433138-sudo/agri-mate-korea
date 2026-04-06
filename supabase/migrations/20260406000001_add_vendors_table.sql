-- 업체(거래처) 관리 테이블
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  representative text,
  phone text,
  business_number text,
  items text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 모두 읽기/쓰기 가능
CREATE POLICY "vendors_select" ON public.vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "vendors_insert" ON public.vendors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "vendors_update" ON public.vendors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "vendors_delete" ON public.vendors FOR DELETE TO authenticated USING (true);
