CREATE TABLE public.insurance_estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_repair_id uuid NOT NULL REFERENCES public.insurance_repairs(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  item_type text NOT NULL DEFAULT '부품',
  part_code text,
  part_name text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price integer NOT NULL DEFAULT 0,
  diagram_id uuid REFERENCES public.diagrams(id) ON DELETE SET NULL,
  diagram_title text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT insurance_estimate_items_type_chk CHECK (item_type IN ('부품','공임','기타')),
  CONSTRAINT insurance_estimate_items_qty_chk CHECK (quantity > 0),
  CONSTRAINT insurance_estimate_items_price_chk CHECK (unit_price >= 0)
);

CREATE INDEX insurance_estimate_items_repair_idx ON public.insurance_estimate_items (insurance_repair_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_estimate_items TO authenticated;
GRANT ALL ON public.insurance_estimate_items TO service_role;

ALTER TABLE public.insurance_estimate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view insurance estimate items" ON public.insurance_estimate_items
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff can insert insurance estimate items" ON public.insurance_estimate_items
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff can update insurance estimate items" ON public.insurance_estimate_items
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff can delete insurance estimate items" ON public.insurance_estimate_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

CREATE TRIGGER insurance_estimate_items_updated_at
  BEFORE UPDATE ON public.insurance_estimate_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 견적 항목 전체를 한 번에 교체 (호출자 권한으로 실행되어 RLS가 그대로 적용됨)
CREATE OR REPLACE FUNCTION public.replace_insurance_estimate_items(_repair_id uuid, _items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF jsonb_typeof(_items) <> 'array' THEN
    RAISE EXCEPTION 'items must be an array';
  END IF;
  DELETE FROM public.insurance_estimate_items WHERE insurance_repair_id = _repair_id;
  INSERT INTO public.insurance_estimate_items
    (insurance_repair_id, sort_order, item_type, part_code, part_name, quantity, unit_price, diagram_id, diagram_title, notes)
  SELECT _repair_id,
         (e.ord - 1)::integer,
         COALESCE(NULLIF(e.item->>'item_type',''), '부품'),
         NULLIF(btrim(e.item->>'part_code'), ''),
         COALESCE(e.item->>'part_name', ''),
         COALESCE(NULLIF(e.item->>'quantity','')::numeric, 1),
         COALESCE(NULLIF(e.item->>'unit_price','')::numeric, 0)::integer,
         NULLIF(e.item->>'diagram_id','')::uuid,
         NULLIF(e.item->>'diagram_title',''),
         NULLIF(e.item->>'notes','')
  FROM jsonb_array_elements(_items) WITH ORDINALITY AS e(item, ord);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_insurance_estimate_items(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_insurance_estimate_items(uuid, jsonb) TO authenticated, service_role;