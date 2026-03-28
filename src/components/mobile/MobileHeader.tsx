import { Menu, User } from "lucide-react";
import logoSvg from "@/assets/logo.svg";

interface MobileHeaderProps {
  onMenuClick?: () => void;
}

const MobileHeader = ({ onMenuClick }: MobileHeaderProps) => {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md px-6 py-4 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-1 hover:bg-muted rounded-full transition-colors"
        >
          <Menu className="w-6 h-6 text-primary" />
        </button>
        <img src={logoSvg} alt="Unestål Education" className="h-8 w-auto object-contain" />
      </div>
      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-muted bg-muted flex items-center justify-center">
        <User className="w-5 h-5 text-muted-foreground" />
      </div>
    </header>
  );
};

export default MobileHeader;
