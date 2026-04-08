import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { clearReferralCode } from "@/hooks/useReferral";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const PaymentReturn = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (sessionId && user) {
      verifyPayment();
    }
  }, [sessionId, user]);

  const verifyPayment = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { session_id: sessionId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      clearReferralCode();
      setStatus("success");
      toast.success("Köp genomfört!");
    } catch (err: any) {
      console.error("Payment verification error:", err);
      setErrorMessage(err.message || "Kunde inte verifiera betalningen");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 md:pt-36 pb-16">
        <div className="container mx-auto px-4 max-w-md text-center">
          {status === "loading" && (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <h1 className="font-display text-2xl font-semibold text-foreground">
                Verifierar betalning...
              </h1>
              <p className="text-muted-foreground">
                Vänta medan vi bekräftar ditt köp.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-foreground">
                Tack för ditt köp!
              </h1>
              <p className="text-muted-foreground">
                Ditt program finns nu tillgängligt i ditt konto. Du kan börja lyssna direkt.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild>
                  <Link to="/mina-program">Gå till mina program</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/produkter">Fortsätt handla</Link>
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-foreground">
                Något gick fel
              </h1>
              <p className="text-muted-foreground">{errorMessage}</p>
              <Button asChild>
                <Link to="/produkter">Tillbaka till butiken</Link>
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PaymentReturn;
