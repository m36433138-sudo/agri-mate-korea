CREATE TABLE public.error_code_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  machine_types text[] NOT NULL DEFAULT '{}',
  series text NOT NULL,
  controller text,
  part text,
  symptom text,
  cause text,
  remedy text,
  recovery text,
  source text NOT NULL,
  source_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT error_code_catalog_series_code_key UNIQUE (series, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_code_catalog TO authenticated;
GRANT ALL ON public.error_code_catalog TO service_role;

ALTER TABLE public.error_code_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read error code catalog"
  ON public.error_code_catalog FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can add error code catalog entries"
  ON public.error_code_catalog FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can edit error code catalog entries"
  ON public.error_code_catalog FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete error code catalog entries"
  ON public.error_code_catalog FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX error_code_catalog_sort_idx ON public.error_code_catalog (sort_order);

CREATE TRIGGER error_code_catalog_set_updated_at
  BEFORE UPDATE ON public.error_code_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();