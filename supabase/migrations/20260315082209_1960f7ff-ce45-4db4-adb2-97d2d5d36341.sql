
-- Fix overly permissive RLS policies on existing tables
-- Replace USING(true) WITH CHECK(true) with proper role-based policies

-- CUSTOMERS
DROP POLICY IF EXISTS "Authenticated access to customers" ON public.customers;
CREATE POLICY "Admin/employee access customers" ON public.customers
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'view_customers'))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'edit_customers'))
  );

-- MACHINES
DROP POLICY IF EXISTS "Authenticated access to machines" ON public.machines;
CREATE POLICY "Admin/employee access machines" ON public.machines
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'view_machines'))
    OR (public.has_role(auth.uid(), 'customer') AND customer_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'add_machines'))
  );

-- REPAIRS
DROP POLICY IF EXISTS "Authenticated access to repairs" ON public.repairs;
CREATE POLICY "Admin/employee access repairs" ON public.repairs
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'manage_repairs'))
    OR (public.has_role(auth.uid(), 'customer') AND machine_id IN (
      SELECT id FROM public.machines WHERE customer_id = auth.uid()
    ))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'manage_repairs'))
  );

-- REPAIR_PARTS
DROP POLICY IF EXISTS "Authenticated access to repair_parts" ON public.repair_parts;
CREATE POLICY "Admin/employee access repair_parts" ON public.repair_parts
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'manage_repairs'))
    OR (public.has_role(auth.uid(), 'customer') AND repair_id IN (
      SELECT r.id FROM public.repairs r
      JOIN public.machines m ON r.machine_id = m.id
      WHERE m.customer_id = auth.uid()
    ))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'employee') AND public.has_permission(auth.uid(), 'manage_repairs'))
  );

-- PARTS
DROP POLICY IF EXISTS "Authenticated access to parts" ON public.parts;
CREATE POLICY "Admin/employee access parts" ON public.parts
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
  );

-- REPAIR_TEMPLATES
DROP POLICY IF EXISTS "Authenticated access to repair_templates" ON public.repair_templates;
CREATE POLICY "Admin/employee access repair_templates" ON public.repair_templates
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
  );

-- REPAIR_TEMPLATE_ITEMS
DROP POLICY IF EXISTS "Authenticated access to repair_template_items" ON public.repair_template_items;
CREATE POLICY "Admin/employee access repair_template_items" ON public.repair_template_items
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
  );

-- REPAIR_HISTORY
DROP POLICY IF EXISTS "Authenticated access to repair_history" ON public.repair_history;
CREATE POLICY "Admin/employee access repair_history" ON public.repair_history
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
  );

-- Fix duplicate profile policies - drop the admin ones since per-user + admin OR clause is better
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "View profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
