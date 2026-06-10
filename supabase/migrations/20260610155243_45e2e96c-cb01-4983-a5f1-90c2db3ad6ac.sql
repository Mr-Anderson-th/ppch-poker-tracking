
CREATE OR REPLACE FUNCTION public.set_admin_password(_new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.settings SET admin_password_hash = crypt(_new_password, gen_salt('bf')) WHERE id = 1;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_admin_password(TEXT) FROM PUBLIC, anon, authenticated;
