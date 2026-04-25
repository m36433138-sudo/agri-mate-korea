-- Drop existing realtime.messages policies to rebuild them with stricter scoping
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON realtime.messages', pol.policyname);
  END LOOP;
END $$;

-- Ensure RLS is enabled on realtime.messages
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Admins: full access to all realtime channels
CREATE POLICY "Admins full realtime access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Employees: can subscribe ONLY to work-related topics
-- Allowed topic prefixes: operations, repairs, repair_logs, repair_notes,
-- inventory, parts, machines, sheet_assignments, tasks, customers (branch-scoped at table level)
-- Personal topics: attendance:<own_employee_id>, location:<own_employee_id>
CREATE POLICY "Employees subscribe work topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee'::public.app_role)
  AND (
    -- Shared work topics
    realtime.topic() LIKE 'operations:%'
    OR realtime.topic() LIKE 'repairs:%'
    OR realtime.topic() LIKE 'repair_logs:%'
    OR realtime.topic() LIKE 'repair_notes:%'
    OR realtime.topic() LIKE 'inventory:%'
    OR realtime.topic() LIKE 'parts:%'
    OR realtime.topic() LIKE 'machines:%'
    OR realtime.topic() LIKE 'sheet_assignments:%'
    OR realtime.topic() LIKE 'tasks:%'
    OR realtime.topic() LIKE 'customers:%'
    OR realtime.topic() LIKE 'vendors:%'
    -- Personal topics scoped to the employee's own employees.id
    OR realtime.topic() IN (
      SELECT 'attendance:' || e.id::text FROM public.employees e WHERE e.user_id = auth.uid()
    )
    OR realtime.topic() IN (
      SELECT 'location:' || e.id::text FROM public.employees e WHERE e.user_id = auth.uid()
    )
    OR realtime.topic() IN (
      SELECT 'user:' || auth.uid()::text
    )
  )
);

-- Customers: can ONLY subscribe to their own personal channel — no internal data
CREATE POLICY "Customers subscribe own topic only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  AND realtime.topic() = 'user:' || auth.uid()::text
);