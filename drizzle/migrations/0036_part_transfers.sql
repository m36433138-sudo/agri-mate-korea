-- 창고 이동: 장흥 ↔ 강진 창고 사이에 부품을 옮긴다. 보내는 창고 재고를 빼고 받는 창고 재고를 더하는 일을
-- transfer_parts 한 번(한 트랜잭션)으로 하고, 이동 기록과 양쪽 inventory_adjustments 로그를 남긴다.
CREATE TABLE IF NOT EXISTS public.part_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_branch text NOT NULL,
  to_branch text NOT NULL CHECK (to_branch <> from_branch),
  memo text,
  moved_by uuid DEFAULT auth.uid(),
  moved_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS part_transfers_created_idx ON public.part_transfers (created_at DESC);

CREATE TABLE IF NOT EXISTS public.part_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.part_transfers(id) ON DELETE CASCADE,
  part_code text NOT NULL,
  part_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL CHECK (quantity > 0),
  from_qty_after integer,
  to_qty_after integer,
  to_location text
);
CREATE INDEX IF NOT EXISTS part_transfer_items_transfer_idx ON public.part_transfer_items (transfer_id);
CREATE INDEX IF NOT EXISTS part_transfer_items_code_idx ON public.part_transfer_items (part_code);

GRANT SELECT ON public.part_transfers, public.part_transfer_items TO authenticated;
GRANT ALL ON public.part_transfers, public.part_transfer_items TO service_role;
ALTER TABLE public.part_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_transfer_items ENABLE ROW LEVEL SECURITY;

-- 기록은 직원이 읽고, 남기는 건 transfer_parts(INVOKER) 안에서만 한다 (고치기·지우기 정책 없음 → 이력은 바뀌지 않는다)
CREATE POLICY "Staff read part transfers" ON public.part_transfers FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)));
CREATE POLICY "Staff add part transfers" ON public.part_transfers FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)));
CREATE POLICY "Staff read part transfer items" ON public.part_transfer_items FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)));
CREATE POLICY "Staff add part transfer items" ON public.part_transfer_items FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)));
GRANT INSERT ON public.part_transfers, public.part_transfer_items TO authenticated;

-- _items: [{part_code, quantity, to_location?}]. 보내는 창고에 그만큼 없으면 전체를 되돌린다.
CREATE OR REPLACE FUNCTION public.transfer_parts(_from text, _to text, _items jsonb, _memo text DEFAULT NULL, _by_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _tid uuid;
  _it jsonb;
  _code text;
  _qty int;
  _loc text;
  _src public.inventory%ROWTYPE;
  _dst public.inventory%ROWTYPE;
  _dst_new int;
BEGIN
  IF _from IS NULL OR _to IS NULL OR _from = _to THEN
    RAISE EXCEPTION '보내는 창고와 받는 창고가 달라야 해요';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION '옮길 부품이 없어요';
  END IF;

  INSERT INTO public.part_transfers (from_branch, to_branch, memo, moved_by_name)
  VALUES (_from, _to, NULLIF(btrim(_memo), ''), NULLIF(btrim(_by_name), ''))
  RETURNING id INTO _tid;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _code := btrim(_it->>'part_code');
    _qty := (_it->>'quantity')::int;
    _loc := NULLIF(btrim(coalesce(_it->>'to_location', '')), '');
    IF _code IS NULL OR _code = '' OR _qty IS NULL OR _qty <= 0 THEN
      RAISE EXCEPTION '부품번호와 수량(1개 이상)을 확인해 주세요';
    END IF;

    SELECT * INTO _src FROM public.inventory WHERE branch = _from AND part_code = _code FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '% 창고에 % 재고가 없어요', _from, _code;
    END IF;
    IF coalesce(_src.quantity, 0) < _qty THEN
      RAISE EXCEPTION '% 창고 % 재고가 %개뿐이에요 (옮기려는 수량 %개)', _from, _code, coalesce(_src.quantity, 0), _qty;
    END IF;

    UPDATE public.inventory SET quantity = coalesce(quantity, 0) - _qty WHERE id = _src.id;

    SELECT * INTO _dst FROM public.inventory WHERE branch = _to AND part_code = _code FOR UPDATE;
    IF FOUND THEN
      _dst_new := coalesce(_dst.quantity, 0) + _qty;
      UPDATE public.inventory
         SET quantity = _dst_new,
             location_main = CASE WHEN _loc IS NOT NULL THEN _loc ELSE location_main END,
             location_sub = CASE WHEN _loc IS NOT NULL THEN NULL ELSE location_sub END
       WHERE id = _dst.id;
    ELSE
      _dst_new := _qty;
      INSERT INTO public.inventory (branch, part_code, alt_part_code, part_name, part_name_en, quantity, purchase_price, sales_price, location_main, min_stock)
      VALUES (_to, _src.part_code, _src.alt_part_code, _src.part_name, _src.part_name_en, _qty, _src.purchase_price, _src.sales_price, _loc, 1);
    END IF;

    INSERT INTO public.inventory_adjustments (branch, part_code, part_name, previous_qty, new_qty, adjustment_qty, reason, adjusted_by)
    VALUES (_from, _code, _src.part_name, coalesce(_src.quantity, 0), coalesce(_src.quantity, 0) - _qty, -_qty, '창고 이동 → ' || _to, _by_name),
           (_to, _code, _src.part_name, _dst_new - _qty, _dst_new, _qty, '창고 이동 ← ' || _from, _by_name);

    INSERT INTO public.part_transfer_items (transfer_id, part_code, part_name, quantity, from_qty_after, to_qty_after, to_location)
    VALUES (_tid, _code, _src.part_name, _qty, coalesce(_src.quantity, 0) - _qty, _dst_new, _loc);
  END LOOP;

  RETURN _tid;
END;
$$;
REVOKE ALL ON FUNCTION public.transfer_parts(text, text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_parts(text, text, jsonb, text, text) TO authenticated, service_role;
