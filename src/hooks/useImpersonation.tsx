import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedName: string | null;
  startImpersonation: (targetUserId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const ADMIN_SESSION_KEY = "admin_session_backup";

export const ImpersonationProvider = ({ children }: { children: ReactNode }) => {
  const [isImpersonating, setIsImpersonating] = useState(
    () => !!sessionStorage.getItem(ADMIN_SESSION_KEY)
  );
  const [impersonatedName, setImpersonatedName] = useState<string | null>(
    () => sessionStorage.getItem("impersonated_name")
  );

  const startImpersonation = useCallback(async (targetUserId: string) => {
    try {
      // Save current admin session
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      if (!adminSession) {
        toast.error("Du måste vara inloggad som admin");
        return;
      }

      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      }));

      // Call edge function to get magic link token
      const { data, error } = await supabase.functions.invoke("impersonate-user", {
        body: { targetUserId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { token_hash, name } = data;

      // Sign in as the target user
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash,
        type: "magiclink",
      });

      if (otpError) throw otpError;

      setIsImpersonating(true);
      setImpersonatedName(name || "Okänd");
      sessionStorage.setItem("impersonated_name", name || "Okänd");

      toast.success(`Du är nu inloggad som ${name}`);

      // Navigate to dashboard
      window.location.href = "/dashboard";
    } catch (err: any) {
      // Clean up on failure
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      toast.error("Kunde inte logga in som användare: " + err.message);
    }
  }, []);

  const stopImpersonation = useCallback(async () => {
    try {
      const savedSession = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (!savedSession) {
        toast.error("Ingen adminsession hittades");
        return;
      }

      const { access_token, refresh_token } = JSON.parse(savedSession);

      // Sign out impersonated user and restore admin session
      await supabase.auth.signOut();
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) throw error;

      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem("impersonated_name");
      setIsImpersonating(false);
      setImpersonatedName(null);

      toast.success("Tillbaka som admin");
      window.location.href = "/admin/users";
    } catch (err: any) {
      toast.error("Kunde inte återgå till admin: " + err.message);
      // Force cleanup
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem("impersonated_name");
      setIsImpersonating(false);
      setImpersonatedName(null);
    }
  }, []);

  return (
    <ImpersonationContext.Provider value={{
      isImpersonating,
      impersonatedName,
      startImpersonation,
      stopImpersonation,
    }}>
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error("useImpersonation must be used within an ImpersonationProvider");
  }
  return context;
};
