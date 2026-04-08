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

const LOGIN_HISTORY_FINGERPRINT_KEY = "mentaltraning:last-login-fingerprint";

const getSessionId = (session: Session | null) => {
  const accessToken = session?.access_token;
  if (!accessToken) return null;

  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      "="
    );
    const decodedPayload = JSON.parse(window.atob(paddedPayload)) as Record<string, unknown>;

    return typeof decodedPayload.session_id === "string"
      ? decodedPayload.session_id
      : null;
  } catch {
    return null;
  }
};

const getLoginFingerprint = (session: Session | null) => {
  const user = session?.user;
  if (!user?.id) return null;

  return `${user.id}:${getSessionId(session) ?? user.last_sign_in_at ?? session?.expires_at ?? "unknown"}`;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialSessionFingerprint: string | null = null;
    const isAuthCallback =
      window.location.search.includes("code=") ||
      window.location.hash.includes("access_token=") ||
      window.location.hash.includes("refresh_token=");

    const readStoredLoginFingerprint = () =>
      window.localStorage.getItem(LOGIN_HISTORY_FINGERPRINT_KEY);

    const rememberLoginFingerprint = (fingerprint: string | null) => {
      if (!fingerprint) return;
      window.localStorage.setItem(LOGIN_HISTORY_FINGERPRINT_KEY, fingerprint);
    };

    const clearLoginFingerprint = () => {
      window.localStorage.removeItem(LOGIN_HISTORY_FINGERPRINT_KEY);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        const loginFingerprint = getLoginFingerprint(currentSession);

        if (event === "INITIAL_SESSION") {
          initialSessionFingerprint = loginFingerprint;
          return;
        }

        if (event === "SIGNED_OUT") {
          initialSessionFingerprint = null;
          clearLoginFingerprint();
          return;
        }

        if (event !== "SIGNED_IN" || !currentSession?.user || !loginFingerprint) {
          return;
        }

        const isSessionRestore =
          !isAuthCallback && loginFingerprint === initialSessionFingerprint;

        if (readStoredLoginFingerprint() === loginFingerprint || isSessionRestore) {
          rememberLoginFingerprint(loginFingerprint);
          return;
        }

        rememberLoginFingerprint(loginFingerprint);

        const u = currentSession.user;
        const method = u.app_metadata?.provider || "unknown";

        supabase
          .from("login_history")
          .insert({
            user_id: u.id,
            email: u.email,
            login_method: method,
            user_agent: navigator.userAgent,
          })
          .then(({ error }) => {
            if (error && readStoredLoginFingerprint() === loginFingerprint) {
              clearLoginFingerprint();
            }
          });
      }
    );

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
