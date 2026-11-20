CREATE TABLE public.part_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  branch text NOT NULL DEFAULT '장흥' CHECK (branch IN ('장흥','강진')),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  buyer_name text,
  buyer_phone text,
  subtotal bigint NOT NULL DEFAULT 0,
  discount bigint NOT NULL DEFAULT 0,
  total_amount bigint NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'paid' CHECK (payment_mode IN ('paid','unpaid','partial')),
  paid_amount bigint NOT NULL DEFAULT 0,
  payment_method text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.part_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.part_sales(id) ON DELETE CASCADE,
  branch text NOT NULL,
  part_code text NOT NULL,
  part_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price bigint NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX part_sales_date_idx ON public.part_sales (sale_date DESC, created_at DESC);
CREATE INDEX part_sales_customer_idx ON public.part_sales (customer_id);
CREATE INDEX part_sale_items_sale_idx ON public.part_sale_items (sale_id);
CREATE INDEX part_sale_items_code_idx ON public.part_sale_items (part_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_sales TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.part_sale_items TO authenticated;
GRANT ALL ON public.part_sales TO service_role;
GRANT ALL ON public.part_sale_items TO service_role;

ALTER TABLE public.part_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "part sales viewers read" ON public.part_sales FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_permission((SELECT auth.uid()), 'view_part_sales')));
CREATE POLICY "part sales managers insert" ON public.part_sales FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_permission((SELECT auth.uid()), 'manage_part_sales')));
CREATE POLICY "part sales managers update" ON public.part_sales FOR UPDATE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_permission((SELECT auth.uid()), 'manage_part_sales')))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_permission((SELECT auth.uid()), 'manage_part_sales')));
CREATE POLICY "part sales managers delete" ON public.part_sales FOR DELETE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_permission((SELECT auth.uid()), 'manage_part_sales')));

CREATE POLICY "part sale items viewers read" ON public.part_sale_items FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_permission((SELECT auth.uid()), 'view_part_sales')));
CREATE POLICY "part sale items managers insert" ON public.part_sale_items FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_permission((SELECT auth.uid()), 'manage_part_sales')));
CREATE POLICY "part sale items managers delete" ON public.part_sale_items FOR DELETE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_permission((SELECT auth.uid()), 'manage_part_sales')));

CREATE TRIGGER part_sales_updated_at BEFORE UPDATE ON public.part_sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 판매 부품 추가/삭제 시 해당 지점 재고 차감/복구 + 조정 기록
CREATE OR REPLACE FUNCTION public.apply_part_sale_item_to_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row public.part_sale_items;
  _delta integer;
  _new integer;
  _name text;
BEGIN
  IF TG_OP = 'INSERT' THEN _row := NEW; _delta := -NEW.quantity;
  ELSE _row := OLD; _delta := OLD.quantity; END IF;

  UPDATE public.inventory SET quantity = COALESCE(quantity, 0) + _delta
   WHERE part_code = _row.part_code AND branch = _row.branch
   RETURNING quantity, part_name INTO _new, _name;

  IF FOUND THEN
    INSERT INTO public.inventory_adjustments (branch, part_code, part_name, previous_qty, new_qty, adjustment_qty, reason)
    VALUES (_row.branch, _row.part_code, COALESCE(_name, _row.part_name), _new - _delta, _new, _delta,
            CASE WHEN TG_OP = 'INSERT' THEN '부품 판매' ELSE '부품 판매 취소' END);
  END IF;

  IF TG_OP = 'INSERT' THEN RETURN NEW; ELSE RETURN OLD; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_part_sale_item_to_inventory() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER part_sale_items_inventory
  AFTER INSERT OR DELETE ON public.part_sale_items
  FOR EACH ROW EXECUTE FUNCTION public.apply_part_sale_item_to_inventory();

