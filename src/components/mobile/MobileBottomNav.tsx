import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Compass, Brain, ShoppingBag, User } from "lucide-react";

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
  programs: "/dashboard",
  shop: "/produkter",
  account: "/mitt-konto",
};

const ROUTE_TABS: Record<string, string> = {
  "/": "explore",
  "/dashboard": "programs",
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
      <NavItem icon={<Compass className="w-6 h-6" />} label="Upptäck" active={activeTab === "explore"} onClick={() => handleTabChange("explore")} />
      <NavItem icon={<Brain className="w-6 h-6" />} label="Mina Program" active={activeTab === "programs"} onClick={() => handleTabChange("programs")} />
      <NavItem icon={<ShoppingBag className="w-6 h-6" />} label="Butik" active={activeTab === "shop"} onClick={() => handleTabChange("shop")} />
      <NavItem icon={<User className="w-6 h-6" />} label="Mitt Konto" active={activeTab === "account"} onClick={() => handleTabChange("account")} />
    </nav>
  );
};

export default MobileBottomNav;
