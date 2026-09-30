DROP POLICY IF EXISTS "authenticated manage vendor_items" ON public.vendor_items;
CREATE POLICY "Staff manage vendor_items"
ON public.vendor_items FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "authenticated manage vendor_purchases" ON public.vendor_purchases;
CREATE POLICY "Staff manage vendor_purchases"
ON public.vendor_purchases FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view brands" ON public.attachment_brands;
CREATE POLICY "Staff can view brands"
ON public.attachment_brands FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));