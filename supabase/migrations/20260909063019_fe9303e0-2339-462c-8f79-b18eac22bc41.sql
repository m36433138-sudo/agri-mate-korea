CREATE OR REPLACE FUNCTION public.list_chat_staff()
RETURNS TABLE(user_id uuid, display_name text, team text, branch text, role app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, COALESCE(p.display_name, '이름 없음'), p.team, p.branch, ur.role
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role IN ('admin','employee')
    AND public.is_staff(auth.uid())
  ORDER BY ur.role, COALESCE(p.display_name,'')
$$;

REVOKE ALL ON FUNCTION public.list_chat_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_chat_staff() TO authenticated, service_role;