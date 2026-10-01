-- Supabase default privileges also grant function execution to service_role.
-- Preserve the applied first migration and close that inherited RPC surface.
revoke all on function public.hook_allow_club_member(jsonb) from service_role;
revoke all on function public.handle_club_auth_user_created() from service_role;
