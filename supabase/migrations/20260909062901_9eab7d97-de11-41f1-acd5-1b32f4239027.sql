REVOKE ALL ON FUNCTION public.touch_chat_room() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_chat_room() TO service_role;