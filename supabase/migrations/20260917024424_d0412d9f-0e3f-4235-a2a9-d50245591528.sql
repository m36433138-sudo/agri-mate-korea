CREATE TABLE public.part_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  branch text NOT NULL DEFAULT '장흥',
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  requester text,
  status text NOT NULL DEFAULT '주문접수',
  shipped_at date,
  delivered_at date,
  handed_over_at date,
  notes text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.part_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.part_orders(id) ON DELETE CASCADE,
  part_code text,
  part_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_orders TO authenticated;
GRANT ALL ON public.part_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_order_items TO authenticated;
GRANT ALL ON public.part_order_items TO service_role;

ALTER TABLE public.part_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_part_orders" ON public.part_orders
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff_manage_part_order_items" ON public.part_order_items
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX idx_part_orders_status ON public.part_orders(status);
CREATE INDEX idx_part_orders_customer ON public.part_orders(customer_id);
CREATE INDEX idx_part_order_items_order ON public.part_order_items(order_id);

CREATE TRIGGER trg_part_orders_updated_at BEFORE UPDATE ON public.part_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_part_order_items_updated_at BEFORE UPDATE ON public.part_order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_part_orders_modifier BEFORE INSERT OR UPDATE ON public.part_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_last_modifier();

CREATE OR REPLACE FUNCTION public.part_orders_stamp_status_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = '배송중' AND NEW.shipped_at IS NULL THEN
    NEW.shipped_at := CURRENT_DATE;
  ELSIF NEW.status = '배송완료' THEN
    IF NEW.shipped_at IS NULL THEN NEW.shipped_at := CURRENT_DATE; END IF;
    IF NEW.delivered_at IS NULL THEN NEW.delivered_at := CURRENT_DATE; END IF;
  ELSIF NEW.status = '전달완료' THEN
    IF NEW.delivered_at IS NULL THEN NEW.delivered_at := CURRENT_DATE; END IF;
    IF NEW.handed_over_at IS NULL THEN NEW.handed_over_at := CURRENT_DATE; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_part_orders_status_dates BEFORE INSERT OR UPDATE ON public.part_orders
  FOR EACH ROW EXECUTE FUNCTION public.part_orders_stamp_status_dates();