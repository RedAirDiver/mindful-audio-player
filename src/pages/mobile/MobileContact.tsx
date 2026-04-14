import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { toast } from "sonner";

const MobileContact = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const [name, setName] = useState(user?.user_metadata?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Fyll i alla fält");
      return;
    }
    setLoading(true);

    try {
      const mailtoLink = `mailto:info@unestal.se?subject=${encodeURIComponent(`Supportärende från ${name}`)}&body=${encodeURIComponent(`Namn: ${name}\nE-post: ${email}\n\n${message}`)}`;
      window.location.href = mailtoLink;
      toast.success("E-postklienten öppnas...");
      setMessage("");
    } catch {
      toast.error("Något gick fel. Försök igen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-32 bg-background" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center gap-3 px-6 py-4">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-display text-lg font-semibold text-foreground">Kontakta Support</h1>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 pt-6">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-6 shadow-sm"
        >
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Beskriv ditt ärende nedan så återkommer vi så snart vi kan. Du kan även nå oss på{" "}
            <a href="tel:+46193322333" className="text-primary font-medium">+46 (0)19-33 22 33</a>.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Namn</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ditt namn" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">E-post</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="din@epost.se" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Meddelande</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Beskriv ditt ärende..."
                rows={5}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              <Send className="w-4 h-4 mr-2" />
              {loading ? "Skickar..." : "Skicka meddelande"}
            </Button>
          </form>
        </motion.section>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileContact;
