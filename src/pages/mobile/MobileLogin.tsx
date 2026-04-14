import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, User } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import MobileHeader from "@/components/mobile/MobileHeader";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import logo from "@/assets/logo.svg";

const MobileLogin = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();

  useEffect(() => {
    if (user) navigate("/mitt-konto", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, name);
      }
      navigate("/mitt-konto");
    } catch (error: any) {
      toast.error(error.message || "Ett fel uppstod. Försök igen.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-32 bg-background">
      <MobileHeader />

      <main className="max-w-2xl mx-auto px-6 pt-4">
        {/* Logo + Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center py-8"
        >
          <img src={logo} alt="Unestål Education" className="h-20 w-auto mb-6" />
          <h1 className="font-display text-2xl font-bold text-foreground text-center">
            {isLogin ? "Välkommen tillbaka" : "Skapa ditt konto"}
          </h1>
          <p className="text-muted-foreground text-sm mt-2 text-center">
            {isLogin
              ? "Logga in för att komma åt dina program"
              : "Registrera dig för att komma igång"}
          </p>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl shadow-sm p-6 space-y-5"
        >
          {/* Tabs */}
          <div className="flex bg-muted rounded-xl p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                isLogin
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Logga in
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                !isLogin
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Skapa konto
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Ditt namn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 h-12 rounded-xl"
                  required={!isLogin}
                  disabled={isLoading}
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="din@email.se"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 rounded-xl"
                required
                disabled={isLoading}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12 rounded-xl"
                required
                minLength={6}
                disabled={isLoading}
              />
            </div>

            {isLogin && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Glömt lösenord?
                </Link>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {isLogin ? "Loggar in..." : "Skapar konto..."}
                </span>
              ) : isLogin ? (
                "Logga in"
              ) : (
                "Skapa konto"
              )}
            </Button>
          </form>
        </motion.div>

        <p className="text-center text-xs text-muted-foreground mt-6 px-4">
          Genom att logga in godkänner du våra{' '}
          <Link to="/villkor" className="text-primary hover:underline">villkor</Link>
          {' '}och{' '}
          <Link to="/integritetspolicy" className="text-primary hover:underline">integritetspolicy</Link>.
        </p>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileLogin;
