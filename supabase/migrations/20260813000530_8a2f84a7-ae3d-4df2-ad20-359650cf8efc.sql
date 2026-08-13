-- 1. 보험사 주소록
CREATE TABLE public.insurance_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  fax text,
  email text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_companies TO authenticated;
GRANT ALL ON public.insurance_companies TO service_role;
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view insurance companies" ON public.insurance_companies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role));
CREATE POLICY "Staff can insert insurance companies" ON public.insurance_companies
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role));
CREATE POLICY "Staff can update insurance companies" ON public.insurance_companies
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role));
CREATE POLICY "Admins can delete insurance companies" ON public.insurance_companies
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

-- 2. 보험수리 건
CREATE TABLE public.insurance_repairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  insurance_company_id uuid REFERENCES public.insurance_companies(id) ON DELETE SET NULL,
  branch text,
  technician text,
  accident_date date,
  claim_number text,
  status text NOT NULL DEFAULT '수리대기'
    CHECK (status IN ('수리대기','수리중','수리완료','청구완료','입금완료','완료')),
  description text,
  notes text,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  estimate_amount integer,
  claim_amount integer,
  deductible integer,
  paid_amount integer,
  repair_started_at date,
  repair_done_at date,
  claimed_at date,
  paid_at date,
  completed_at timestamptz,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insurance_repairs_status ON public.insurance_repairs(status);
CREATE INDEX idx_insurance_repairs_customer ON public.insurance_repairs(customer_id);
CREATE INDEX idx_insurance_repairs_machine ON public.insurance_repairs(machine_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_repairs TO authenticated;
GRANT ALL ON public.insurance_repairs TO service_role;
ALTER TABLE public.insurance_repairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view insurance repairs" ON public.insurance_repairs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role));
CREATE POLICY "Staff can insert insurance repairs" ON public.insurance_repairs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role));
CREATE POLICY "Staff can update insurance repairs" ON public.insurance_repairs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role));
CREATE POLICY "Staff can delete insurance repairs" ON public.insurance_repairs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role));

-- 3. 수리사진
CREATE TABLE public.insurance_repair_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id uuid NOT NULL REFERENCES public.insurance_repairs(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  kind text NOT NULL DEFAULT '기타' CHECK (kind IN ('수리전','수리후','기타')),
  caption text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insurance_repair_photos_repair ON public.insurance_repair_photos(repair_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_repair_photos TO authenticated;
GRANT ALL ON public.insurance_repair_photos TO service_role;
ALTER TABLE public.insurance_repair_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view insurance photos" ON public.insurance_repair_photos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role));
CREATE POLICY "Staff can insert insurance photos" ON public.insurance_repair_photos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role));
CREATE POLICY "Staff can delete insurance photos" ON public.insurance_repair_photos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role));

-- 4. updated_at / updated_by 트리거
CREATE TRIGGER trg_insurance_companies_updated
  BEFORE UPDATE ON public.insurance_companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_insurance_repairs_last_modifier
  BEFORE INSERT OR UPDATE ON public.insurance_repairs
  FOR EACH ROW EXECUTE FUNCTION public.set_last_modifier();

-- 5. 사진 저장소 접근 정책
CREATE POLICY "Staff can read insurance photo files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'insurance-photos' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role)));
CREATE POLICY "Staff can upload insurance photo files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'insurance-photos' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role)));
CREATE POLICY "Staff can delete insurance photo files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'insurance-photos' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role)));