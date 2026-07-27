REVOKE EXECUTE ON FUNCTION public.deduct_inventory_on_repair_part() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_inventory_sales_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_authz_self_edit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_employee_branch(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_quote_number() FROM PUBLIC, anon;