
-- Add columns to profiles for WordPress migration tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS wp_user_id integer,
ADD COLUMN IF NOT EXISTS legacy_password_hash text;

-- Add index for wp_user_id lookups
CREATE INDEX IF NOT EXISTS idx_profiles_wp_user_id ON public.profiles(wp_user_id);

-- Allow admins to read all profiles (needed for import duplicate checking)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update all profiles (needed for import)
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));
