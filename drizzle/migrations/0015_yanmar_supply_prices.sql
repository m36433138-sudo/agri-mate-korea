CREATE TABLE public.yanmar_supply_prices (
  part_code text PRIMARY KEY,
  part_name text,
  supply_price integer NOT NULL,
  effective_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.yanmar_supply_prices TO authenticated;
GRANT ALL ON public.yanmar_supply_prices TO service_role;

ALTER TABLE public.yanmar_supply_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read yanmar supply prices"
ON public.yanmar_supply_prices FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Admins manage yanmar supply prices"
ON public.yanmar_supply_prices FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.yanmar_supply_prices IS 'Yanmar dealer supply prices (VAT excluded) by part code, with the price list effective date.';