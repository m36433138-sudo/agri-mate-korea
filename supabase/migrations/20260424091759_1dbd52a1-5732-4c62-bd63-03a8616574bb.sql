-- Fix permission checks to always resolve permissions through the employees table.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_permissions ep
    JOIN public.employees e ON e.id = ep.employee_id
    WHERE e.user_id = _user_id
      AND ep.permission_key = _permission
      AND ep.is_allowed = true
  )
$$;

-- Helper used by RLS policies to compare an employee's branch safely.
CREATE OR REPLACE FUNCTION public.current_employee_branch(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(e.team, p.branch)
  FROM public.employees e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.user_id = _user_id
  LIMIT 1
$$;

-- Make account creation handler consistent if employee role is ever assigned during signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count int;
  assigned_role app_role;
  linked_employee_id uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email), NEW.email);

  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'customer';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);

  IF assigned_role = 'employee' THEN
    SELECT id INTO linked_employee_id FROM public.employees WHERE user_id = NEW.id LIMIT 1;
    IF linked_employee_id IS NOT NULL THEN
      INSERT INTO public.employee_permissions (employee_id, permission_key, is_allowed)
      VALUES
        (linked_employee_id, 'view_customers', false),
        (linked_employee_id, 'edit_customers', false),
        (linked_employee_id, 'manage_repairs', false),
        (linked_employee_id, 'view_machines', false),
        (linked_employee_id, 'add_machines', false)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure only admins can change role/permission records; employees can only read their own permissions.
ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own permissions" ON public.employee_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.employee_permissions;
DROP POLICY IF EXISTS "Admins manage employee_permissions" ON public.employee_permissions;
DROP POLICY IF EXISTS "Employees view own permissions" ON public.employee_permissions;

CREATE POLICY "Admins manage employee_permissions"
ON public.employee_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees view own permissions"
ON public.employee_permissions
FOR SELECT
TO authenticated
USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;

CREATE POLICY "Admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Scope customer data by branch for employees; admins retain full access; customers retain their own record.
DROP POLICY IF EXISTS "Admin/employee access customers" ON public.customers;
DROP POLICY IF EXISTS "Admin/employee delete customers" ON public.customers;

CREATE POLICY "Admins full customer access"
ON public.customers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees view branch customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND public.has_permission(auth.uid(), 'view_customers')
  AND COALESCE(branch, '') = COALESCE(public.current_employee_branch(auth.uid()), '')
);

CREATE POLICY "Employees edit branch customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND public.has_permission(auth.uid(), 'edit_customers')
  AND COALESCE(branch, '') = COALESCE(public.current_employee_branch(auth.uid()), '')
)
WITH CHECK (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND public.has_permission(auth.uid(), 'edit_customers')
  AND COALESCE(branch, '') = COALESCE(public.current_employee_branch(auth.uid()), '')
);

CREATE POLICY "Employees create branch customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'employee'::app_role)
  AND public.has_permission(auth.uid(), 'edit_customers')
  AND COALESCE(branch, '') = COALESCE(public.current_employee_branch(auth.uid()), '')
);

CREATE POLICY "Customers view own customer record"
ON public.customers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Protect realtime subscription authorization for internal app channels.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin/employee realtime access" ON realtime.messages;

CREATE POLICY "Admin/employee realtime access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
);