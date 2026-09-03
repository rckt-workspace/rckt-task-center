REVOKE EXECUTE ON FUNCTION public.can_access_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_task(uuid) TO authenticated, service_role;