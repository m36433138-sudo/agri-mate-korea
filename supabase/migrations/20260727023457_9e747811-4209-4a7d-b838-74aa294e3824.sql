-- Trigger function that stamps the current auth user on insert/update
CREATE OR REPLACE FUNCTION public.set_last_modifier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Tables to track
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'customers',
    'machines',
    'repairs',
    'repair_parts',
    'inventory',
    'parts',
    'machine_attachments',
    'attachment_catalog',
    'quotes',
    'employees',
    'user_roles',
    'visit_repair_rows',
    'operation_rows'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    -- Add updated_by column if missing
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL', t);
    -- Add updated_at if missing
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()', t);
    -- Drop existing trigger to keep migration idempotent
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_last_modifier ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_last_modifier BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_last_modifier()',
      t
    );
  END LOOP;
END $$;