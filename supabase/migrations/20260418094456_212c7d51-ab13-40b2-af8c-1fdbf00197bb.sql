ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS resigned_at date;

CREATE INDEX IF NOT EXISTS idx_employees_is_active ON public.employees(is_active);