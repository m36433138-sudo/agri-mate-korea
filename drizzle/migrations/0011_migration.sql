-- 지출 관리: 청구서·영수증을 AI가 읽어 항목별로 분류한 지출 표
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT current_date,
  vendor text,
  business_number text,
  category text NOT NULL DEFAULT '기타',
  description text NOT NULL DEFAULT '',
  quantity numeric,
  unit_price numeric,
  amount numeric NOT NULL DEFAULT 0,
  vat numeric,
  payment_method text,
  branch text,
  notes text,
  receipt_path text,
  receipt_group uuid,
  source text NOT NULL DEFAULT 'manual',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON public.expenses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'view_expenses')));
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'manage_expenses')));
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'manage_expenses')))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'manage_expenses')));
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'manage_expenses')));

CREATE INDEX expenses_date_idx ON public.expenses (expense_date DESC);
CREATE INDEX expenses_group_idx ON public.expenses (receipt_group);

CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 영수증 원본 (비공개 버킷 'receipts') 접근: 지출 조회/등록 권한자만
CREATE POLICY "receipts_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'view_expenses'))));
CREATE POLICY "receipts_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'manage_expenses'))));
CREATE POLICY "receipts_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'manage_expenses'))));