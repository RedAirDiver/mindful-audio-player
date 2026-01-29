-- Fix security warning: set search_path for generate_slug function
CREATE OR REPLACE FUNCTION public.generate_slug(title text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  slug text;
BEGIN
  -- Convert to lowercase and replace Swedish characters
  slug := lower(title);
  slug := replace(slug, 'å', 'a');
  slug := replace(slug, 'ä', 'a');
  slug := replace(slug, 'ö', 'o');
  slug := replace(slug, 'Å', 'a');
  slug := replace(slug, 'Ä', 'a');
  slug := replace(slug, 'Ö', 'o');
  -- Replace spaces and special characters with hyphens
  slug := regexp_replace(slug, '[^a-z0-9]+', '-', 'g');
  -- Remove leading/trailing hyphens
  slug := trim(both '-' from slug);
  RETURN slug;
END;
$$;