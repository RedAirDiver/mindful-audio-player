import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Mail, Tag, Megaphone } from "lucide-react";
import { motion } from "motion/react";
import { Switch } from "@/components/ui/switch";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface NotificationPrefs {
  purchases: boolean;
  news: boolean;
  offers: boolean;
  email: boolean;
}

const STORAGE_KEY = "mentaltraning:notification-prefs";

const defaultPrefs: NotificationPrefs = {
  purchases: true,
  news: true,
  offers: false,
  email: true,
};

const MobileNotifications = () => {
  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultPrefs, ...JSON.parse(stored) } : defaultPrefs;
    } catch {
      return defaultPrefs;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (deltaX > 100 && deltaY < 80) navigate(-1);
  };

  const items: { key: keyof NotificationPrefs; icon: typeof Bell; label: string; desc: string }[] = [
    { key: "purchases", icon: Tag, label: "Köp & kvitton", desc: "Bekräftelser och kvitton för dina köp" },
    { key: "news", icon: Megaphone, label: "Nyheter", desc: "Nya program och uppdateringar" },
    { key: "offers", icon: Tag, label: "Erbjudanden", desc: "Rabatter och specialerbjudanden" },
    { key: "email", icon: Mail, label: "E-postnotiser", desc: "Få notiser via e-post" },
  ];

  return (
    <div className="min-h-screen pb-32 bg-background" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center gap-3 px-6 py-4">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-display text-lg font-semibold text-foreground">Notiser</h1>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 pt-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-6 shadow-sm">
          <div className="space-y-5">
            {items.map(({ key, icon: Icon, label, desc }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <Icon className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <Switch checked={prefs[key]} onCheckedChange={() => toggle(key)} />
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileNotifications;
