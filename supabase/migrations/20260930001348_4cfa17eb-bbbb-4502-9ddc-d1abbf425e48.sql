-- 1) Revoke EXECUTE on internal (trigger / service-only) SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.deduct_inventory_on_repair_part() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adjust_inventory_for_repair_parts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_vendor_purchase_to_inventory() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_inventory_sales_price() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_chat_room() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_profile_authz_self_edit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_knowledge_chunks(vector, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, integer) TO service_role;

-- 2) machine_sales_history: staff only
DROP POLICY IF EXISTS "Authenticated users can view machine sales history" ON public.machine_sales_history;
DROP POLICY IF EXISTS "Authenticated users can insert machine sales history" ON public.machine_sales_history;

CREATE POLICY "Staff can view machine sales history"
ON public.machine_sales_history FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert machine sales history"
ON public.machine_sales_history FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

-- 3) attachment_catalog: staff only read
DROP POLICY IF EXISTS "Authenticated can view attachment catalog" ON public.attachment_catalog;

CREATE POLICY "Staff can view attachment catalog"
ON public.attachment_catalog FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));