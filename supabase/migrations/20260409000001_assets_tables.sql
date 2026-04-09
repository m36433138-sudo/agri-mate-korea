-- ── 전자/디지털 장비 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assets_equipment (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  category        text        NOT NULL DEFAULT '기타',        -- 노트북 / 디지털장비 / 기타
  serial_number   text,
  purchase_date   date,
  purchase_price  integer,
  vendor          text,
  status          text        NOT NULL DEFAULT '사용중',      -- 사용중 / 보관 / 폐기
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 차량 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assets_vehicles (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  plate_number    text,
  purchase_date   date,
  purchase_price  integer,
  current_mileage integer,
  status          text        NOT NULL DEFAULT '사용중',      -- 사용중 / 매각 / 폐차
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 차량 정비 이력 ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assets_vehicle_maintenance (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       uuid        NOT NULL REFERENCES public.assets_vehicles(id) ON DELETE CASCADE,
  maintenance_type text        NOT NULL,  -- 엔진오일교환 / 타이어교환 / 수리 / 정기점검 / 기타
  date             date        NOT NULL,
  mileage          integer,
  cost             integer,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── 토지 및 부동산 ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assets_properties (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  property_type   text        NOT NULL DEFAULT '토지',        -- 토지 / 건물 / 창고 / 기타
  address         text,
  area            numeric,                                     -- 면적(㎡ 또는 평)
  area_unit       text        NOT NULL DEFAULT '평',
  purchase_date   date,
  purchase_price  integer,
  latitude        numeric,
  longitude       numeric,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.assets_equipment         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets_vehicles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets_vehicle_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets_properties        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_equipment_auth"          ON public.assets_equipment         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "assets_vehicles_auth"           ON public.assets_vehicles          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "assets_vehicle_maint_auth"      ON public.assets_vehicle_maintenance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "assets_properties_auth"         ON public.assets_properties        FOR ALL TO authenticated USING (true) WITH CHECK (true);
