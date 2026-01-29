-- Add slug column to programs table
ALTER TABLE public.programs 
ADD COLUMN slug text UNIQUE;

-- Create a function to generate slug from title
CREATE OR REPLACE FUNCTION public.generate_slug(title text)
RETURNS text
LANGUAGE plpgsql
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

-- Update existing programs with generated slugs
UPDATE public.programs 
SET slug = generate_slug(title) || '-' || substring(id::text, 1, 8)
WHERE slug IS NULL;

-- Make slug NOT NULL after populating
ALTER TABLE public.programs 
ALTER COLUMN slug SET NOT NULL;

-- Create index for faster slug lookups
CREATE INDEX idx_programs_slug ON public.programs(slug);