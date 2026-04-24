-- Remove older broad employee access policy if it still exists.
DROP POLICY IF EXISTS "Admin/employee access employees" ON public.employees;
DROP POLICY IF EXISTS "Employees view own employee record" ON public.employees;

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

-- Prevent self-service profile edits from changing branch/team-based authorization attributes.
CREATE OR REPLACE FUNCTION public.prevent_profile_authz_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() = OLD.id AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF NEW.branch IS DISTINCT FROM OLD.branch OR NEW.team IS DISTINCT FROM OLD.team THEN
      RAISE EXCEPTION 'Branch and team can only be changed by an administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_authz_self_edit_trigger ON public.profiles;
CREATE TRIGGER prevent_profile_authz_self_edit_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_authz_self_edit();

-- Require employee role for viewing personal overtime settlement records.
DROP POLICY IF EXISTS "Employee view own settlements" ON public.overtime_settlements;

CREATE POLICY "Employee view own settlements"
ON public.overtime_settlements
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- Require customer role for customer-only repair log visibility.
DROP POLICY IF EXISTS "Customer view own repair_logs" ON public.repair_logs;

CREATE POLICY "Customer view own repair_logs"
ON public.repair_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer'::app_role)
  AND customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);