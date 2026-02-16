import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, User, LogOut, Settings, LinkIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import logo from "@/assets/logo.svg";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { isAdmin } = useAdmin();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setIsMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-24 md:h-28">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Mentalträning" className="h-20 md:h-24 w-auto" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              to="/" 
              className={`text-sm font-medium transition-colors hover:text-primary ${isActive('/') ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Hem
            </Link>
            <Link 
              to="/produkter" 
              className={`text-sm font-medium transition-colors hover:text-primary ${isActive('/produkter') ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Produkter
            </Link>
            <Link 
              to="/about" 
              className={`text-sm font-medium transition-colors hover:text-primary ${isActive('/about') ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Om oss
            </Link>
            <Link 
              to="/bli-affiliate" 
              className={`text-sm font-medium transition-colors hover:text-primary ${isActive('/bli-affiliate') ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Bli Affiliate
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {!loading && (
              user ? (
                <>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/admin">
                        <Settings className="w-4 h-4 mr-1" />
                        Admin
                      </Link>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/dashboard">
                      <User className="w-4 h-4 mr-1" />
                      Mitt konto
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-1" />
                    Logga ut
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/login">Logga in</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link to="/login">
                      <User className="w-4 h-4 mr-1" />
                      Skapa konto
                    </Link>
                  </Button>
                </>
              )
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-background border-b border-border animate-fade-in">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-3">
            <Link 
              to="/" 
              className="py-2 text-foreground font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Hem
            </Link>
            <Link 
              to="/produkter" 
              className="py-2 text-foreground font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Produkter
            </Link>
            <Link 
              to="/about" 
              className="py-2 text-foreground font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Om oss
            </Link>
            <Link 
              to="/bli-affiliate" 
              className="py-2 text-foreground font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Bli Affiliate
            </Link>
            <div className="pt-3 border-t border-border flex flex-col gap-2">
              {user ? (
                <>
                  {isAdmin && (
                    <Button variant="outline" asChild>
                      <Link to="/admin" onClick={() => setIsMenuOpen(false)}>
                        <Settings className="w-4 h-4 mr-1" />
                        Admin
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>Mitt konto</Link>
                  </Button>
                  <Button onClick={handleSignOut}>Logga ut</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link to="/login" onClick={() => setIsMenuOpen(false)}>Logga in</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/login" onClick={() => setIsMenuOpen(false)}>Skapa konto</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
