ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS ecu_mapped boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ecu_hp integer;