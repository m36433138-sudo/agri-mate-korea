ALTER TABLE public.repair_parts ADD COLUMN IF NOT EXISTS is_imported boolean NOT NULL DEFAULT false;

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
    IF COALESCE(NEW.is_imported, false) THEN
      RETURN NEW;
    END IF;
    SELECT part_number INTO _new_code FROM public.parts WHERE id = NEW.part_id;
    IF _new_code IS NOT NULL AND NEW.branch IS NOT NULL THEN
      UPDATE public.inventory
        SET quantity = quantity - NEW.quantity
        WHERE part_code = _new_code AND branch = NEW.branch;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.is_imported, false) THEN
      RETURN OLD;
    END IF;
    SELECT part_number INTO _old_code FROM public.parts WHERE id = OLD.part_id;
    IF _old_code IS NOT NULL AND OLD.branch IS NOT NULL THEN
      UPDATE public.inventory
        SET quantity = quantity + OLD.quantity
        WHERE part_code = _old_code AND branch = OLD.branch;
    END IF;
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT COALESCE(OLD.is_imported, false) THEN
      SELECT part_number INTO _old_code FROM public.parts WHERE id = OLD.part_id;
      IF _old_code IS NOT NULL AND OLD.branch IS NOT NULL THEN
        UPDATE public.inventory
          SET quantity = quantity + OLD.quantity
          WHERE part_code = _old_code AND branch = OLD.branch;
      END IF;
    END IF;
    IF NOT COALESCE(NEW.is_imported, false) THEN
      SELECT part_number INTO _new_code FROM public.parts WHERE id = NEW.part_id;
      IF _new_code IS NOT NULL AND NEW.branch IS NOT NULL THEN
        UPDATE public.inventory
          SET quantity = quantity - NEW.quantity
          WHERE part_code = _new_code AND branch = NEW.branch;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;