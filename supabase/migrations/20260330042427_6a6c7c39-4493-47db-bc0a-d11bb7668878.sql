
CREATE TABLE public.repair_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch text NOT NULL,
  row_index integer NOT NULL,
  content text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  done_at timestamp with time zone
);

ALTER TABLE public.repair_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/employee access repair_notes"
ON public.repair_notes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
