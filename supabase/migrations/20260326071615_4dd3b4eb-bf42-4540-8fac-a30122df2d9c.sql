ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS engine_number text,
  ADD COLUMN IF NOT EXISTS classification text;

COMMENT ON COLUMN public.machines.engine_number IS '엔진번호';
COMMENT ON COLUMN public.machines.classification IS '분류 (신규/중고 등)';