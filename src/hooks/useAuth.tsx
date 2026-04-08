import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Log login on SIGNED_IN (covers password, Google, signup, etc.)
        if (event === 'SIGNED_IN' && currentSession?.user) {
          const u = currentSession.user;
          const method = u.app_metadata?.provider || 'unknown';
          supabase.from("login_history").insert({
            user_id: u.id,
            email: u.email,
            login_method: method,
            user_agent: navigator.userAgent,
          }).then(() => {});
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name },
      },
    });
    if (error) throw error;
    toast.success("Konto skapat! Du är nu inloggad.");
    // Log signup login
    try {
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        await supabase.from("login_history").insert({
          user_id: newUser.id,
          email,
          login_method: "signup",
          user_agent: navigator.userAgent,
        });
      }
    } catch {}
  
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Try legacy WordPress password verification
      try {
        const { data: legacyResult } = await supabase.functions.invoke(
          "verify-legacy-password",
          { body: { email, password } }
        );

        if (legacyResult?.verified) {
          // Password was migrated, retry login
          const { error: retryError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (retryError) throw retryError;
          toast.success("Välkommen tillbaka!");
          return;
        }
      } catch {
        // Legacy check failed, throw original error
      }
      throw error;
    }
    toast.success("Välkommen tillbaka!");
    // Log login
    const { data: { user: loggedUser } } = await supabase.auth.getUser();
    if (loggedUser) {
      supabase.from("login_history").insert({
        user_id: loggedUser.id,
        email,
        login_method: "password",
        user_agent: navigator.userAgent,
      }).then(() => {});
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    toast.success("Du har loggat ut.");
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
