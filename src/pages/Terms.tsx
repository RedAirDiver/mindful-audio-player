import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Terms = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-28 md:pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-3xl prose prose-neutral dark:prose-invert">
          <h1>Användarvillkor</h1>
          <p className="text-muted-foreground">Senast uppdaterad: {new Date().toLocaleDateString("sv-SE")}</p>

          <h2>1. Allmänt</h2>
          <p>
            Dessa användarvillkor gäller för alla tjänster som tillhandahålls av Unestål Education AB
            ("vi", "oss", "vår") via webbplatsen mentaltraning.lovable.app och tillhörande mobilapp.
            Genom att använda våra tjänster accepterar du dessa villkor i sin helhet.
          </p>

          <h2>2. Konto och registrering</h2>
          <p>
            För att få tillgång till köpta program behöver du skapa ett konto. Du ansvarar för att
            hålla dina inloggningsuppgifter konfidentiella och för all aktivitet som sker via ditt
            konto. Du måste vara minst 18 år eller ha vårdnadshavares samtycke för att skapa ett konto.
          </p>

          <h2>3. Köp och betalning</h2>
          <p>
            Alla priser anges i svenska kronor (SEK) inklusive moms. Betalning sker via Stripe och
            är en engångsbetalning per program. Efter genomfört köp får du omedelbar och livstids
            tillgång till det köpta programmet. Vi erbjuder ingen återbetalning på digitala produkter
            efter att du har fått tillgång till innehållet, i enlighet med distansavtalslagen.
          </p>

          <h2>4. Användning av innehåll</h2>
          <p>
            Allt innehåll — inklusive ljudfiler, texter, bilder och varumärken — ägs av Unestål
            Education AB och skyddas av upphovsrätt. Du får en personlig, icke-överförbar licens att
            använda köpta program för eget bruk. Du får inte:
          </p>
          <ul>
            <li>Kopiera, distribuera eller dela innehållet med tredje part</li>
            <li>Använda innehållet i kommersiellt syfte</li>
            <li>Ladda ner, spela in eller på annat sätt reproducera ljudfilerna utanför appen</li>
            <li>Använda automatiserade verktyg för att hämta innehåll från tjänsten</li>
          </ul>

          <h2>5. Cookies</h2>
          <p>
            Vår webbplats använder cookies och liknande tekniker för att förbättra din upplevelse.
            Cookies är små textfiler som lagras på din enhet.
          </p>
          <h3>Nödvändiga cookies</h3>
          <p>
            Dessa krävs för att tjänsten ska fungera, t.ex. för att hålla dig inloggad och hantera
            din kundvagn. De kan inte stängas av.
          </p>
          <h3>Analys-cookies</h3>
          <p>
            Vi använder analys-cookies för att förstå hur besökare använder webbplatsen, vilket
            hjälper oss att förbättra upplevelsen. Denna data är anonymiserad.
          </p>
          <h3>Hantera cookies</h3>
          <p>
            Du kan hantera eller blockera cookies via din webbläsares inställningar. Observera att
            blockering av nödvändiga cookies kan påverka tjänstens funktionalitet.
          </p>

          <h2>6. Personuppgifter och integritet</h2>
          <p>
            Vi behandlar dina personuppgifter i enlighet med GDPR (EU:s dataskyddsförordning). Vi
            samlar in följande uppgifter:
          </p>
          <ul>
            <li>Namn, e-postadress och telefonnummer vid registrering</li>
            <li>Betalningsinformation (hanteras av Stripe, vi lagrar inga kortuppgifter)</li>
            <li>Användningsdata för att förbättra tjänsten</li>
          </ul>
          <p>
            Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter.
            Kontakta oss för att utöva dina rättigheter.
          </p>

          <h2>7. Ansvarsbegränsning</h2>
          <p>
            Våra mentalträningsprogram är avsedda som komplement till en hälsosam livsstil och
            ersätter inte medicinsk rådgivning eller behandling. Vi ansvarar inte för eventuella
            skador som uppstår till följd av användning av våra program. Konsultera alltid en
            vårdgivare vid medicinska frågor.
          </p>

          <h2>8. Affiliate-program</h2>
          <p>
            Deltagande i vårt affiliate-program regleras av separata villkor. Affiliates får inte
            använda vilseledande marknadsföring eller göra medicinska påståenden om våra produkter.
            Vi förbehåller oss rätten att avsluta affiliate-konton som bryter mot dessa villkor.
          </p>

          <h2>9. Ändringar av villkor</h2>
          <p>
            Vi förbehåller oss rätten att uppdatera dessa villkor. Vid väsentliga ändringar
            informerar vi dig via e-post eller genom ett meddelande på webbplatsen. Fortsatt
            användning efter ändringar innebär att du accepterar de uppdaterade villkoren.
          </p>

          <h2>10. Kontakt</h2>
          <p>
            Om du har frågor om dessa villkor, kontakta oss:
          </p>
          <ul>
            <li>Unestål Education AB</li>
            <li>Hagalundsvägen 4, SE-702 30 Örebro</li>
            <li>Telefon: +46 (0)19-33 22 33</li>
          </ul>

          <h2>11. Tillämplig lag</h2>
          <p>
            Dessa villkor regleras av svensk lag. Eventuella tvister ska i första hand lösas genom
            förhandling. Om enighet inte kan nås avgörs tvisten av svensk domstol.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;
