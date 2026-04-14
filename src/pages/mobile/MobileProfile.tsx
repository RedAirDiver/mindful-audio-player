import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import MobileHeader from "@/components/mobile/MobileHeader";

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  company: string;
  address_line1: string;
  address_postcode: string;
  address_city: string;
  address_country: string;
}

const MobileProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (deltaX > 100 && deltaY < 80) navigate(-1);
  };
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    address_line1: "",
    address_postcode: "",
    address_city: "",
    address_country: "",
  });

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("name, email, phone, company, address_line1, address_postcode, address_city, address_country")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setProfile({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        company: data.company || "",
        address_line1: data.address_line1 || "",
        address_postcode: data.address_postcode || "",
        address_city: data.address_city || "",
        address_country: data.address_country || "",
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: profile.name.trim(),
        phone: profile.phone.trim() || null,
        company: profile.company.trim() || null,
        address_line1: profile.address_line1.trim() || null,
        address_postcode: profile.address_postcode.trim() || null,
        address_city: profile.address_city.trim() || null,
        address_country: profile.address_country.trim() || null,
      })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      toast({ title: "Fel", description: "Kunde inte spara ändringar.", variant: "destructive" });
    } else {
      toast({ title: "Sparat", description: "Dina uppgifter har uppdaterats." });
    }
  };

  const updateField = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen pb-32 bg-background" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <MobileHeader />
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate("/mitt-konto")} className="p-1">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-display text-lg font-semibold text-foreground">
            Personuppgifter
          </h1>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 pt-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Personal info */}
            <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="font-display text-base font-semibold text-foreground">
                Kontaktuppgifter
              </h2>

              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs text-muted-foreground">Namn</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs text-muted-foreground">E-post</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="rounded-xl bg-muted"
                />
                <p className="text-[10px] text-muted-foreground">E-postadressen kan inte ändras</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs text-muted-foreground">Telefon</Label>
                <Input
                  id="phone"
                  value={profile.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="rounded-xl"
                  placeholder="070-123 45 67"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="company" className="text-xs text-muted-foreground">Företag</Label>
                <Input
                  id="company"
                  value={profile.company}
                  onChange={(e) => updateField("company", e.target.value)}
                  className="rounded-xl"
                  placeholder="Valfritt"
                />
              </div>
            </section>

            {/* Address */}
            <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="font-display text-base font-semibold text-foreground">
                Adress
              </h2>

              <div className="space-y-1">
                <Label htmlFor="address" className="text-xs text-muted-foreground">Gatuadress</Label>
                <Input
                  id="address"
                  value={profile.address_line1}
                  onChange={(e) => updateField("address_line1", e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="postcode" className="text-xs text-muted-foreground">Postnummer</Label>
                  <Input
                    id="postcode"
                    value={profile.address_postcode}
                    onChange={(e) => updateField("address_postcode", e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="city" className="text-xs text-muted-foreground">Stad</Label>
                  <Input
                    id="city"
                    value={profile.address_city}
                    onChange={(e) => updateField("address_city", e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="country" className="text-xs text-muted-foreground">Land</Label>
                <Input
                  id="country"
                  value={profile.address_country}
                  onChange={(e) => updateField("address_country", e.target.value)}
                  className="rounded-xl"
                  placeholder="Sverige"
                />
              </div>
            </section>

            {/* Save button */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl h-12 text-base font-semibold"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Sparar..." : "Spara ändringar"}
            </Button>
          </motion.div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileProfile;
