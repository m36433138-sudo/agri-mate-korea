-- 타사(LS·TYM·대동·구보다 등) 도면을 얀마와 구분해 보여주기 위한 제조사
ALTER TABLE public.diagrams ADD COLUMN IF NOT EXISTS manufacturer text NOT NULL DEFAULT '얀마';
CREATE INDEX IF NOT EXISTS diagrams_manufacturer_idx ON public.diagrams (manufacturer);