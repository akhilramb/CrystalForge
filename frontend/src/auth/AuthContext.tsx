import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { setAuthToken } from "../services/api";

type AuthConfig = {
  configured: boolean;
  supabase_url: string;
  publishable_key: string;
};

type AuthContextValue = {
  client: SupabaseClient | null;
  session: Session | null;
  user: User | null;
  loading: boolean;
  configError: string;
  setRememberSession: (remember: boolean) => void;
  recordLogin: (provider: string) => Promise<void>;
  recordLogout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const REMEMBER_KEY = "cf-auth-remember";
let rememberSession =
  typeof localStorage === "undefined" ||
  localStorage.getItem(REMEMBER_KEY) !== "false";

const authStorage = {
  getItem(key: string) {
    const storage = rememberSession
      ? window.localStorage
      : window.sessionStorage;
    return storage.getItem(key);
  },
  setItem(key: string, value: string) {
    const storage = rememberSession
      ? window.localStorage
      : window.sessionStorage;
    storage.setItem(key, value);
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    fetch("/api/auth/config")
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Authentication settings could not be loaded.");
        return (await response.json()) as AuthConfig;
      })
      .then(async (config) => {
        if (!active) return;
        if (!config.configured) {
          setConfigError("Supabase is not configured for this deployment yet.");
          setLoading(false);
          return;
        }
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          config.supabase_url,
          config.publishable_key,
          {
            auth: {
              storage: authStorage,
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              flowType: "pkce",
            },
          },
        );
        setClient(supabase);
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        setSession(data.session);
        setAuthToken(data.session?.access_token ?? null);
        const { data: subscription } = supabase.auth.onAuthStateChange(
          (_event, nextSession) => {
            setSession(nextSession);
            setAuthToken(nextSession?.access_token ?? null);
          },
        );
        unsubscribe = () => subscription.subscription.unsubscribe();
        setLoading(false);
      })
      .catch((error: Error) => {
        if (!active) return;
        setConfigError(
          error.message || "Authentication could not be initialized.",
        );
        setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const setRememberSession = useCallback((remember: boolean) => {
    rememberSession = remember;
    localStorage.setItem(REMEMBER_KEY, String(remember));
  }, []);

  const recordLogin = useCallback(
    async (provider: string) => {
      if (!client) return;
      const { data: current, error: userError } = await client.auth.getUser();
      if (userError || !current.user) return;
      const now = new Date().toISOString();
      const [profile, history] = await Promise.all([
        client
          .from("profiles")
          .update({ last_login_at: now })
          .eq("id", current.user.id),
        client.from("login_history").insert({
          event_type: provider === "email" ? "sign_in" : "oauth_sign_in",
          authentication_provider: provider,
        }),
      ]);
      if (profile.error || history.error) {
        throw profile.error ?? history.error;
      }
    },
    [client],
  );

  const recordLogout = useCallback(async () => {
    if (!client || !session?.user) return;
    const { error } = await client.from("login_history").insert({
      event_type: "sign_out",
      authentication_provider: String(
        session.user.app_metadata.provider || "email",
      ),
    });
    if (error) throw error;
  }, [client, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      client,
      session,
      user: session?.user ?? null,
      loading,
      configError,
      setRememberSession,
      recordLogin,
      recordLogout,
    }),
    [
      client,
      session,
      loading,
      configError,
      setRememberSession,
      recordLogin,
      recordLogout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
