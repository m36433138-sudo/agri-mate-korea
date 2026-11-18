ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS part_name_en varchar;
COMMENT ON COLUMN public.inventory.part_name_en IS 'English part name (part_name holds the Korean name)';
CREATE INDEX IF NOT EXISTS inventory_part_code_idx ON public.inventory (part_code);