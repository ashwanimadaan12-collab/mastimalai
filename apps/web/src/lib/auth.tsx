"use client";
// Client-side auth: tokens + active profile in localStorage (dev-grade), a
// React context, and authFetch() which attaches Authorization + X-Profile-Id
// and transparently refreshes an expired access token once.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Me, UserProfile } from "@masti/types";
import { API_BASE } from "./api";

interface AuthState {
  me: Me | null;
  profile: UserProfile | null;
  loading: boolean;
  loggedIn: boolean;
  refresh: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setProfile: (p: UserProfile) => void;
  logout: () => Promise<void>;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

const Ctx = createContext<AuthState | null>(null);

const LS = {
  access: "mm_access",
  refresh: "mm_refresh",
  profile: "mm_profile",
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, val: string | null) {
  try {
    if (val === null) localStorage.removeItem(key);
    else localStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function doRefreshToken(): Promise<boolean> {
    const rt = read(LS.refresh);
    if (!rt) return false;
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    write(LS.access, data.accessToken);
    write(LS.refresh, data.refreshToken);
    return true;
  }

  async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("X-Platform", "web");
    const access = read(LS.access);
    if (access) headers.set("Authorization", `Bearer ${access}`);
    const pid = read(LS.profile);
    if (pid) headers.set("X-Profile-Id", JSON.parse(pid).id);
    if (init.body && !headers.has("content-type"))
      headers.set("content-type", "application/json");

    let res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    if (res.status === 401 && (await doRefreshToken())) {
      const access2 = read(LS.access);
      if (access2) headers.set("Authorization", `Bearer ${access2}`);
      res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    }
    return res;
  }

  async function refresh() {
    const access = read(LS.access);
    if (!access) {
      setMe(null);
      setLoading(false);
      return;
    }
    const res = await authFetch("/users/me");
    if (res.ok) {
      const data = (await res.json()) as Me;
      setMe(data);
      // Ensure an active profile is selected.
      const stored = read(LS.profile);
      const chosen =
        (stored && data.profiles.find((p) => p.id === JSON.parse(stored).id)) ||
        data.profiles[0] ||
        null;
      if (chosen) {
        setProfileState(chosen);
        write(LS.profile, JSON.stringify(chosen));
      }
    } else {
      setMe(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTokens(accessToken: string, refreshToken: string) {
    write(LS.access, accessToken);
    write(LS.refresh, refreshToken);
  }
  function setProfile(p: UserProfile) {
    setProfileState(p);
    write(LS.profile, JSON.stringify(p));
  }
  async function logout() {
    const rt = read(LS.refresh);
    if (rt)
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      }).catch(() => {});
    write(LS.access, null);
    write(LS.refresh, null);
    write(LS.profile, null);
    setMe(null);
    setProfileState(null);
  }

  return (
    <Ctx.Provider
      value={{
        me,
        profile,
        loading,
        loggedIn: !!me,
        refresh,
        setTokens,
        setProfile,
        logout,
        authFetch,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
