
-- Add user_id column to customers table to link with auth accounts
ALTER TABLE public.customers ADD COLUMN user_id uuid UNIQUE;

-- Update RLS: customers with user_id can view their own record
DROP POLICY IF EXISTS "Admin/employee access customers" ON public.customers;

CREATE POLICY "Admin/employee access customers"
ON public.customers FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'employee'::app_role) AND has_permission(auth.uid(), 'view_customers'::text))
  OR (user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'employee'::app_role) AND has_permission(auth.uid(), 'edit_customers'::text))
);
