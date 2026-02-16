
-- Remove the overly permissive INSERT policy on referrals
DROP POLICY "Service role can insert referrals" ON public.referrals;

-- Referral inserts will be done via edge function using service role key, 
-- so no anon INSERT policy is needed. Service role bypasses RLS.
