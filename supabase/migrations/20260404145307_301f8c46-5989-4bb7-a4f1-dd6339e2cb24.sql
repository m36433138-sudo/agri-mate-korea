
-- customers 테이블에 마이그레이션 필수 컬럼 추가
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS legacy_code text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS branch text;

-- repair_history 테이블에 마이그레이션 필수 컬럼 추가
ALTER TABLE public.repair_history ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE public.repair_history ADD COLUMN IF NOT EXISTS cost_labor integer DEFAULT 0;
ALTER TABLE public.repair_history ADD COLUMN IF NOT EXISTS cost_parts integer DEFAULT 0;
ALTER TABLE public.repair_history ADD COLUMN IF NOT EXISTS repair_type text;
