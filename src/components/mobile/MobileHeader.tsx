import { User } from "lucide-react";
import logoSvg from "@/assets/logo.svg";

const MobileHeader = () => {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md px-6 py-4 flex justify-between items-center">
      <img src={logoSvg} alt="Unestål Education" className="h-8 w-auto object-contain" />
      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-muted bg-muted flex items-center justify-center">
        <User className="w-5 h-5 text-muted-foreground" />
      </div>
    </header>
  );
};

export default MobileHeader;
