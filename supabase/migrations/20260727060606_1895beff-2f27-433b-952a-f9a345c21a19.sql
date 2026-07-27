
ALTER TABLE public.repair_parts
  ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT '장흥';

CREATE OR REPLACE FUNCTION public.adjust_inventory_for_repair_parts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old_code text;
  _new_code text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT part_number INTO _new_code FROM public.parts WHERE id = NEW.part_id;
    IF _new_code IS NOT NULL AND NEW.branch IS NOT NULL THEN
      UPDATE public.inventory
        SET quantity = quantity - NEW.quantity
        WHERE part_code = _new_code AND branch = NEW.branch;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT part_number INTO _old_code FROM public.parts WHERE id = OLD.part_id;
    IF _old_code IS NOT NULL AND OLD.branch IS NOT NULL THEN
      UPDATE public.inventory
        SET quantity = quantity + OLD.quantity
        WHERE part_code = _old_code AND branch = OLD.branch;
    END IF;
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    SELECT part_number INTO _old_code FROM public.parts WHERE id = OLD.part_id;
    SELECT part_number INTO _new_code FROM public.parts WHERE id = NEW.part_id;
    IF _old_code IS NOT NULL AND OLD.branch IS NOT NULL THEN
      UPDATE public.inventory
        SET quantity = quantity + OLD.quantity
        WHERE part_code = _old_code AND branch = OLD.branch;
    END IF;
    IF _new_code IS NOT NULL AND NEW.branch IS NOT NULL THEN
      UPDATE public.inventory
        SET quantity = quantity - NEW.quantity
        WHERE part_code = _new_code AND branch = NEW.branch;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adjust_inventory_for_repair_parts() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_repair_parts_adjust_inventory ON public.repair_parts;
CREATE TRIGGER trg_repair_parts_adjust_inventory
AFTER INSERT OR UPDATE OR DELETE ON public.repair_parts
FOR EACH ROW EXECUTE FUNCTION public.adjust_inventory_for_repair_parts();
