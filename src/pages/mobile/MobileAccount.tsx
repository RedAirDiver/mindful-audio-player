import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, ChevronRight, LogOut, Bell, Shield, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import MobileHeader from "@/components/mobile/MobileHeader";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface Purchase {
  id: string;
  purchase_date: string;
  programs: {
    title: string;
    image_url: string | null;
  } | null;
}

const MobileAccount = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const [purchasesRes, profileRes] = await Promise.all([
      supabase
        .from("purchases")
        .select("id, purchase_date, programs(title, image_url)")
        .eq("user_id", user.id)
        .order("purchase_date", { ascending: false })
        .limit(3),
      supabase
        .from("profiles")
        .select("name, email")
        .eq("user_id", user.id)
        .single(),
    ]);
    if (purchasesRes.data) setPurchases(purchasesRes.data as any);
    if (profileRes.data) setProfile(profileRes.data);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("sv-SE", { month: "short", year: "numeric" });
  };

  return (
    <div className="min-h-screen pb-32 bg-background">
      <MobileHeader />

      <main className="max-w-2xl mx-auto px-6 pt-4">
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary font-body mb-1">
            Profilinställningar
          </p>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Mitt Konto
          </h1>
        </motion.div>

        {/* Mina Köp */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl p-6 shadow-sm mb-6"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Mina Köp
            </h2>
            <button
              onClick={() => navigate("/dashboard")}
              className="text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-70 transition-opacity font-body flex items-center gap-1"
            >
              Visa alla <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {purchases.length > 0 ? (
            <div className="space-y-3">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm truncate">
                      {purchase.programs?.title || "Okänt program"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Köpt {formatDate(purchase.purchase_date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Inga köp ännu
            </p>
          )}
        </motion.section>

        {/* Inställningar */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl p-6 shadow-sm mb-6"
        >
          <h2 className="font-display text-lg font-semibold text-foreground mb-4">
            Inställningar
          </h2>

          <div className="space-y-1">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Personuppgifter
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Notiser
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Säkerhet
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 p-3 mt-2 text-destructive hover:bg-destructive/5 rounded-xl transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Logga ut</span>
          </button>
        </motion.section>

        {/* Support Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-primary rounded-2xl p-8 text-primary-foreground mb-8"
        >
          <h2 className="font-display text-xl font-bold mb-3">
            Behöver du hjälp med ditt konto?
          </h2>
          <p className="text-primary-foreground/80 text-sm mb-6 leading-relaxed">
            Vårt supportteam finns här för att hjälpa dig med frågor rörande
            betalningar eller teknisk support.
          </p>
          <div className="flex gap-3">
            <button className="px-5 py-2.5 bg-card text-foreground rounded-xl text-sm font-semibold hover:bg-card/90 transition-colors">
              Kontakta Support
            </button>
            <button className="px-5 py-2.5 border-2 border-primary-foreground/30 text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary-foreground/10 transition-colors">
              Vanliga Frågor
            </button>
          </div>
        </motion.section>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileAccount;
