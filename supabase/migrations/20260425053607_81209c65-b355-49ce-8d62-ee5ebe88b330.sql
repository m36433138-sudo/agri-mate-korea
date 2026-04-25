ALTER TABLE public.operation_rows
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT '보통';

ALTER TABLE public.visit_repair_rows
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT '보통';

CREATE INDEX IF NOT EXISTS idx_operation_rows_priority ON public.operation_rows(priority);
CREATE INDEX IF NOT EXISTS idx_visit_repair_rows_priority ON public.visit_repair_rows(priority);