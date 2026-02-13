import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { toast } from "sonner";

const About = () => {
  const [contactOpen, setContactOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    // Simulate sending
    await new Promise((r) => setTimeout(r, 1000));
    setSending(false);
    setContactOpen(false);
    toast.success("Tack för ditt meddelande! Vi återkommer så snart vi kan.");
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-28 md:pt-32">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary/10 via-secondary/30 to-background py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-4xl">
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
              Om oss
            </h1>
            <p className="text-lg text-muted-foreground">
              Unestål Education AB — Utbildning och träning för en bättre värld
            </p>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4 max-w-4xl space-y-12">
            {/* Company Intro */}
            <div className="prose prose-lg max-w-none">
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                Unestål Education AB
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Skandinaviska Ledarhögskolan SLH, som i nov 2019 bytte namn till
                Unestål Education, grundades 1990 av Fil.Dr. Lars-Eric Uneståhl
                som en non-profitorganisation med visionen "Utbildning och träning
                för en bättre värld". Våra utbildningar är inriktade på ledarskap,
                personlig utveckling och utveckling av yrkeskompetens och
                livskvalitet hos individer, team och organisationer. Vår målgrupp
                är enskilda individer, företag och offentliga sektorn.
              </p>

              <ul className="space-y-3 text-muted-foreground">
                <li>
                  2006 ombildades Skandinaviska Ledarhögskolan till ett aktiebolag
                  men med samma vision och av grundaren.
                </li>
                <li>
                  2012 bytte företaget ägare från Lars-Eric Uneståhl till Elene
                  Unestål.
                </li>
                <li>
                  2019 bytte företaget namn till Unestål Education AB (samma
                  organisationsnr).
                </li>
                <li>
                  Huvudkontoret finns i Örebro, men vi håller utbildningar över
                  hela världen där våra kunder befinner sig.
                </li>
                <li>
                  Vi har kursgårdar i Thailand och Costa Rica där vi håller ett
                  antal kurser i personlig utveckling, coaching, kommunikation,
                  stresshantering, mental träning och ledarskap.
                </li>
                <li>
                  Vi har ett nätverk av konsulter, coacher och mentala tränare som
                  ger att vi i alla lägen kan erbjuda större lösningar till
                  företag, som ställer höga förväntningar på leveranskapacitet.
                </li>
                <li>
                  Vi har en egen databas med personal med olika kompetenser där vi
                  kan välja rätt person för rätt uppdrag.
                </li>
              </ul>
            </div>

            {/* Quality */}
            <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-sm space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Allt vårt arbete präglas av vår omtanke om våra kunder. Fokus i
                vårt kvalitetsarbete är omtanke, trygghet, hållbarhet, hälsa och
                lönsamhet i en kombination.
              </p>
              <ul className="space-y-3 text-muted-foreground text-sm">
                <li>
                  Vår prioritet är god kunskap, enkelhet i administration och kund
                  nöjdhet. Detta ger ett mervärde för våra kunder och för
                  företaget.
                </li>
                <li>
                  I vår kvalitetspolicy finns angivet: "Vi möter våra kunder med
                  helhjärtat engagemang, fokus och på ett professionellt sätt. Med
                  vårt fokus ger vi mervärde – först genom ett säkert
                  kvalitetsarbete internt i företaget och sedan genom att leverera
                  kvalitet i våra utbildningar. Vårt kvalitetsarbete präglas
                  ständigt av vår vilja att leverera bättre lösningar, snabbare
                  svar och enklare administration, alltså en enkelhet och trygghet
                  för dig som kund."
                </li>
                <li>
                  Vi har antagit kvalitetspolicy, och vårt miljöarbete på
                  ledningsnivå i företaget och håller kontinuerligt uppdateringar
                  av vårt kvalitetsarbete.
                </li>
              </ul>
            </div>

            {/* Vision, Mission, etc. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <h3 className="font-serif text-xl font-semibold text-foreground">
                  Vår vision
                </h3>
                <p className="text-muted-foreground italic">
                  "Utbildning och träning för en bättre värld"
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-xl font-semibold text-foreground">
                  Mission
                </h3>
                <p className="text-muted-foreground">
                  Att hjälpa varje människa att upptäcka, utveckla och använda sina
                  resurser för att genom den mentala träningen nå sin egentliga
                  potential.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-xl font-semibold text-foreground">
                  Affärsidé
                </h3>
                <p className="text-muted-foreground">
                  Att erbjuda forsknings- och träningsbaserade metoder som leder
                  till personlig-, team-, ledar- och organisatorisk excellens.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-xl font-semibold text-foreground">
                  Värdeord
                </h3>
                <p className="text-muted-foreground font-medium">
                  Empowerment – Engagemang – Gemenskap – Tacksamhet
                </p>
              </div>
            </div>

            {/* Business model */}
            <div className="space-y-3">
              <h3 className="font-serif text-xl font-semibold text-foreground">
                Verksamhetsmodell
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Unestål Education vill öka sambandet mellan Framgång i Utbildning
                (Kunskap) och Framgång i Livet (Kompetens) genom sin Läropyramid:
                ATT LÄRA – I/OM/FÖR/FRÅN/UNDER HELA – LIVET.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Att fortsätta utveckla och vara först med det senaste inom teknik
                för utbildning och yrken som t.ex. Licensierad Mental Tränare,
                Certifierad Internationell Coach, Certifierad Internationell Team
                Coach, Certifierad Internationell Executive Coach, Certifierad
                Internationell Business Coach, Internationell Life Coach,
                Diplomerad Stress Manager, Certifierad Stress Coach, Certifierad
                kommunikations konsult, Certifierad Hypnos Coach, excellent
                Ledarskap, Diplomerad Sportcoach.
              </p>
            </div>

            {/* Founders */}
            <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-sm space-y-4">
              <h3 className="font-serif text-xl font-semibold text-foreground">
                Unestål Education AB
              </h3>
              <p className="text-muted-foreground">
                Lars-Eric Uneståhl är grundare av och aktiv på Unestål Education
                AB. Driver och äger företaget gör Elene Unestål.
              </p>
              <p className="text-muted-foreground">
                Har du några frågor? Kontakta oss gärna!
              </p>
              <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Mail className="w-4 h-4" />
                    Kontakta oss
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-serif text-xl">
                      Kontakta oss
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Namn</Label>
                      <Input
                        id="contact-name"
                        name="name"
                        placeholder="Ditt namn"
                        required
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-email">E-post</Label>
                      <Input
                        id="contact-email"
                        name="email"
                        type="email"
                        placeholder="din@epost.se"
                        required
                        maxLength={255}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-message">Meddelande</Label>
                      <Textarea
                        id="contact-message"
                        name="message"
                        placeholder="Skriv ditt meddelande här..."
                        rows={4}
                        required
                        maxLength={2000}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={sending}
                      className="w-full gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {sending ? "Skickar..." : "Skicka meddelande"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              <p className="text-muted-foreground text-sm italic">
                Vänliga hälsningar Elene och Lars-Eric Uneståhl
              </p>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">Adress</p>
                  <p className="text-muted-foreground text-sm">
                    Unestål Education
                    <br />
                    Hagalundsvägen 4
                    <br />
                    SE-702 30 Örebro
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">Telefon</p>
                  <p className="text-muted-foreground text-sm">
                    +46 (0)19-33 22 33
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">Kontakt</p>
                  <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                    <DialogTrigger asChild>
                      <button className="text-primary text-sm hover:underline">
                        Skicka ett meddelande →
                      </button>
                    </DialogTrigger>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default About;
