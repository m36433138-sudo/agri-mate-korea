-- Backfill: unify sales_price per part_code using the most recent non-null value
WITH latest AS (
  SELECT DISTINCT ON (part_code) part_code, sales_price
  FROM public.inventory
  WHERE sales_price IS NOT NULL
  ORDER BY part_code, updated_at DESC
)
UPDATE public.inventory i
SET sales_price = l.sales_price
FROM latest l
WHERE i.part_code = l.part_code
  AND i.sales_price IS DISTINCT FROM l.sales_price;

-- Trigger: propagate sales_price across branches when it changes
CREATE OR REPLACE FUNCTION public.sync_inventory_sales_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sales_price IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.sales_price IS NOT DISTINCT FROM OLD.sales_price
     AND NEW.part_code IS NOT DISTINCT FROM OLD.part_code THEN
    RETURN NEW;
  END IF;

  UPDATE public.inventory
  SET sales_price = NEW.sales_price
  WHERE part_code = NEW.part_code
    AND id <> NEW.id
    AND (sales_price IS DISTINCT FROM NEW.sales_price);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inventory_sales_price ON public.inventory;
CREATE TRIGGER trg_sync_inventory_sales_price
AFTER INSERT OR UPDATE OF sales_price, part_code ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.sync_inventory_sales_price();