-- 1. Remove public SELECT on discount_codes (validation happens server-side in edge functions)
DROP POLICY IF EXISTS "Anyone can view active discount codes" ON public.discount_codes;

-- 2. Revoke client-side access to legacy_password_hash column on profiles
REVOKE SELECT (legacy_password_hash) ON public.profiles FROM anon, authenticated;

-- 3. Restrict EXECUTE on SECURITY DEFINER helper functions (used only inside RLS policies)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_purchased_program(uuid) FROM anon, authenticated, public;