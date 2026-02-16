import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const REFERRAL_KEY = "affiliate_ref";
const REFERRAL_EXPIRY_KEY = "affiliate_ref_expiry";
const REFERRAL_DAYS = 30;

export const useReferral = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      const expiry = Date.now() + REFERRAL_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(REFERRAL_KEY, ref);
      localStorage.setItem(REFERRAL_EXPIRY_KEY, String(expiry));

      // Track click via edge function (fire-and-forget)
      supabase.functions.invoke("track-referral", {
        body: { referral_code: ref, referrer_url: document.referrer || null },
      }).catch(() => {});

      // Clean URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);
};

export const getReferralCode = (): string | null => {
  const code = localStorage.getItem(REFERRAL_KEY);
  const expiry = localStorage.getItem(REFERRAL_EXPIRY_KEY);
  if (!code || !expiry) return null;
  if (Date.now() > Number(expiry)) {
    localStorage.removeItem(REFERRAL_KEY);
    localStorage.removeItem(REFERRAL_EXPIRY_KEY);
    return null;
  }
  return code;
};

export const clearReferralCode = () => {
  localStorage.removeItem(REFERRAL_KEY);
  localStorage.removeItem(REFERRAL_EXPIRY_KEY);
};
