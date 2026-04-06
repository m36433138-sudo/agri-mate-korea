-- 고객 등급 컬럼
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS grade text;

-- 기계 ECU 맵핑/업그레이드 컬럼
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS ecu_mapped boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ecu_hp integer;
