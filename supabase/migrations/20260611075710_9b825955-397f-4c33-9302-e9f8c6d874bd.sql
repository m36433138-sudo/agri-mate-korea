ALTER TABLE public.repairs ADD COLUMN IF NOT EXISTS accounting_posted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.repair_logs ADD COLUMN IF NOT EXISTS accounting_posted BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.repairs.accounting_posted IS '전산 기표 여부';
COMMENT ON COLUMN public.repair_logs.accounting_posted IS '전산 기표 여부';