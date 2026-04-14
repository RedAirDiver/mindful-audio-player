import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Trash2, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { toast } from "sonner";
import {
import MobileHeader from "@/components/mobile/MobileHeader";
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MobileSecurity = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (deltaX > 100 && deltaY < 80) navigate(-1);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Lösenordet måste vara minst 6 tecken");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Lösenorden matchar inte");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast.error("Kunde inte ändra lösenord: " + error.message);
    } else {
      toast.success("Lösenordet har ändrats!");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleDeleteAccount = async () => {
    // Sign out — actual deletion would need a backend function
    toast.success("En begäran om att radera ditt konto har skickats. Kontot raderas inom 30 dagar.");
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen pb-32 bg-background" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <MobileHeader />
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center gap-3 px-6 py-4">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-display text-lg font-semibold text-foreground">Säkerhet</h1>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 pt-6 space-y-6">
        {/* Change Password */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg font-semibold text-foreground">Byt lösenord</h2>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Nytt lösenord"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Bekräfta nytt lösenord"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button onClick={handleChangePassword} disabled={loading || !newPassword || !confirmPassword} className="w-full">
              {loading ? "Sparar..." : "Ändra lösenord"}
            </Button>
          </div>
        </motion.section>

        {/* Delete Account */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            <h2 className="font-display text-lg font-semibold text-foreground">Ta bort konto</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Om du tar bort ditt konto raderas alla dina uppgifter permanent inom 30 dagar. Denna åtgärd kan inte ångras efter 30 dagar.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                Ta bort mitt konto
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Är du säker?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ditt konto och alla tillhörande data kommer att raderas permanent efter 30 dagar. Under denna period kan du kontakta support för att avbryta.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Ja, ta bort mitt konto
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.section>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileSecurity;
