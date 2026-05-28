
-- 1. Remove fraudulent self-insert on purchases (Stripe / admin paths use service role and bypass RLS)
DROP POLICY IF EXISTS "Users can create their own purchases" ON public.purchases;

-- 2. Remove client-side login_history INSERT; rely on SECURITY DEFINER function
DROP POLICY IF EXISTS "Authenticated users can insert login history" ON public.login_history;

CREATE OR REPLACE FUNCTION public.record_login(_login_method text, _ip_address text, _user_agent text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.login_history (user_id, email, login_method, ip_address, user_agent)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    COALESCE(_login_method, 'password'),
    _ip_address,
    _user_agent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_login(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_login(text, text, text) TO authenticated;

-- 3. Lock down SECURITY DEFINER functions from public/anon execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_purchased_program(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_slug(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_purchased_program(uuid) TO authenticated;

-- 4. Product images: keep bucket public for direct URL fetches, but disallow listing/enumeration for non-admins
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;

CREATE POLICY "Admins can list product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));
