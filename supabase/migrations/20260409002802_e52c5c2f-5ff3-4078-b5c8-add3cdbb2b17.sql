
CREATE TABLE public.vendors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  representative text,
  phone text,
  business_number text,
  items text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/employee access vendors"
ON public.vendors
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));
