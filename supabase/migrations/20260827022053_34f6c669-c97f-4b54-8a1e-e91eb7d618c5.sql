DROP POLICY IF EXISTS quotes_staff_read ON public.quotes;
DROP POLICY IF EXISTS quotes_staff_insert ON public.quotes;
DROP POLICY IF EXISTS quotes_staff_update ON public.quotes;
DROP POLICY IF EXISTS quotes_admin_delete ON public.quotes;

CREATE POLICY quotes_select ON public.quotes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  );

CREATE POLICY quotes_insert ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'employee'::app_role) AND created_by = auth.uid())
  );

CREATE POLICY quotes_update ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  );

CREATE POLICY quotes_delete ON public.quotes
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  );