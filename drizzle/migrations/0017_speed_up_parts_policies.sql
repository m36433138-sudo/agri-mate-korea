DROP POLICY IF EXISTS "Admin/employee access inventory" ON public.inventory;
CREATE POLICY "Admin/employee access inventory" ON public.inventory
  FOR ALL TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)));

DROP POLICY IF EXISTS "Staff can read yanmar supply prices" ON public.yanmar_supply_prices;
CREATE POLICY "Staff can read yanmar supply prices" ON public.yanmar_supply_prices
  FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'::public.app_role)));

DROP POLICY IF EXISTS "Admins manage yanmar supply prices" ON public.yanmar_supply_prices;
CREATE POLICY "Admins manage yanmar supply prices" ON public.yanmar_supply_prices
  FOR ALL TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));