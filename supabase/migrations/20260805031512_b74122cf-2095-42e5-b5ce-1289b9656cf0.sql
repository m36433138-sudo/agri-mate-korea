-- 중복 권한 방지
CREATE UNIQUE INDEX IF NOT EXISTS employee_permissions_unique_key
  ON public.employee_permissions (employee_id, permission_key);

-- 신규 세부 권한을 기존 직원에게 허용 상태로 부여 (기존 5개 항목은 그대로 유지)
INSERT INTO public.employee_permissions (employee_id, permission_key, is_allowed)
SELECT ur.user_id, k.permission_key, true
FROM public.user_roles ur
CROSS JOIN (VALUES
  ('delete_customers'),
  ('edit_machines'),
  ('delete_machines'),
  ('view_repairs'),
  ('edit_repairs'),
  ('delete_repairs'),
  ('view_parts'),
  ('edit_parts'),
  ('adjust_inventory'),
  ('view_vendors'),
  ('manage_vendors'),
  ('view_quotes'),
  ('manage_quotes'),
  ('view_assets'),
  ('manage_assets'),
  ('view_operations'),
  ('manage_operations'),
  ('view_onsite'),
  ('manage_onsite'),
  ('view_stats'),
  ('view_overtime'),
  ('view_attachments'),
  ('manage_attachments'),
  ('view_knowledge'),
  ('manage_knowledge'),
  ('view_repair_templates'),
  ('manage_repair_templates')
) AS k(permission_key)
WHERE ur.role = 'employee'
ON CONFLICT (employee_id, permission_key) DO NOTHING;