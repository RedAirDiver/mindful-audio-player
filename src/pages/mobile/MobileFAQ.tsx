import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

const faqItems = [
  { question: "Vad är mentalträning?", answer: "Mentalträning är en systematisk metod för att träna sinnet, precis som fysisk träning stärker kroppen. Genom guidade övningar som visualisering, avslappning och positiva affirmationer kan du förbättra fokus, hantera stress och nå dina mål effektivare." },
  { question: "Hur fungerar programmen?", answer: "Våra program består av inspelade ljudfiler som du lyssnar på i din egen takt. Varje program innehåller flera sessioner som bygger på varandra. Du kan lyssna var som helst — hemma, på väg till jobbet eller innan du somnar." },
  { question: "Hur lång tid tar det innan jag märker resultat?", answer: "De flesta upplever en positiv förändring redan efter 1–2 veckor med regelbunden träning. För mer bestående resultat rekommenderar vi att du följer ett program under minst 4–6 veckor." },
  { question: "Kan jag lyssna offline?", answer: "Ja! I vår mobilapp kan du ladda ner ljudfilerna och lyssna helt utan internetuppkoppling. Perfekt för resor eller platser med dålig täckning." },
  { question: "Vilka program passar nybörjare?", answer: "Vi rekommenderar att börja med våra grundläggande avslappningsprogram. De ger en bra introduktion till mentalträning och kräver ingen tidigare erfarenhet. Kolla kategorin 'Avslappning' i vår butik." },
  { question: "Hur avbryter jag mitt konto?", answer: "Du köper enskilda program — det finns inga löpande abonnemang att avbryta. När du har köpt ett program har du livstids tillgång till det." },
  { question: "Kan jag använda programmen på flera enheter?", answer: "Absolut. Logga in med samma konto på webben eller i mobilappen så har du tillgång till alla dina köpta program oavsett enhet." },
  { question: "Är mentalträning vetenskapligt bevisat?", answer: "Ja, forskning visar att regelbunden mentalträning kan minska stress, förbättra sömn, öka prestationsförmåga och stärka det mentala välbefinnandet. Våra program bygger på Lars-Eric Unestahls metoder som utvecklats under över 50 års forskning." },
  { question: "Hur fungerar betalningen?", answer: "Vi erbjuder säker betalning via Stripe. Du betalar en engångskostnad per program och får sedan tillgång direkt. Inga dolda avgifter eller återkommande debiteringar." },
  { question: "Vad gör jag om jag har tekniska problem?", answer: "Kontakta oss via e-post eller telefon så hjälper vi dig. Du hittar våra kontaktuppgifter längst ner på sidan. Vi svarar normalt inom 24 timmar på vardagar." },
];

const MobileFAQ = () => {
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
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center gap-3 px-6 py-4">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-display text-lg font-semibold text-foreground">Vanliga frågor</h1>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 pt-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-sm font-medium">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileFAQ;
