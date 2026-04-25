CREATE TABLE IF NOT EXISTS public.visit_repair_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_index integer NOT NULL UNIQUE,
  status_label text,
  customer_name text,
  phone text,
  address text,
  machine text,
  model text,
  serial_number text,
  technician text,
  visit_date text,
  requirements text,
  parts_used text,
  cost integer,
  is_completed boolean NOT NULL DEFAULT false,
  notes text,
  writer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_repair_completed ON public.visit_repair_rows(is_completed);
CREATE INDEX IF NOT EXISTS idx_visit_repair_technician ON public.visit_repair_rows(technician);

DROP TRIGGER IF EXISTS trg_visit_repair_updated_at ON public.visit_repair_rows;
CREATE TRIGGER trg_visit_repair_updated_at
BEFORE UPDATE ON public.visit_repair_rows
FOR EACH ROW
EXECUTE FUNCTION public.update_operation_rows_updated_at();

ALTER TABLE public.visit_repair_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/employee access visit_repair_rows"
ON public.visit_repair_rows
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));

ALTER TABLE public.visit_repair_rows REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.visit_repair_rows;