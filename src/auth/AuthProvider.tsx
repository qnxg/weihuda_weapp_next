import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { api } from "../api/api";
import type { AuthTokens, LoginCredentials } from "../api/types";
import { getPlatformLoginCode } from "./platform";
import { getSession, setSession, subscribeSession } from "./session";
import { setTfaChallenge } from "./tfa";

interface AuthContextValue {
  session: AuthTokens | null;
  isAuthenticated: boolean;
  login: (input: LoginCredentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);
  const wasAuthenticated = useRef(Boolean(session));

  useEffect(() => {
    const isAuthenticated = Boolean(session);
    if (wasAuthenticated.current && !isAuthenticated) queryClient.clear();
    wasAuthenticated.current = isAuthenticated;
  }, [queryClient, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      login: async (input) => {
        queryClient.clear();
        const code = await getPlatformLoginCode();
        setSession(await api.auth.login({ ...input, code }));
      },
      logout: () => {
        queryClient.clear();
        setTfaChallenge(null);
        setSession(null);
      },
    }),
    [queryClient, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
