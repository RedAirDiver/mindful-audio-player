import { Link, useSearchParams } from "react-router-dom";
import { MapPin, Phone, Mail } from "lucide-react";
import { useIsMobileLayout } from "@/hooks/useCapacitor";
import logo from "@/assets/logo.png";

const Footer = () => {
  const isMobile = useIsMobileLayout();
  const [searchParams] = useSearchParams();
  const layoutParam = searchParams.get("layout");

  // Preserve ?layout=mobile param on all links
  const mLink = (path: string) => {
    if (layoutParam) return `${path}?layout=${layoutParam}`;
    return path;
  };

  return (
    <footer className="bg-foreground text-background/80 py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <img src={logo} alt="Mentalträning" className="h-20 md:h-24 w-auto" />
            <p className="mt-4 text-sm leading-relaxed opacity-70">
              Professionell mental träning för ett bättre liv. Utveckla ditt sinne med våra guidade mentala träningsprogram.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold text-background mb-4">Navigation</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to={mLink("/")} className="hover:text-background transition-colors">Hem</Link></li>
              <li><Link to={mLink("/produkter")} className="hover:text-background transition-colors">Mentala Träningsprogram</Link></li>
              <li><Link to={mLink("/about")} className="hover:text-background transition-colors">Om oss</Link></li>
              <li><Link to={mLink("/faq")} className="hover:text-background transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="font-semibold text-background mb-4">Konto</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to={mLink("/login")} className="hover:text-background transition-colors">Logga in</Link></li>
              <li><Link to={mLink("/login")} className="hover:text-background transition-colors">Skapa konto</Link></li>
              <li><Link to={mLink(isMobile ? "/mitt-konto" : "/dashboard")} className="hover:text-background transition-colors">Mina mentala träningsprogram</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold text-background mb-4">Kontakt</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                <span>
                  Unestål Education<br />
                  Hagalundsvägen 4<br />
                  SE-702 30 Örebro
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0 opacity-70" />
                <a href="tel:+461933​2233" className="hover:text-background transition-colors">
                  +46 (0)19-33 22 33
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0 opacity-70" />
                <Link to={mLink("/about")} className="hover:text-background transition-colors">
                  Kontakta oss
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-background/10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm opacity-60">
          <p>© {new Date().getFullYear()} Mentalträning. Alla rättigheter förbehållna.</p>
          <div className="flex gap-4">
            <Link to={mLink("/villkor")} className="hover:text-background transition-colors">Användarvillkor &amp; Cookies</Link>
            <Link to={mLink("/integritetspolicy")} className="hover:text-background transition-colors">Integritetspolicy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