-- 판매·부품·미수금을 한 번에 저장 (RLS 적용)
CREATE OR REPLACE FUNCTION public.create_part_sale(_sale jsonb, _items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _id uuid;
  _branch text := COALESCE(NULLIF(_sale->>'branch',''), '장흥');
  _date date := COALESCE(NULLIF(_sale->>'sale_date','')::date, CURRENT_DATE);
  _customer uuid := NULLIF(_sale->>'customer_id','')::uuid;
  _mode text := COALESCE(NULLIF(_sale->>'payment_mode',''), 'paid');
  _discount bigint := GREATEST(0, COALESCE(NULLIF(_sale->>'discount','')::bigint, 0));
  _subtotal bigint;
  _total bigint;
  _paid bigint;
  _fin uuid;
  _label text;
BEGIN
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION '판매할 부품을 한 개 이상 넣어주세요';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_items) i
             WHERE COALESCE(NULLIF(trim(i->>'part_code'),''), '') = ''
                OR COALESCE((i->>'quantity')::int, 0) <= 0
                OR COALESCE((i->>'unit_price')::bigint, -1) < 0) THEN
    RAISE EXCEPTION '부품번호·수량·단가를 확인해주세요';
  END IF;

  SELECT COALESCE(sum((i->>'quantity')::bigint * (i->>'unit_price')::bigint), 0)
    INTO _subtotal FROM jsonb_array_elements(_items) i;
  IF _discount > _subtotal THEN RAISE EXCEPTION '할인이 합계보다 클 수 없어요'; END IF;
  _total := _subtotal - _discount;

  IF _mode NOT IN ('paid','unpaid','partial') THEN RAISE EXCEPTION '결제 방식이 올바르지 않아요'; END IF;
  IF _mode IN ('unpaid','partial') AND _customer IS NULL THEN
    RAISE EXCEPTION '외상·일부 입금은 등록된 고객을 골라야 해요';
  END IF;
  _paid := CASE _mode WHEN 'paid' THEN _total WHEN 'unpaid' THEN 0
           ELSE GREATEST(0, COALESCE(NULLIF(_sale->>'paid_amount','')::bigint, 0)) END;
  IF _mode = 'partial' AND (_paid <= 0 OR _paid >= _total) THEN
    RAISE EXCEPTION '일부 입금액은 0원보다 크고 합계보다 작아야 해요';
  END IF;

  INSERT INTO public.part_sales (sale_date, branch, customer_id, buyer_name, buyer_phone, subtotal, discount,
                                 total_amount, payment_mode, paid_amount, payment_method, notes, created_by)
  VALUES (_date, _branch, _customer, NULLIF(trim(_sale->>'buyer_name'),''), NULLIF(trim(_sale->>'buyer_phone'),''),
          _subtotal, _discount, _total, _mode, _paid, NULLIF(_sale->>'payment_method',''), NULLIF(_sale->>'notes',''), auth.uid())
  RETURNING id INTO _id;

  INSERT INTO public.part_sale_items (sale_id, branch, part_code, part_name, quantity, unit_price)
  SELECT _id, _branch, trim(i->>'part_code'), COALESCE(i->>'part_name',''), (i->>'quantity')::int, (i->>'unit_price')::bigint
    FROM jsonb_array_elements(_items) i;

  IF _mode <> 'paid' AND _total > 0 THEN
    SELECT string_agg(COALESCE(NULLIF(i->>'part_name',''), i->>'part_code'), ', ')
      INTO _label FROM (SELECT * FROM jsonb_array_elements(_items) LIMIT 3) s(i);
    INSERT INTO public.finance_records (created_by, record_type, customer_id, source_type, source_id, amount, paid_amount,
                                        is_paid, due_date, paid_date, notes)
    VALUES (auth.uid(), 'receivable', _customer, 'parts', _id, _total, _paid, false, _date + 30,
            CASE WHEN _paid > 0 THEN _date END,
            left('부품 판매 · ' || _branch || ' · ' || COALESCE(_label, '') ||
                 CASE WHEN jsonb_array_length(_items) > 3 THEN ' 외 ' || (jsonb_array_length(_items) - 3) || '건' ELSE '' END, 200))
    RETURNING id INTO _fin;
    IF _paid > 0 THEN
      INSERT INTO public.finance_payments (finance_id, amount, paid_date, method, notes, created_by)
      VALUES (_fin, _paid, _date, NULLIF(_sale->>'payment_method',''), '부품 판매 시 일부 입금', auth.uid());
    END IF;
  END IF;

  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_part_sale(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_part_sale(jsonb, jsonb) TO authenticated;

-- 판매 취소: 미수금·입금 기록 삭제 후 판매 삭제 (재고는 트리거로 복구)
CREATE OR REPLACE FUNCTION public.delete_part_sale(_sale_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  DELETE FROM public.finance_payments WHERE finance_id IN
    (SELECT id FROM public.finance_records WHERE source_type = 'parts' AND source_id = _sale_id);
  DELETE FROM public.finance_records WHERE source_type = 'parts' AND source_id = _sale_id;
  DELETE FROM public.part_sales WHERE id = _sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION '판매 기록을 찾을 수 없거나 삭제 권한이 없어요'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_part_sale(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_part_sale(uuid) TO authenticated;