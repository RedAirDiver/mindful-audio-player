import { useNavigate, useSearchParams } from "react-router-dom";
import { User } from "lucide-react";
import logoSvg from "@/assets/logo.svg";
import { useAuth } from "@/hooks/useAuth";

const MobileHeader = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const layoutParam = searchParams.get("layout");

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  const handleProfileClick = () => {
    const path = "/mitt-konto";
    navigate(layoutParam ? `${path}?layout=${layoutParam}` : path);
  };

  const handleLogoClick = () => {
    navigate(layoutParam ? `/?layout=${layoutParam}` : "/");
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md px-6 py-4 pt-[55px] flex justify-between items-center">
      <button onClick={handleLogoClick} className="focus:outline-none">
        <img src={logoSvg} alt="Unestål Education" className="h-10 w-auto object-contain" />
      </button>
      <button
        onClick={handleProfileClick}
        className="w-10 h-10 rounded-full overflow-hidden border-2 border-muted bg-muted flex items-center justify-center"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Profil" className="w-full h-full object-cover" />
        ) : (
          <User className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
    </header>
  );
};

export default MobileHeader;
