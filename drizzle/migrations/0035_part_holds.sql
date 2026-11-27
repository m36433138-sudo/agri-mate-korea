-- 빼놓은 부품: 바로 쓰려고 창고에서 빼놓은 물품을 누구(고객·담당) 것인지, 어디에 뒀는지(사진·메모)와 함께 기록한다.
-- 재고 수량은 바꾸지 않는다 (실제 차감은 수리 등록·부품 판매가 한다). 다 쓰면 「사용함」, 도로 넣으면 「다시 넣음」으로 닫는다.
CREATE TABLE IF NOT EXISTS public.part_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch text NOT NULL,
  purpose text NOT NULL DEFAULT '',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  assignee text,
  spot text,
  photo_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'used', 'returned')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid
);
CREATE INDEX IF NOT EXISTS part_holds_status_idx ON public.part_holds (status, branch, created_at DESC);
CREATE INDEX IF NOT EXISTS part_holds_customer_idx ON public.part_holds (customer_id);

CREATE TABLE IF NOT EXISTS public.part_hold_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id uuid NOT NULL REFERENCES public.part_holds(id) ON DELETE CASCADE,
  part_code text NOT NULL,
  part_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS part_hold_items_hold_idx ON public.part_hold_items (hold_id);
CREATE INDEX IF NOT EXISTS part_hold_items_code_idx ON public.part_hold_items (part_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_holds, public.part_hold_items TO authenticated;
GRANT ALL ON public.part_holds, public.part_hold_items TO service_role;
ALTER TABLE public.part_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_hold_items ENABLE ROW LEVEL SECURITY;

-- 재고와 같은 범위: 관리자·직원은 보고 만들고 닫는다. 지우기는 만든 사람이나 관리자만.
CREATE POLICY "Staff read part holds" ON public.part_holds FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)));
CREATE POLICY "Staff add part holds" ON public.part_holds FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)));
CREATE POLICY "Staff update part holds" ON public.part_holds FOR UPDATE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)));
CREATE POLICY "Creator or admin delete part holds" ON public.part_holds FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

CREATE POLICY "Staff read part hold items" ON public.part_hold_items FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)));
CREATE POLICY "Staff write part hold items" ON public.part_hold_items FOR ALL TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)));
