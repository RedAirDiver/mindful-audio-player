import { useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Tag, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { getReferralCode } from "@/hooks/useReferral";

// Stripe publishable key
const stripePromise = loadStripe(
  "pk_live_51IdVt0DvcaIYapUFBceYidJSFnF8k8KyVGb4yZyDn7sSjUcWKN0KdAAYceCtsdrPFfdr9QjsDqRvOgbUZcrrDho800bW9cpl5n"
);

interface StripeCheckoutProps {
  programId: string;
  programTitle: string;
  price: number;
  onPurchaseComplete?: () => void;
}

export const StripeCheckout = ({
  programId,
  programTitle,
  price,
  onPurchaseComplete,
}: StripeCheckoutProps) => {
  const [discountCode, setDiscountCode] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const initiateCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const refCode = getReferralCode();
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          program_id: programId,
          discount_code: discountCode.trim() || undefined,
          referral_code: refCode || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.already_purchased) {
          toast.info("Du har redan köpt detta program");
          return;
        }
        throw new Error(data.error);
      }

      if (data?.free) {
        toast.success(data.message);
        onPurchaseComplete?.();
        return;
      }

      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
        setShowCheckout(true);
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error("Kunde inte starta betalning", { description: err.message });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const fetchClientSecret = useCallback(async () => {
    return clientSecret || "";
  }, [clientSecret]);

  if (showCheckout && clientSecret) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Betalning</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowCheckout(false);
              setClientSecret(null);
            }}
          >
            <X className="w-4 h-4 mr-1" />
            Avbryt
          </Button>
        </div>
        <div id="checkout" className="rounded-xl overflow-hidden border border-border">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ fetchClientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Discount code */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rabattkod"
            value={discountCode}
            onChange={(e) => setDiscountCode(e.target.value)}
            className="pl-9 h-12 rounded-xl"
          />
        </div>
      </div>

      {/* Buy button */}
      <Button
        className="w-full h-12 rounded-xl text-base font-semibold"
        onClick={initiateCheckout}
        disabled={checkoutLoading}
      >
        {checkoutLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Förbereder betalning...
          </span>
        ) : (
          <>
            <ShoppingCart className="w-5 h-5 mr-2" />
            {price === 0 ? "Hämta gratis" : `Köp nu — ${price} kr`}
          </>
        )}
      </Button>
    </div>
  );
};
