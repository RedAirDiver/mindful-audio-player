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

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const MobileBottomNav = ({ activeTab, onTabChange }: MobileBottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 backdrop-blur-xl bg-background/80 border-t border-border flex justify-around items-center px-4 pb-8 pt-4">
      <NavItem
        icon={<Compass className="w-6 h-6" />}
        label="Upptäck"
        active={activeTab === "explore"}
        onClick={() => onTabChange("explore")}
      />
      <NavItem
        icon={<Brain className="w-6 h-6" />}
        label="Mina Program"
        active={activeTab === "programs"}
        onClick={() => onTabChange("programs")}
      />
      <NavItem
        icon={<ShoppingBag className="w-6 h-6" />}
        label="Butik"
        active={activeTab === "shop"}
        onClick={() => onTabChange("shop")}
      />
      <NavItem
        icon={<User className="w-6 h-6" />}
        label="Mitt Konto"
        active={activeTab === "account"}
        onClick={() => onTabChange("account")}
      />
    </nav>
  );
};

export default MobileBottomNav;
