import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Phone } from "lucide-react";
import { motion } from "motion/react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

const MobileAbout = () => {
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

  return (
    <div className="min-h-screen pb-32 bg-background" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center gap-3 px-6 py-4">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-display text-lg font-semibold text-foreground">Om oss</h1>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 pt-6 space-y-6">
        {/* About Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-6 shadow-sm"
        >
          <h2 className="font-display text-xl font-bold text-foreground mb-4">
            Unestål Education AB
          </h2>

          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              Skandinaviska Ledarhögskolan SLH, som i nov 2019 bytte namn till Unestål Education, grundades 1990 av Fil.Dr. Lars-Eric Uneståhl som en non-profitorganisation med visionen "Utbildning och träning för en bättre värld". Våra utbildningar är inriktade på ledarskap, personlig utveckling och utveckling av yrkeskompetens och livskvalitet hos individer, team och organisationer. Vår målgrupp är enskilda individer, företag och offentliga sektorn.
            </p>
            <p>
              2006 ombildades Skandinaviska Ledarhögskolan till ett aktiebolag men med samma vision och av grundaren.
            </p>
            <p>
              2012 bytte företaget ägare från Lars-Eric Uneståhl till Elene Unestål.
            </p>
            <p>
              2019 bytte företaget namn till Unestål Education AB (samma organisationsnr).
            </p>
            <p>
              Huvudkontoret finns i Örebro, men vi håller utbildningar över hela världen där våra kunder befinner sig.
            </p>
            <p>
              Vi har kursgårdar i Thailand och Costa Rica där vi håller ett antal kurser i personlig utveckling, coaching, kommunikation, stresshantering, mental träning och ledarskap.
            </p>
            <p>
              Vi har ett nätverk av konsulter, coacher och mentala tränare som ger att vi i alla lägen kan erbjuda större lösningar till företag, som ställer höga förväntningar på leveranskapacitet.
            </p>
            <p>
              Vi har en egen databas med personal med olika kompetenser där vi kan välja rätt person för rätt uppdrag.
            </p>
          </div>
        </motion.section>

        {/* Contact Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl p-6 shadow-sm"
        >
          <h2 className="font-display text-xl font-bold text-foreground mb-4">
            Kontakt
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground">Unestål Education</p>
                <p>Hagalundsvägen 4</p>
                <p>SE-702 30 Örebro</p>
              </div>
            </div>

            <a href="tel:+46193322333" className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <Phone className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground">+46 (0)19-33 22 33</span>
            </a>
          </div>
        </motion.section>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileAbout;
