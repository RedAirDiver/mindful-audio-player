-- Add foreign key from purchases.user_id to profiles.user_id so PostgREST can join them
ALTER TABLE public.purchases
ADD CONSTRAINT purchases_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);