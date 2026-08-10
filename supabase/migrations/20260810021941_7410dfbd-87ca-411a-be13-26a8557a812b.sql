DROP POLICY IF EXISTS "Employees view own permissions" ON public.employee_permissions;
CREATE POLICY "Employees view own permissions"
ON public.employee_permissions FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid())
);

-- 권한 행이 없거나 전부 꺼져 있는 활성 직원에게 팀 기본 권한 부여
WITH presets AS (
  SELECT '기사팀'::text AS team, unnest(ARRAY['view_operations','manage_operations','view_onsite','manage_onsite','view_customers','view_machines','add_machines','edit_machines','view_repairs','manage_repairs','edit_repairs','view_parts','adjust_inventory','view_repair_templates','view_attachments','view_stats','view_overtime','view_knowledge']) AS k
  UNION ALL
  SELECT '영업팀', unnest(ARRAY['view_operations','view_customers','edit_customers','view_machines','add_machines','edit_machines','view_repairs','view_parts','view_quotes','manage_quotes','view_attachments','view_stats','view_knowledge'])
  UNION ALL
  SELECT '사무팀', unnest(ARRAY['view_operations','manage_operations','view_customers','edit_customers','view_machines','view_repairs','edit_repairs','view_parts','edit_parts','adjust_inventory','view_vendors','manage_vendors','view_quotes','manage_quotes','view_assets','manage_assets','view_stats','view_overtime','view_knowledge','manage_knowledge','view_repair_templates','manage_repair_templates'])
), targets AS (
  SELECT e.user_id, COALESCE(e.team,'기사팀') AS team
  FROM public.employees e
  WHERE e.is_active AND e.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_permissions p
      WHERE p.employee_id = e.user_id AND p.is_allowed
    )
)
INSERT INTO public.employee_permissions (employee_id, permission_key, is_allowed)
SELECT t.user_id, p.k, true
FROM targets t
JOIN presets p ON p.team = t.team
ON CONFLICT (employee_id, permission_key) DO UPDATE SET is_allowed = true;