-- Branch matching must use the user's branch, not their department/team.
CREATE OR REPLACE FUNCTION public.current_employee_branch(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.branch
  FROM public.profiles p
  WHERE p.id = _user_id
  LIMIT 1
$$;

-- Employees should not see every colleague's HR-sensitive fields.
DROP POLICY IF EXISTS "Employee can view employees" ON public.employees;

CREATE POLICY "Employees view own employee record"
ON public.employees
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'employee'::app_role)
    AND user_id = auth.uid()
  )
);

-- Correct customer-owned machine visibility through customers.user_id.
DROP POLICY IF EXISTS "Admin/employee access machines" ON public.machines;

CREATE POLICY "Admins full machine access"
ON public.machines
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees view machines with permission"
ON public.machines
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND public.has_permission(auth.uid(), 'view_machines')
);

CREATE POLICY "Employees manage machines with permission"
ON public.machines
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND public.has_permission(auth.uid(), 'add_machines')
);

CREATE POLICY "Employees update machines with permission"
ON public.machines
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND public.has_permission(auth.uid(), 'add_machines')
)
WITH CHECK (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND public.has_permission(auth.uid(), 'add_machines')
);

CREATE POLICY "Customers view own machines"
ON public.machines
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer'::app_role)
  AND customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);

-- Correct customer-owned repair visibility through customers.user_id.
DROP POLICY IF EXISTS "Admin/employee access repairs" ON public.repairs;

CREATE POLICY "Admins full repairs access"
ON public.repairs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees manage repairs with permission"
ON public.repairs
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND public.has_permission(auth.uid(), 'manage_repairs')
)
WITH CHECK (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND public.has_permission(auth.uid(), 'manage_repairs')
);

CREATE POLICY "Customers view own repairs"
ON public.repairs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer'::app_role)
  AND machine_id IN (
    SELECT m.id
    FROM public.machines m
    JOIN public.customers c ON c.id = m.customer_id
    WHERE c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admin/employee access repair_parts" ON public.repair_parts;

CREATE POLICY "Admins full repair_parts access"
ON public.repair_parts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees manage repair_parts with permission"
ON public.repair_parts
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND public.has_permission(auth.uid(), 'manage_repairs')
)
WITH CHECK (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND public.has_permission(auth.uid(), 'manage_repairs')
);

CREATE POLICY "Customers view own repair_parts"
ON public.repair_parts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer'::app_role)
  AND repair_id IN (
    SELECT r.id
    FROM public.repairs r
    JOIN public.machines m ON m.id = r.machine_id
    JOIN public.customers c ON c.id = m.customer_id
    WHERE c.user_id = auth.uid()
  )
);

-- Limit realtime channel authorization: admins can subscribe broadly; employees only to less-sensitive internal feeds.
DROP POLICY IF EXISTS "Admin/employee realtime access" ON realtime.messages;

CREATE POLICY "Admin scoped realtime access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employee limited realtime access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND realtime.topic() NOT ILIKE '%customers%'
  AND realtime.topic() NOT ILIKE '%attendance_records%'
  AND realtime.topic() NOT ILIKE '%technician_locations%'
);