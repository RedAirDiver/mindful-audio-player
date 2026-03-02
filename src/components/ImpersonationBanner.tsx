import { useImpersonation } from "@/hooks/useImpersonation";
import { Button } from "@/components/ui/button";
import { LogOut, Eye } from "lucide-react";

const ImpersonationBanner = () => {
  const { isImpersonating, impersonatedName, stopImpersonation } = useImpersonation();

  if (!isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-medium">
          Du visar sidan som: <strong>{impersonatedName}</strong>
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="border border-white/50 bg-white/20 text-white hover:bg-white/30 hover:text-white"
        onClick={stopImpersonation}
      >
        <LogOut className="h-3 w-3 mr-1" />
        Tillbaka till admin
      </Button>
    </div>
  );
};

export default ImpersonationBanner;
