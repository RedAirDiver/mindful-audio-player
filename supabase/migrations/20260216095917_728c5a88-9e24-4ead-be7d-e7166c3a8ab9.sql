
-- Affiliates table
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  referral_code text NOT NULL UNIQUE,
  commission_rate numeric NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  payout_method text DEFAULT NULL,
  payout_details text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their own record
CREATE POLICY "Users can view their own affiliate" ON public.affiliates
  FOR SELECT USING (auth.uid() = user_id);

-- Affiliates can update their own payout info
CREATE POLICY "Users can update own affiliate payout" ON public.affiliates
  FOR UPDATE USING (auth.uid() = user_id);

-- Affiliates can insert their own application
CREATE POLICY "Users can apply as affiliate" ON public.affiliates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins full access
CREATE POLICY "Admins can manage affiliates" ON public.affiliates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Referrals table (click tracking)
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  visitor_ip text,
  referrer_url text,
  landed_at timestamptz NOT NULL DEFAULT now(),
  converted boolean NOT NULL DEFAULT false,
  converted_user_id uuid DEFAULT NULL
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their own referrals
CREATE POLICY "Affiliates can view own referrals" ON public.referrals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.affiliates WHERE id = affiliate_id AND user_id = auth.uid()
    )
  );

-- Public insert for tracking clicks (via edge function)
CREATE POLICY "Service role can insert referrals" ON public.referrals
  FOR INSERT WITH CHECK (true);

-- Admins full access
CREATE POLICY "Admins can manage referrals" ON public.referrals
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Commissions table
CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their own commissions
CREATE POLICY "Affiliates can view own commissions" ON public.commissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.affiliates WHERE id = affiliate_id AND user_id = auth.uid()
    )
  );

-- Admins full access
CREATE POLICY "Admins can manage commissions" ON public.commissions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
