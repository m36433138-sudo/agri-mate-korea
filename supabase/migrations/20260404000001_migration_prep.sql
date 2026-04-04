-- 마이그레이션 준비: repair_history 스키마 개선
-- 1. machine_id nullable (제조번호 없는 수리기록 지원)
-- 2. customer_id 추가 (고객 직접 연결)
-- 3. cost_labor, cost_parts 분리 컬럼 추가 (구 시스템 데이터 호환)
-- 4. customers에 legacy_code 추가 (중복 매핑용)

ALTER TABLE public.repair_history
  ALTER COLUMN machine_id DROP NOT NULL;

ALTER TABLE public.repair_history
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS cost_labor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_parts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repair_type text;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS branch text,
  ADD COLUMN IF NOT EXISTS legacy_code text;

CREATE INDEX IF NOT EXISTS idx_repair_history_customer_id ON public.repair_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_legacy_code ON public.customers(legacy_code);
