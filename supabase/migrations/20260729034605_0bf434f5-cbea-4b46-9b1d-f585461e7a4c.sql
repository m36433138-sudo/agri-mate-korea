CREATE TABLE public.vendor_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  part_code text,
  part_name text NOT NULL,
  purchase_price integer NOT NULL DEFAULT 0,
  sales_price integer,
  unit text,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_items TO authenticated;
GRANT ALL ON public.vendor_items TO service_role;
ALTER TABLE public.vendor_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage vendor_items" ON public.vendor_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.vendor_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  branch text NOT NULL DEFAULT '장흥',
  part_code text,
  part_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  purchase_price integer NOT NULL DEFAULT 0,
  sales_price integer,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_purchases TO authenticated;
GRANT ALL ON public.vendor_purchases TO service_role;
ALTER TABLE public.vendor_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage vendor_purchases" ON public.vendor_purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_vendor_items_vendor ON public.vendor_items(vendor_id);
CREATE INDEX idx_vendor_purchases_vendor ON public.vendor_purchases(vendor_id, purchase_date DESC);

CREATE TRIGGER trg_vendor_items_updated_at BEFORE UPDATE ON public.vendor_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_vendor_purchases_updated_at BEFORE UPDATE ON public.vendor_purchases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.apply_vendor_purchase_to_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
  _exists uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _code := COALESCE(NULLIF(TRIM(NEW.part_code), ''), NEW.part_name);
    SELECT id INTO _exists FROM public.inventory
      WHERE part_code = _code AND branch = NEW.branch LIMIT 1;
    IF _exists IS NULL THEN
      INSERT INTO public.inventory (branch, part_code, part_name, quantity, purchase_price, sales_price)
      VALUES (NEW.branch, _code, NEW.part_name, NEW.quantity, NEW.purchase_price, NEW.sales_price);
    ELSE
      UPDATE public.inventory
        SET quantity = COALESCE(quantity, 0) + NEW.quantity,
            purchase_price = COALESCE(NEW.purchase_price, purchase_price),
            sales_price = COALESCE(NEW.sales_price, sales_price)
        WHERE id = _exists;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    _code := COALESCE(NULLIF(TRIM(OLD.part_code), ''), OLD.part_name);
    UPDATE public.inventory
      SET quantity = COALESCE(quantity, 0) - OLD.quantity
      WHERE part_code = _code AND branch = OLD.branch;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_vendor_purchase_to_inventory() FROM public, anon;

CREATE TRIGGER trg_vendor_purchase_inventory
AFTER INSERT OR DELETE ON public.vendor_purchases
FOR EACH ROW EXECUTE FUNCTION public.apply_vendor_purchase_to_inventory();