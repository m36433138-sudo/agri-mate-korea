
-- 1) companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  business_number text,
  ceo_name text,
  address text,
  phone text,
  fax text,
  stamp_url text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_read_staff" ON public.companies FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "companies_write_admin" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2) quote_products
CREATE TABLE public.quote_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  spec text,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  category text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_products TO authenticated;
GRANT ALL ON public.quote_products TO service_role;
ALTER TABLE public.quote_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_products_staff_all" ON public.quote_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));

-- 3) quotes
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE NOT NULL,
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  customer_address text,
  customer_ssn text,
  trade_in_amount numeric(14,2) NOT NULL DEFAULT 0,
  memo text,
  signature_data text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  branch text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quotes_date_idx ON public.quotes(quote_date DESC);
CREATE INDEX quotes_company_idx ON public.quotes(company_id);
CREATE INDEX quotes_customer_idx ON public.quotes(customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- staff can read all quotes (SSN column will be restricted via view/app layer; admin sees all)
CREATE POLICY "quotes_staff_read" ON public.quotes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "quotes_staff_insert" ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "quotes_staff_update" ON public.quotes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "quotes_admin_delete" ON public.quotes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 4) quote_items
CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.quote_products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  spec text,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount_rate numeric(5,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quote_items_quote_idx ON public.quote_items(quote_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_items_staff_all" ON public.quote_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));

-- updated_at trigger (reuse pattern)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_quote_products_updated BEFORE UPDATE ON public.quote_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) 견적번호 채번 함수 (YYMMDD-NNN)
CREATE OR REPLACE FUNCTION public.next_quote_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prefix text := to_char(CURRENT_DATE,'YYMMDD');
  cnt int;
BEGIN
  SELECT COUNT(*)+1 INTO cnt FROM public.quotes WHERE quote_number LIKE prefix||'-%';
  RETURN prefix||'-'||lpad(cnt::text,3,'0');
END; $$;

-- 6) 초기 사업자 데이터
INSERT INTO public.companies (company_name, business_number, ceo_name, address, phone, is_default, sort_order) VALUES
  ('주식회사 광문','415-81-53203','안정미','전남 장흥군 장흥읍 남부관광로 50','010-4718-3138', true, 1),
  ('주식회사 광문지점','415-85-23430','안정미','전남 강진군 강진읍 남당로 34','010-4718-3138', false, 2),
  ('성민농기계', NULL, NULL, NULL, NULL, false, 3);
