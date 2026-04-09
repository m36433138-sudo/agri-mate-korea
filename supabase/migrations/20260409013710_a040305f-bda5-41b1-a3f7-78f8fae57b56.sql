
CREATE TABLE IF NOT EXISTS public.assets_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT '기타',
  serial_number text,
  purchase_date date,
  purchase_price integer,
  vendor text,
  status text NOT NULL DEFAULT '사용중',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assets_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plate_number text,
  purchase_date date,
  purchase_price integer,
  current_mileage integer,
  status text NOT NULL DEFAULT '사용중',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assets_vehicle_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.assets_vehicles(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL,
  date date NOT NULL,
  mileage integer,
  cost integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assets_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  property_type text NOT NULL DEFAULT '토지',
  address text,
  area numeric,
  area_unit text NOT NULL DEFAULT '평',
  purchase_date date,
  purchase_price integer,
  latitude numeric,
  longitude numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assets_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets_vehicle_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/employee access assets_equipment" ON public.assets_equipment FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));

CREATE POLICY "Admin/employee access assets_vehicles" ON public.assets_vehicles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));

CREATE POLICY "Admin/employee access assets_vehicle_maintenance" ON public.assets_vehicle_maintenance FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));

CREATE POLICY "Admin/employee access assets_properties" ON public.assets_properties FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));
