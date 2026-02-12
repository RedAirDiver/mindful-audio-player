
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_line1 text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_postcode text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_country text;
