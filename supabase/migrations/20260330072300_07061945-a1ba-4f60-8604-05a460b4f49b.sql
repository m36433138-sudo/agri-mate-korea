CREATE TABLE public.customer_drive_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.customer_drive_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/employee access customer_drive_links" ON public.customer_drive_links FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));