CREATE TABLE public.overtime_payout_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_tab text NOT NULL,
  row_index integer NOT NULL,
  employee_name text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  period_start text,
  period_end text,
  hours numeric,
  overtime_amount numeric,
  bonus_amount numeric,
  total_amount numeric,
  signature_data text,
  signed_by uuid REFERENCES auth.users(id),
  signed_at timestamptz,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  sheet_synced_at timestamptz,
  notes text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sheet_tab, row_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.overtime_payout_signatures TO authenticated;
GRANT ALL ON public.overtime_payout_signatures TO service_role;

ALTER TABLE public.overtime_payout_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_overtime_signatures" ON public.overtime_payout_signatures
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "employee_view_own_overtime_signature" ON public.overtime_payout_signatures
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND (e.id = overtime_payout_signatures.employee_id OR e.name = overtime_payout_signatures.employee_name)
    )
  );

CREATE POLICY "employee_sign_own_overtime" ON public.overtime_payout_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND (e.id = overtime_payout_signatures.employee_id OR e.name = overtime_payout_signatures.employee_name)
    )
  );

CREATE POLICY "employee_update_own_overtime" ON public.overtime_payout_signatures
  FOR UPDATE TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND (e.id = overtime_payout_signatures.employee_id OR e.name = overtime_payout_signatures.employee_name)
    )
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND (e.id = overtime_payout_signatures.employee_id OR e.name = overtime_payout_signatures.employee_name)
    )
  );

CREATE TRIGGER trg_overtime_signatures_modifier
  BEFORE INSERT OR UPDATE ON public.overtime_payout_signatures
  FOR EACH ROW EXECUTE FUNCTION public.set_last_modifier();