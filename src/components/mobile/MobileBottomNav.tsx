import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Compass, Brain, Newspaper, ShoppingBag, User } from "lucide-react";

interface NavItemProps {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center transition-all duration-300 px-4 py-1.5 rounded-xl ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium tracking-wide uppercase mt-1 font-body">
        {label}
      </span>
    </button>
  );
}

const TAB_ROUTES: Record<string, string> = {
  explore: "/",
  news: "/aktuellt",
  programs: "/mina-program",
  shop: "/produkter",
  account: "/mitt-konto",
};

const ROUTE_TABS: Record<string, string> = {
  "/": "explore",
  "/aktuellt": "news",
  "/mina-program": "programs",
  "/produkter": "shop",
  "/mitt-konto": "account",
};

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = ROUTE_TABS[location.pathname] || "explore";

  const handleTabChange = (tab: string) => {
    const route = TAB_ROUTES[tab];
    if (route) navigate(route);
  };

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 backdrop-blur-xl bg-background/80 border-t border-border flex justify-around items-center px-4 pb-8 pt-4">
      <NavItem icon={<Compass className="w-5 h-5" />} label="Upptäck" active={activeTab === "explore"} onClick={() => handleTabChange("explore")} />
      <NavItem icon={<Newspaper className="w-5 h-5" />} label="Aktuellt" active={activeTab === "news"} onClick={() => handleTabChange("news")} />
      <NavItem icon={<Brain className="w-5 h-5" />} label="Program" active={activeTab === "programs"} onClick={() => handleTabChange("programs")} />
      <NavItem icon={<ShoppingBag className="w-5 h-5" />} label="Butik" active={activeTab === "shop"} onClick={() => handleTabChange("shop")} />
      <NavItem icon={<User className="w-5 h-5" />} label="Konto" active={activeTab === "account"} onClick={() => handleTabChange("account")} />
    </nav>
  );
};

export default MobileBottomNav;
