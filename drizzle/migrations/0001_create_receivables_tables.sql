CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id),
  doc_type text NOT NULL DEFAULT 'quotation',
  title text NOT NULL,
  customer_id uuid REFERENCES public.customers(id),
  machine_id uuid REFERENCES public.machines(id),
  amount bigint,
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  status text NOT NULL DEFAULT 'issued',
  notes text,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read documents" ON public.documents FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update documents" ON public.documents FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff delete documents" ON public.documents FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.finance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id),
  record_type text NOT NULL DEFAULT 'receivable',
  customer_id uuid REFERENCES public.customers(id),
  document_id uuid REFERENCES public.documents(id),
  source_type text NOT NULL DEFAULT 'manual',
  source_id uuid,
  amount bigint NOT NULL DEFAULT 0,
  paid_amount bigint NOT NULL DEFAULT 0,
  due_date date,
  paid_date date,
  is_paid boolean NOT NULL DEFAULT false,
  notes text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_records TO authenticated;
GRANT ALL ON public.finance_records TO service_role;
ALTER TABLE public.finance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read finance_records" ON public.finance_records FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert finance_records" ON public.finance_records FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update finance_records" ON public.finance_records FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff delete finance_records" ON public.finance_records FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE TRIGGER set_finance_records_updated_at BEFORE UPDATE ON public.finance_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_finance_records_customer ON public.finance_records(customer_id);
CREATE INDEX idx_finance_records_unpaid ON public.finance_records(is_paid, due_date);

CREATE TABLE public.finance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finance_id uuid NOT NULL REFERENCES public.finance_records(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  paid_date date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_payments TO authenticated;
GRANT ALL ON public.finance_payments TO service_role;
ALTER TABLE public.finance_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read finance_payments" ON public.finance_payments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert finance_payments" ON public.finance_payments FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update finance_payments" ON public.finance_payments FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff delete finance_payments" ON public.finance_payments FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX idx_finance_payments_finance ON public.finance_payments(finance_id);