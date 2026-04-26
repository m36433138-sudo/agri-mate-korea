-- ============================================================
-- machines: search_vec + 인덱스
-- ============================================================
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS search_vec tsvector;

CREATE OR REPLACE FUNCTION public.machines_search_vec_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vec :=
    to_tsvector('simple',
      coalesce(NEW.model_name, '') || ' ' ||
      coalesce(NEW.serial_number, '') || ' ' ||
      coalesce(NEW.engine_number, '') || ' ' ||
      coalesce(NEW.manufacturer, '') || ' ' ||
      coalesce(NEW.salesperson, '') || ' ' ||
      coalesce(NEW.notes, '')
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_machines_search_vec ON public.machines;
CREATE TRIGGER trg_machines_search_vec
BEFORE INSERT OR UPDATE ON public.machines
FOR EACH ROW EXECUTE FUNCTION public.machines_search_vec_update();

UPDATE public.machines
SET search_vec = to_tsvector('simple',
  coalesce(model_name, '') || ' ' ||
  coalesce(serial_number, '') || ' ' ||
  coalesce(engine_number, '') || ' ' ||
  coalesce(manufacturer, '') || ' ' ||
  coalesce(salesperson, '') || ' ' ||
  coalesce(notes, '')
)
WHERE search_vec IS NULL;

CREATE INDEX IF NOT EXISTS idx_machines_search_vec ON public.machines USING GIN (search_vec);
CREATE INDEX IF NOT EXISTS idx_machines_status ON public.machines (status);
CREATE INDEX IF NOT EXISTS idx_machines_machine_type ON public.machines (machine_type);
CREATE INDEX IF NOT EXISTS idx_machines_manufacturer ON public.machines (manufacturer);
CREATE INDEX IF NOT EXISTS idx_machines_entry_date_desc ON public.machines (entry_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_machines_sale_date_desc ON public.machines (sale_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_machines_created_at_desc ON public.machines (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_machines_customer_id ON public.machines (customer_id);
CREATE INDEX IF NOT EXISTS idx_machines_model_name_trgm ON public.machines (model_name);
CREATE INDEX IF NOT EXISTS idx_machines_serial_number_trgm ON public.machines (serial_number);

-- ============================================================
-- customers: search_vec + 인덱스
-- ============================================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS search_vec tsvector;

CREATE OR REPLACE FUNCTION public.customers_search_vec_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vec :=
    to_tsvector('simple',
      coalesce(NEW.name, '') || ' ' ||
      coalesce(NEW.phone, '') || ' ' ||
      coalesce(NEW.address, '') || ' ' ||
      coalesce(NEW.notes, '') || ' ' ||
      coalesce(NEW.legacy_code, '')
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_search_vec ON public.customers;
CREATE TRIGGER trg_customers_search_vec
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.customers_search_vec_update();

UPDATE public.customers
SET search_vec = to_tsvector('simple',
  coalesce(name, '') || ' ' ||
  coalesce(phone, '') || ' ' ||
  coalesce(address, '') || ' ' ||
  coalesce(notes, '') || ' ' ||
  coalesce(legacy_code, '')
)
WHERE search_vec IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_search_vec ON public.customers USING GIN (search_vec);
CREATE INDEX IF NOT EXISTS idx_customers_grade ON public.customers (grade);
CREATE INDEX IF NOT EXISTS idx_customers_branch ON public.customers (branch);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_created_at_desc ON public.customers (created_at DESC);

-- ============================================================
-- repairs: search_vec + 인덱스
-- ============================================================
ALTER TABLE public.repairs
  ADD COLUMN IF NOT EXISTS search_vec tsvector;

CREATE OR REPLACE FUNCTION public.repairs_search_vec_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vec :=
    to_tsvector('simple',
      coalesce(NEW.repair_content, '') || ' ' ||
      coalesce(NEW.technician, '') || ' ' ||
      coalesce(NEW.notes, '')
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_repairs_search_vec ON public.repairs;
CREATE TRIGGER trg_repairs_search_vec
BEFORE INSERT OR UPDATE ON public.repairs
FOR EACH ROW EXECUTE FUNCTION public.repairs_search_vec_update();

UPDATE public.repairs
SET search_vec = to_tsvector('simple',
  coalesce(repair_content, '') || ' ' ||
  coalesce(technician, '') || ' ' ||
  coalesce(notes, '')
)
WHERE search_vec IS NULL;

CREATE INDEX IF NOT EXISTS idx_repairs_search_vec ON public.repairs USING GIN (search_vec);
CREATE INDEX IF NOT EXISTS idx_repairs_repair_date_desc ON public.repairs (repair_date DESC);
CREATE INDEX IF NOT EXISTS idx_repairs_technician ON public.repairs (technician);
CREATE INDEX IF NOT EXISTS idx_repairs_machine_id ON public.repairs (machine_id);
CREATE INDEX IF NOT EXISTS idx_repairs_created_at_desc ON public.repairs (created_at DESC);