-- 1. has_permission 함수: employees 테이블 조인으로 수정
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
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

-- 2. employee_permissions: 직원 자가 부여 차단 (admin만 관리, 본인 조회만 허용)
DROP POLICY IF EXISTS "Users can view own permissions" ON public.employee_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.employee_permissions;

CREATE POLICY "Admins manage employee_permissions"
  ON public.employee_permissions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees view own permissions"
  ON public.employee_permissions
  FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- 3. user_roles: admin 외 INSERT/UPDATE/DELETE 차단을 명시
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Realtime 채널 보호
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/employee realtime access" ON realtime.messages;

CREATE POLICY "Admin/employee realtime access"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
  );
