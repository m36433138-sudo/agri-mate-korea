
CREATE TABLE public.sheet_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch text NOT NULL,
  row_index integer NOT NULL,
  employee_name text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT '입고대기',
  customer_name text,
  machine_type text,
  model text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch, row_index)
);

ALTER TABLE public.sheet_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/employee access sheet_assignments" ON public.sheet_assignments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.sheet_assignments;
