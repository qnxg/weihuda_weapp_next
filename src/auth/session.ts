import type { AuthTokens } from "../api/types";

const STORAGE_KEY = "weihuda.session.v1";
const listeners = new Set<() => void>();
let memorySession: AuthTokens | null | undefined;
let sessionVersion = 0;

function readStoredSession(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<AuthTokens>;
    return parsed.access_token && parsed.refresh_token
      ? { access_token: parsed.access_token, refresh_token: parsed.refresh_token }
      : null;
  } catch {
    return null;
  }
}

export function getSession(): AuthTokens | null {
  if (memorySession === undefined) memorySession = readStoredSession();
  return memorySession;
}

export function setSession(tokens: AuthTokens | null) {
  sessionVersion += 1;
  memorySession = tokens;
  if (typeof window !== "undefined") {
    if (tokens) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
  listeners.forEach((listener) => listener());
}

export function getSessionVersion() {
  return sessionVersion;
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
