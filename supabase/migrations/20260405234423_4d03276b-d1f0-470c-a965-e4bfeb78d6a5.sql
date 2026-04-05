-- Allow admin/employee to delete customers
CREATE POLICY "Admin/employee delete customers"
ON public.customers
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'employee'::app_role)
);