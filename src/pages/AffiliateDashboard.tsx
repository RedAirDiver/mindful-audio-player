import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  LinkIcon,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  Copy,
  Save,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

interface AffiliateData {
  id: string;
  referral_code: string;
  commission_rate: number;
  status: string;
  payout_method: string | null;
  payout_details: string | null;
}

interface CommissionRow {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

const AffiliateDashboard = () => {
  const { user } = useAuth();
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [clickCount, setClickCount] = useState(0);
  const [conversions, setConversions] = useState(0);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutDetails, setPayoutDetails] = useState("");

  useEffect(() => {
    if (user) fetchAffiliate();
  }, [user]);

  const fetchAffiliate = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("affiliates")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (data) {
      setAffiliate(data as AffiliateData);
      setPayoutMethod(data.payout_method || "");
      setPayoutDetails(data.payout_details || "");

      // Fetch stats
      const [clicksRes, commissionsRes] = await Promise.all([
        supabase
          .from("referrals")
          .select("id, converted", { count: "exact" })
          .eq("affiliate_id", data.id),
        supabase
          .from("commissions")
          .select("*")
          .eq("affiliate_id", data.id)
          .order("created_at", { ascending: false }),
      ]);

      if (clicksRes.data) {
        setClickCount(clicksRes.count || 0);
        setConversions(clicksRes.data.filter((r: any) => r.converted).length);
      }

      if (commissionsRes.data) {
        setCommissions(commissionsRes.data as CommissionRow[]);
        setTotalEarned(
          commissionsRes.data.reduce((sum: number, c: any) => sum + Number(c.amount), 0)
        );
        setTotalPaid(
          commissionsRes.data
            .filter((c: any) => c.status === "paid")
            .reduce((sum: number, c: any) => sum + Number(c.amount), 0)
        );
      }
    }
    setLoading(false);
  };

  const handleApply = async () => {
    if (!user || !referralCode.trim()) {
      toast.error("Ange en unik affiliate-kod");
      return;
    }
    setApplying(true);
    const { error } = await supabase.from("affiliates").insert({
      user_id: user.id,
      referral_code: referralCode.trim().toLowerCase(),
    });
    setApplying(false);
    if (error) {
      if (error.message.includes("duplicate")) {
        toast.error("Den koden är redan tagen, välj en annan");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Ansökan skickad! Inväntar godkännande.");
      fetchAffiliate();
    }
  };

  const handleSavePayout = async () => {
    if (!affiliate) return;
    setSaving(true);
    const { error } = await supabase
      .from("affiliates")
      .update({
        payout_method: payoutMethod.trim(),
        payout_details: payoutDetails.trim(),
      })
      .eq("id", affiliate.id);
    setSaving(false);
    if (error) {
      toast.error("Kunde inte spara");
    } else {
      toast.success("Utbetalningsinfo sparad");
    }
  };

  const copyLink = () => {
    if (!affiliate) return;
    const link = `${window.location.origin}/?ref=${affiliate.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Länk kopierad!");
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "pending": return { text: "Väntar på godkännande", icon: Clock, color: "text-amber-500" };
      case "approved": return { text: "Godkänd", icon: CheckCircle2, color: "text-primary" };
      case "rejected": return { text: "Nekad", icon: XCircle, color: "text-destructive" };
      case "suspended": return { text: "Pausad", icon: XCircle, color: "text-destructive" };
      default: return { text: s, icon: Clock, color: "text-muted-foreground" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 md:pt-36 pb-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  // Not an affiliate yet — application form
  if (!affiliate) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 md:pt-36 pb-16">
          <div className="container mx-auto px-4 max-w-lg">
            <div className="bg-card rounded-2xl shadow-elegant p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <LinkIcon className="w-8 h-8 text-primary" />
                </div>
                <h1 className="font-display text-2xl font-semibold text-foreground">
                  Bli affiliate
                </h1>
                <p className="text-muted-foreground">
                  Dela dina favoriter och tjäna provision på varje köp.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ref-code">Välj din unika kod</Label>
                  <div className="flex gap-2">
                    <span className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                      mt.virex.se/?ref=
                    </span>
                    <Input
                      id="ref-code"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                      placeholder="dinkod"
                      maxLength={30}
                    />
                  </div>
                </div>

                <Button className="w-full" onClick={handleApply} disabled={applying}>
                  {applying ? "Skickar..." : "Ansök som affiliate"}
                </Button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const status = statusLabel(affiliate.status);
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 md:pt-36 pb-16">
        <div className="container mx-auto px-4 max-w-5xl space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-semibold text-foreground">
                Affiliate Dashboard
              </h1>
              <div className={`flex items-center gap-2 mt-1 ${status.color}`}>
                <StatusIcon className="w-4 h-4" />
                <span className="text-sm font-medium">{status.text}</span>
              </div>
            </div>
          </div>

          {affiliate.status === "pending" && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-foreground">
              Din ansökan granskas. Du får tillgång till alla funktioner när den godkänns.
            </div>
          )}

          {affiliate.status === "approved" && (
            <>
              {/* Affiliate Link */}
              <div className="bg-card rounded-2xl shadow-elegant p-6">
                <Label className="text-sm text-muted-foreground mb-2 block">Din affiliate-länk</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/?ref=${affiliate.referral_code}`}
                    className="bg-muted"
                  />
                  <Button variant="outline" onClick={copyLink}>
                    <Copy className="w-4 h-4 mr-2" />
                    Kopiera
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={MousePointerClick} label="Klick" value={String(clickCount)} />
                <StatCard icon={TrendingUp} label="Konverteringar" value={String(conversions)} />
                <StatCard icon={DollarSign} label="Totalt intjänat" value={`${totalEarned.toFixed(0)} kr`} />
                <StatCard icon={CheckCircle2} label="Utbetalt" value={`${totalPaid.toFixed(0)} kr`} />
              </div>

              {/* Commissions Table */}
              <div className="bg-card rounded-2xl shadow-elegant overflow-hidden">
                <div className="p-6 border-b border-border">
                  <h2 className="font-display text-lg font-semibold text-foreground">Provisioner</h2>
                </div>
                {commissions.length === 0 ? (
                  <p className="p-6 text-muted-foreground text-sm">Inga provisioner ännu.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="px-6 py-3 font-medium">Datum</th>
                          <th className="px-6 py-3 font-medium">Belopp</th>
                          <th className="px-6 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.map((c) => (
                          <tr key={c.id} className="border-b border-border last:border-0">
                            <td className="px-6 py-3">
                              {new Date(c.created_at).toLocaleDateString("sv-SE")}
                            </td>
                            <td className="px-6 py-3 font-medium">{Number(c.amount).toFixed(0)} kr</td>
                            <td className="px-6 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  c.status === "paid"
                                    ? "bg-primary/10 text-primary"
                                    : c.status === "cancelled"
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-amber-500/10 text-amber-600"
                                }`}
                              >
                                {c.status === "paid" ? "Utbetald" : c.status === "cancelled" ? "Avbruten" : "Väntande"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payout Info */}
              <div className="bg-card rounded-2xl shadow-elegant p-6 space-y-4">
                <h2 className="font-display text-lg font-semibold text-foreground">Utbetalningsinformation</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Metod (t.ex. PayPal, Bank)</Label>
                    <Input
                      value={payoutMethod}
                      onChange={(e) => setPayoutMethod(e.target.value)}
                      placeholder="PayPal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Detaljer (e-post eller kontonr)</Label>
                    <Input
                      value={payoutDetails}
                      onChange={(e) => setPayoutDetails(e.target.value)}
                      placeholder="din@email.se"
                    />
                  </div>
                </div>
                <Button onClick={handleSavePayout} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Sparar..." : "Spara"}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="bg-card rounded-xl shadow-elegant p-5 flex items-center gap-4">
    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  </div>
);

export default AffiliateDashboard;
