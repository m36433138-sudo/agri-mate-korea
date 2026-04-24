DROP POLICY IF EXISTS "Customers view own customer record" ON public.customers;
CREATE POLICY "Customers view own customer record"
ON public.customers
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer'::app_role)
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS "Employees view own permissions" ON public.employee_permissions;
CREATE POLICY "Employees view own permissions"
ON public.employee_permissions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Customers no internal realtime access" ON realtime.messages;
CREATE POLICY "Customers no internal realtime access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer'::app_role)
  AND false
);