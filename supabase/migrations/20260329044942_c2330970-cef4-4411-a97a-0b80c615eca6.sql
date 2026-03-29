
CREATE TABLE public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch varchar NOT NULL DEFAULT '장흥',
  part_code varchar NOT NULL,
  part_name varchar NOT NULL,
  previous_qty integer NOT NULL DEFAULT 0,
  new_qty integer NOT NULL DEFAULT 0,
  adjustment_qty integer NOT NULL DEFAULT 0,
  reason text,
  adjusted_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/employee access inventory_adjustments"
  ON public.inventory_adjustments
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
