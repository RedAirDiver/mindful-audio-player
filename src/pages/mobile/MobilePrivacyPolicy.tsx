import MobileHeader from "@/components/mobile/MobileHeader";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

const MobilePrivacyPolicy = () => {
  return (
    <div className="min-h-screen pb-32 bg-background">
      <MobileHeader />

      <main className="px-5 pt-4 pb-8">
        <h1 className="font-display text-2xl font-bold text-foreground mb-1">Integritetspolicy</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Senast uppdaterad: {new Date().toLocaleDateString("sv-SE")}
        </p>

        <div className="space-y-5 text-sm text-foreground/90 leading-relaxed">
          <section>
            <h2 className="font-semibold text-base text-foreground mb-2">1. Personuppgiftsansvarig</h2>
            <p>
              Unestål Education AB, org.nr 556767-3347, Hagalundsvägen 4, SE-702 30 Örebro, är
              personuppgiftsansvarig för behandlingen av dina personuppgifter i samband med
              användningen av våra tjänster.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground mb-2">2. Vilka uppgifter vi samlar in</h2>
            <p className="mb-2">Vi samlar in och behandlar följande personuppgifter:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Kontouppgifter:</strong> Namn, e-postadress och telefonnummer som du anger vid registrering</li>
              <li><strong>Betalningsinformation:</strong> Betalningsuppgifter hanteras av vår betalningsleverantör Stripe — vi lagrar inga kortuppgifter</li>
              <li><strong>Användningsdata:</strong> Information om hur du använder tjänsten, t.ex. vilka program du lyssnar på och hur länge</li>
              <li><strong>Teknisk data:</strong> IP-adress, webbläsartyp, enhetstyp och operativsystem</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground mb-2">3. Rättslig grund för behandling</h2>
            <p className="mb-2">Vi behandlar dina personuppgifter baserat på följande rättsliga grunder:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Avtal:</strong> Behandling som är nödvändig för att fullgöra vårt avtal med dig</li>
              <li><strong>Berättigat intresse:</strong> Förbättring av våra tjänster och kundkommunikation</li>
              <li><strong>Samtycke:</strong> Analys-cookies och marknadsföring (när tillämpligt)</li>
              <li><strong>Rättslig förpliktelse:</strong> Bokföring och skatteunderlag</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground mb-2">4. Hur vi använder dina uppgifter</h2>
            <p className="mb-2">Dina personuppgifter används för att:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Skapa och hantera ditt konto</li>
              <li>Ge dig tillgång till köpta mentala träningsprogram</li>
              <li>Hantera betalningar och köphistorik</li>
              <li>Skicka orderbekräftelser och tjänsterelaterade meddelanden</li>
              <li>Förbättra och utveckla våra tjänster</li>
              <li>Förebygga bedrägeri och missbruk</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground mb-2">5. Delning av uppgifter</h2>
            <p className="mb-2">
              Vi delar inte dina personuppgifter med tredje part i marknadsföringssyfte. Vi kan dock
              dela uppgifter med:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Betalningsleverantörer:</strong> Stripe, för att hantera betalningar</li>
              <li><strong>Hosting och IT-tjänster:</strong> För drift av vår plattform</li>
              <li><strong>Myndigheter:</strong> Om vi är skyldiga enligt lag</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground mb-2">6. Lagring och säkerhet</h2>
            <p>
              Dina personuppgifter lagras inom EU/EES. Vi vidtar lämpliga tekniska och organisatoriska
              åtgärder för att skydda dina uppgifter mot obehörig åtkomst, förlust eller förstörelse.
              Uppgifterna sparas så länge du har ett aktivt konto hos oss, plus den tid som krävs
              enligt bokföringslagen.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground mb-2">7. Dina rättigheter</h2>
            <p className="mb-2">Enligt GDPR har du följande rättigheter:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Rätt till tillgång:</strong> Begära en kopia av de uppgifter vi har om dig</li>
              <li><strong>Rätt till rättelse:</strong> Begära att felaktiga uppgifter korrigeras</li>
              <li><strong>Rätt till radering:</strong> Begära att vi raderar dina uppgifter</li>
              <li><strong>Rätt till begränsning:</strong> Begära att vi begränsar behandlingen</li>
              <li><strong>Rätt till dataportabilitet:</strong> Få dina uppgifter i ett maskinläsbart format</li>
              <li><strong>Rätt att invända:</strong> Invända mot behandling baserad på berättigat intresse</li>
            </ul>
            <p className="mt-2">Kontakta oss för att utöva dina rättigheter. Vi besvarar din begäran inom 30 dagar.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground mb-2">8. Cookies</h2>
            <p>
              Information om hur vi använder cookies finns i våra användarvillkor.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground mb-2">9. Ändringar i denna policy</h2>
            <p>
              Vi kan uppdatera denna integritetspolicy vid behov. Vid väsentliga ändringar informerar
              vi dig via e-post eller genom ett meddelande i appen.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground mb-2">10. Kontakt</h2>
            <p>Unestål Education AB</p>
            <p>Hagalundsvägen 4, SE-702 30 Örebro</p>
            <p>
              <a href="tel:+46193322033" className="text-primary">+46 (0)19-33 22 33</a>
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground mb-2">11. Tillsynsmyndighet</h2>
            <p>
              Om du inte är nöjd med hur vi hanterar dina personuppgifter har du rätt att lämna
              klagomål till Integritetsskyddsmyndigheten (IMY),{" "}
              <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer" className="text-primary">
                www.imy.se
              </a>.
            </p>
          </section>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobilePrivacyPolicy;
