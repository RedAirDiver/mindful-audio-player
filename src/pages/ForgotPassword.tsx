import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.svg";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (error: any) {
      toast.error(error.message || "Ett fel uppstod. Försök igen.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Link
        to="/login"
        className="absolute top-6 left-6 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Tillbaka till inloggning</span>
      </Link>

      <div className="w-full max-w-md bg-card rounded-2xl shadow-lg p-8 space-y-6 animate-scale-in">
        <div className="text-center">
          <img src={logo} alt="Mentalträning" className="h-14 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Glömt lösenord</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Ange din e-postadress så skickar vi en länk för att återställa ditt lösenord.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4 py-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-foreground font-medium">E-post skickad!</p>
            <p className="text-muted-foreground text-sm">
              Kontrollera din inkorg (och skräppost) för en länk att återställa ditt lösenord.
            </p>
            <Link to="/login">
              <Button variant="outline" className="mt-4">
                Tillbaka till inloggning
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="din@email.se"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Skickar...
                </span>
              ) : (
                "Skicka återställningslänk"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
