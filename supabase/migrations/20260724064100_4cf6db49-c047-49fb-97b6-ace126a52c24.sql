
CREATE TABLE public.attachment_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachment_brands TO authenticated;
GRANT ALL ON public.attachment_brands TO service_role;

ALTER TABLE public.attachment_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view brands"
  ON public.attachment_brands FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin/Employee can insert brands"
  ON public.attachment_brands FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));

CREATE POLICY "Admin/Employee can update brands"
  ON public.attachment_brands FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));

CREATE POLICY "Admin can delete brands"
  ON public.attachment_brands FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER attachment_brands_updated_at
  BEFORE UPDATE ON public.attachment_brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults + any existing brand names from catalog
INSERT INTO public.attachment_brands (name, sort_order)
SELECT b.name, b.ord FROM (
  VALUES
    ('웅진',10),('웅비',20),('제트로',30),('죽암',40),('동양',50),
    ('명성',60),('국제',70),('아세아',80),('위캔글로벌',90),('기타',999)
) AS b(name, ord)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.attachment_brands (name, sort_order)
SELECT DISTINCT brand, 500 FROM public.attachment_catalog
WHERE brand IS NOT NULL AND brand <> ''
ON CONFLICT (name) DO NOTHING;
