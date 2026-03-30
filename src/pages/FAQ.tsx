import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    question: "Vad är mentalträning?",
    answer:
      "Mentalträning är en systematisk metod för att träna sinnet, precis som fysisk träning stärker kroppen. Genom guidade övningar som visualisering, avslappning och positiva affirmationer kan du förbättra fokus, hantera stress och nå dina mål effektivare.",
  },
  {
    question: "Hur fungerar programmen?",
    answer:
      "Våra program består av inspelade ljudfiler som du lyssnar på i din egen takt. Varje program innehåller flera sessioner som bygger på varandra. Du kan lyssna var som helst — hemma, på väg till jobbet eller innan du somnar.",
  },
  {
    question: "Hur lång tid tar det innan jag märker resultat?",
    answer:
      "De flesta upplever en positiv förändring redan efter 1–2 veckor med regelbunden träning. För mer bestående resultat rekommenderar vi att du följer ett program under minst 4–6 veckor.",
  },
  {
    question: "Kan jag lyssna offline?",
    answer:
      "Ja! I vår mobilapp kan du ladda ner ljudfilerna och lyssna helt utan internetuppkoppling. Perfekt för resor eller platser med dålig täckning.",
  },
  {
    question: "Vilka program passar nybörjare?",
    answer:
      "Vi rekommenderar att börja med våra grundläggande avslappningsprogram. De ger en bra introduktion till mentalträning och kräver ingen tidigare erfarenhet. Kolla kategorin 'Avslappning' i vår butik.",
  },
  {
    question: "Hur avbryter jag mitt konto?",
    answer:
      "Du köper enskilda program — det finns inga löpande abonnemang att avbryta. När du har köpt ett program har du livstids tillgång till det.",
  },
  {
    question: "Kan jag använda programmen på flera enheter?",
    answer:
      "Absolut. Logga in med samma konto på webben eller i mobilappen så har du tillgång till alla dina köpta program oavsett enhet.",
  },
  {
    question: "Är mentalträning vetenskapligt bevisat?",
    answer:
      "Ja, forskning visar att regelbunden mentalträning kan minska stress, förbättra sömn, öka prestationsförmåga och stärka det mentala välbefinnandet. Våra program bygger på Lars-Eric Unestahls metoder som utvecklats under över 50 års forskning.",
  },
  {
    question: "Hur fungerar betalningen?",
    answer:
      "Vi erbjuder säker betalning via Stripe. Du betalar en engångskostnad per program och får sedan tillgång direkt. Inga dolda avgifter eller återkommande debiteringar.",
  },
  {
    question: "Vad gör jag om jag har tekniska problem?",
    answer:
      "Kontakta oss via e-post eller telefon så hjälper vi dig. Du hittar våra kontaktuppgifter längst ner på sidan. Vi svarar normalt inom 24 timmar på vardagar.",
  },
];

const FAQ = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-28 md:pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">
            Vanliga frågor
          </h1>
          <p className="text-muted-foreground mb-10 font-body">
            Här hittar du svar på de vanligaste frågorna om mentalträning och våra program.
          </p>

          <Accordion type="single" collapsible className="w-full font-body">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-base font-body font-medium">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed font-body">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FAQ;
