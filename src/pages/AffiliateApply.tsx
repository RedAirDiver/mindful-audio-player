import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";

const AffiliateApply = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreed) {
      toast.error("Du måste godkänna avtalet för att ansöka");
      return;
    }

    if (!user) {
      toast.info("Du behöver logga in eller skapa ett konto för att ansöka");
      navigate("/login?redirect=/bli-affiliate");
      return;
    }

    if (!name.trim() || !email.trim()) {
      toast.error("Namn och e-postadress krävs");
      return;
    }

    setSubmitting(true);

    // Generate a referral code from name
    const code = name
      .trim()
      .toLowerCase()
      .replace(/[åä]/g, "a")
      .replace(/ö/g, "o")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20);

    const uniqueCode = code + Math.floor(Math.random() * 100);

    // Update profile with extra info if provided
    if (phone || orgNumber) {
      await supabase
        .from("profiles")
        .update({
          phone: phone.trim() || undefined,
          company: orgNumber.trim() || undefined,
          name: name.trim(),
          email: email.trim(),
        })
        .eq("user_id", user.id);
    }

    const { error } = await supabase.from("affiliates").insert({
      user_id: user.id,
      referral_code: uniqueCode,
      payout_details: message.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      if (error.message.includes("duplicate") || error.code === "23505") {
        toast.error("Du har redan en affiliate-ansökan");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Ansökan skickad! Vi granskar den och återkommer.");
      navigate("/affiliate");
    }
  };

  // PDF agreement URL – replace with your actual agreement PDF
  const agreementPdfUrl =
    "https://xn--mentaltrning-ncb.nu/wp-content/uploads/2024/05/Unestal-Education-AB_avtal-affiliate.pdf";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 md:pt-36 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-10">
            Registrera Affiliate
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left: Form */}
            <div className="bg-card rounded-2xl shadow-elegant p-8">
              <h2 className="font-display text-xl font-semibold text-foreground mb-6">
                Affiliateansökan
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="aff-name">Namn *</Label>
                  <Input
                    id="aff-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ditt fullständiga namn"
                    required
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aff-phone">Mobil</Label>
                  <Input
                    id="aff-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+46 70 123 45 67"
                    maxLength={20}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aff-email">E-postadress *</Label>
                  <Input
                    id="aff-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="din@email.se"
                    required
                    maxLength={255}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aff-org">Organisationsnummer</Label>
                  <Input
                    id="aff-org"
                    value={orgNumber}
                    onChange={(e) => setOrgNumber(e.target.value)}
                    placeholder="XXXXXX-XXXX"
                    maxLength={20}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aff-msg">Meddelande</Label>
                  <textarea
                    id="aff-msg"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Berätta gärna lite om dig och hur du vill marknadsföra"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    maxLength={1000}
                  />
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <Checkbox
                    id="aff-agree"
                    checked={agreed}
                    onCheckedChange={(v) => setAgreed(v === true)}
                  />
                  <label htmlFor="aff-agree" className="text-sm leading-relaxed cursor-pointer">
                    Jag har läst och godkänt avtalet i sin helhet{" "}
                    <a
                      href={agreementPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      som finns här!
                    </a>
                  </label>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={submitting || authLoading}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Skickar...
                    </>
                  ) : (
                    "Ansök!"
                  )}
                </Button>
              </form>
            </div>

            {/* Right: Info text */}
            <div className="space-y-6 text-foreground/80 leading-relaxed">
              <p>
                Att bli en affiliate inom mental hälsa kan vara ett kraftfullt sätt att
                både främja välbefinnande och generera inkomst samtidigt. Genom att
                marknadsföra produkter eller tjänster relaterade till mental hälsa kan du
                inte bara hjälpa andra att hitta resurser för att förbättra sitt
                välmående, utan också dra nytta av fördelarna som kommer med att vara en
                del av denna växande bransch.
              </p>
              <p>
                En av de främsta fördelarna med att bli en affiliate inom mental hälsa är
                den möjlighet det ger dig att göra verklig skillnad i människors liv.
                Genom att marknadsföra produkter och tjänster som främjar mental hälsa,
                såsom självhjälpsböcker, terapitjänster, mindfulness-kurser eller appar
                för meditation, kan du bidra till att öka medvetenheten och
                tillgängligheten av resurser för dem som behöver det.
              </p>
              <p>
                Genom att sprida kunskap och tillhandahålla verktyg för självförbättring
                kan du vara en källa till inspiration och stöd för andra i deras väg mot
                bättre psykisk hälsa.
              </p>

              <div className="bg-primary/5 border border-primary/15 rounded-xl p-5 space-y-3">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Så fungerar det
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">1.</span>
                    Fyll i formuläret och godkänn avtalet
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">2.</span>
                    Vi granskar din ansökan och godkänner den
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">3.</span>
                    Du får en unik affiliate-länk att dela
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">4.</span>
                    Tjäna provision på varje köp via din länk
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AffiliateApply;
