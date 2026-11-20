CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_permissions ep
    WHERE ep.permission_key = _permission
      AND ep.is_allowed = true
      AND (
        ep.employee_id = _user_id
        OR ep.employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = _user_id)
      )
  )
$function$;