"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type Permission =
  | "dashboard.view"
  | "content.view"
  | "content.manage"
  | "home.view"
  | "home.manage"
  | "users.view"
  | "users.manage"
  | "billing.view"
  | "billing.manage"
  | "admins.manage"
  | "audit.view";

export interface AdminMe {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: Permission[];
}

interface AdminAuth {
  me: AdminMe | null;
  loading: boolean;
  can: (p: Permission) => boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  adminFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

const Ctx = createContext<AdminAuth | null>(null);
const KEY = "mm_admin_token";

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);

  const adminFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    const t = read();
    if (t) headers.set("Authorization", `Bearer ${t}`);
    if (init.body && !headers.has("content-type"))
      headers.set("content-type", "application/json");
    return fetch(`${API_BASE}${path}`, { ...init, headers });
  }, []);

  const loadMe = useCallback(async () => {
    if (!read()) {
      setMe(null);
      setLoading(false);
      return;
    }
    const res = await adminFetch("/admin/auth/me");
    setMe(res.ok ? ((await res.json()) as AdminMe) : null);
    setLoading(false);
  }, [adminFetch]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => null);
      return { ok: false, error: e?.error?.message ?? "Login failed" };
    }
    const data = (await res.json()) as { token: string; admin: AdminMe };
    try {
      localStorage.setItem(KEY, data.token);
    } catch {
      /* ignore */
    }
    setMe(data.admin);
    return { ok: true };
  };

  const logout = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setMe(null);
  };

  const can = (p: Permission) => !!me?.permissions.includes(p);

  return (
    <Ctx.Provider value={{ me, loading, can, login, logout, adminFetch }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin must be inside AdminAuthProvider");
  return c;
}
