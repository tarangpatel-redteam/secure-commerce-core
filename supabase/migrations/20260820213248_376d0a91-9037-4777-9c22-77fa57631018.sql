REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_catalog_manager(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_catalog_manager(uuid) TO authenticated, service_role;