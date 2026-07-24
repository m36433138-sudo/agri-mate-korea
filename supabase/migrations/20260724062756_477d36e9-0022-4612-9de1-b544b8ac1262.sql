
CREATE TABLE public.attachment_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  name text NOT NULL,
  model text,
  category text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachment_catalog TO authenticated;
GRANT ALL ON public.attachment_catalog TO service_role;
ALTER TABLE public.attachment_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view attachment catalog"
  ON public.attachment_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and employees can insert attachment catalog"
  ON public.attachment_catalog FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Admins and employees can update attachment catalog"
  ON public.attachment_catalog FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Admins can delete attachment catalog"
  ON public.attachment_catalog FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_attachment_catalog_updated_at
  BEFORE UPDATE ON public.attachment_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_attachment_catalog_brand ON public.attachment_catalog(brand);
CREATE INDEX idx_attachment_catalog_active ON public.attachment_catalog(is_active);

ALTER TABLE public.machine_attachments
  ADD COLUMN IF NOT EXISTS catalog_id uuid REFERENCES public.attachment_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand text;
