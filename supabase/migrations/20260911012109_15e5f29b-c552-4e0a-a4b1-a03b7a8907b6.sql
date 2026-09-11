CREATE TABLE public.repair_error_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id uuid NOT NULL REFERENCES public.repairs(id) ON DELETE CASCADE,
  error_code text NOT NULL,
  symptom text,
  action_taken text,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at date,
  notes text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_error_codes TO authenticated;
GRANT ALL ON public.repair_error_codes TO service_role;

ALTER TABLE public.repair_error_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage error codes"
ON public.repair_error_codes FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Customers view own error codes"
ON public.repair_error_codes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.repairs r
  JOIN public.machines m ON m.id = r.machine_id
  JOIN public.customers c ON c.id = m.customer_id
  WHERE r.id = repair_error_codes.repair_id
    AND c.user_id = auth.uid()
));

CREATE INDEX idx_repair_error_codes_repair ON public.repair_error_codes(repair_id);
CREATE INDEX idx_repair_error_codes_code ON public.repair_error_codes(upper(error_code));
CREATE INDEX idx_repair_error_codes_unresolved ON public.repair_error_codes(is_resolved) WHERE is_resolved = false;

CREATE TRIGGER trg_repair_error_codes_updated
BEFORE UPDATE ON public.repair_error_codes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_repair_error_codes_modifier
BEFORE INSERT OR UPDATE ON public.repair_error_codes
FOR EACH ROW EXECUTE FUNCTION public.set_last_modifier();