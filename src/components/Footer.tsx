import { Link } from "react-router-dom";
import logo from "@/assets/logo.svg";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background/80 py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <img src={logo} alt="Mentalträning" className="h-12 w-auto brightness-0 invert opacity-90" />
            <p className="mt-4 text-sm leading-relaxed opacity-70">
              Professionell mental träning för ett bättre liv. Utveckla ditt sinne med våra guidade program.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold text-background mb-4">Navigation</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/" className="hover:text-background transition-colors">Hem</Link></li>
              <li><Link to="/programs" className="hover:text-background transition-colors">Program</Link></li>
              <li><Link to="/about" className="hover:text-background transition-colors">Om oss</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="font-semibold text-background mb-4">Konto</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/login" className="hover:text-background transition-colors">Logga in</Link></li>
              <li><Link to="/login" className="hover:text-background transition-colors">Skapa konto</Link></li>
              <li><Link to="/dashboard" className="hover:text-background transition-colors">Mina program</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-background mb-4">Information</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/privacy" className="hover:text-background transition-colors">Integritetspolicy</Link></li>
              <li><Link to="/terms" className="hover:text-background transition-colors">Villkor</Link></li>
              <li><Link to="/contact" className="hover:text-background transition-colors">Kontakt</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-background/10 text-center text-sm opacity-60">
          <p>© {new Date().getFullYear()} Mentalträning. Alla rättigheter förbehållna.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
