import Header from "@/components/Header";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-28 md:pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-3xl prose prose-neutral dark:prose-invert prose-headings:font-serif">
          <h1>Integritetspolicy</h1>
          <p className="text-muted-foreground">Senast uppdaterad: {new Date().toLocaleDateString("sv-SE")}</p>

          <h2>1. Personuppgiftsansvarig</h2>
          <p>
            Unestål Education AB, org.nr 556XXX-XXXX, Hagalundsvägen 4, SE-702 30 Örebro, är
            personuppgiftsansvarig för behandlingen av dina personuppgifter i samband med
            användningen av våra tjänster.
          </p>

          <h2>2. Vilka uppgifter vi samlar in</h2>
          <p>Vi samlar in och behandlar följande personuppgifter:</p>
          <ul>
            <li><strong>Kontouppgifter:</strong> Namn, e-postadress och telefonnummer som du anger vid registrering</li>
            <li><strong>Betalningsinformation:</strong> Betalningsuppgifter hanteras av vår betalningsleverantör Stripe — vi lagrar inga kortuppgifter</li>
            <li><strong>Användningsdata:</strong> Information om hur du använder tjänsten, t.ex. vilka program du lyssnar på och hur länge</li>
            <li><strong>Teknisk data:</strong> IP-adress, webbläsartyp, enhetstyp och operativsystem</li>
          </ul>

          <h2>3. Rättslig grund för behandling</h2>
          <p>Vi behandlar dina personuppgifter baserat på följande rättsliga grunder:</p>
          <ul>
            <li><strong>Avtal:</strong> Behandling som är nödvändig för att fullgöra vårt avtal med dig (t.ex. leverans av köpta program)</li>
            <li><strong>Berättigat intresse:</strong> Förbättring av våra tjänster och kundkommunikation</li>
            <li><strong>Samtycke:</strong> Analys-cookies och marknadsföring (när tillämpligt)</li>
            <li><strong>Rättslig förpliktelse:</strong> Bokföring och skatteunderlag</li>
          </ul>

          <h2>4. Hur vi använder dina uppgifter</h2>
          <p>Dina personuppgifter används för att:</p>
          <ul>
            <li>Skapa och hantera ditt konto</li>
            <li>Ge dig tillgång till köpta mentala träningsprogram</li>
            <li>Hantera betalningar och köphistorik</li>
            <li>Skicka orderbekräftelser och tjänsterelaterade meddelanden</li>
            <li>Förbättra och utveckla våra tjänster</li>
            <li>Förebygga bedrägeri och missbruk</li>
          </ul>

          <h2>5. Delning av uppgifter</h2>
          <p>
            Vi delar inte dina personuppgifter med tredje part i marknadsföringssyfte. Vi kan dock
            dela uppgifter med:
          </p>
          <ul>
            <li><strong>Betalningsleverantörer:</strong> Stripe, för att hantera betalningar</li>
            <li><strong>Hosting och IT-tjänster:</strong> För drift av vår plattform</li>
            <li><strong>Myndigheter:</strong> Om vi är skyldiga enligt lag</li>
          </ul>

          <h2>6. Lagring och säkerhet</h2>
          <p>
            Dina personuppgifter lagras inom EU/EES. Vi vidtar lämpliga tekniska och organisatoriska
            åtgärder för att skydda dina uppgifter mot obehörig åtkomst, förlust eller förstörelse.
            Uppgifterna sparas så länge du har ett aktivt konto hos oss, plus den tid som krävs
            enligt bokföringslagen.
          </p>

          <h2>7. Dina rättigheter</h2>
          <p>Enligt GDPR har du följande rättigheter:</p>
          <ul>
            <li><strong>Rätt till tillgång:</strong> Du kan begära en kopia av de uppgifter vi har om dig</li>
            <li><strong>Rätt till rättelse:</strong> Du kan begära att felaktiga uppgifter korrigeras</li>
            <li><strong>Rätt till radering:</strong> Du kan begära att vi raderar dina uppgifter ("rätten att bli glömd")</li>
            <li><strong>Rätt till begränsning:</strong> Du kan begära att vi begränsar behandlingen av dina uppgifter</li>
            <li><strong>Rätt till dataportabilitet:</strong> Du kan begära att få dina uppgifter i ett maskinläsbart format</li>
            <li><strong>Rätt att invända:</strong> Du kan invända mot behandling baserad på berättigat intresse</li>
          </ul>
          <p>
            Kontakta oss för att utöva dina rättigheter. Vi besvarar din begäran inom 30 dagar.
          </p>

          <h2>8. Cookies</h2>
          <p>
            Information om hur vi använder cookies finns i våra{" "}
            <a href="/villkor" className="text-primary hover:underline">användarvillkor</a>.
          </p>

          <h2>9. Ändringar i denna policy</h2>
          <p>
            Vi kan uppdatera denna integritetspolicy vid behov. Vid väsentliga ändringar informerar
            vi dig via e-post eller genom ett meddelande på webbplatsen.
          </p>

          <h2>10. Kontakt</h2>
          <p>
            Om du har frågor om hur vi hanterar dina personuppgifter, kontakta oss:
          </p>
          <ul>
            <li>Unestål Education AB</li>
            <li>Hagalundsvägen 4, SE-702 30 Örebro</li>
            <li>Telefon: +46 (0)19-33 22 33</li>
          </ul>

          <h2>11. Tillsynsmyndighet</h2>
          <p>
            Om du inte är nöjd med hur vi hanterar dina personuppgifter har du rätt att lämna
            klagomål till Integritetsskyddsmyndigheten (IMY), <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.imy.se</a>.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
