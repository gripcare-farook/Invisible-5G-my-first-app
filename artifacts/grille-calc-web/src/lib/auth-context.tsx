import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface AuthUser {
  id: number;
  name: string;
  role: "admin" | "transport";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const resp = await fetch("/api/auth/me", { credentials: "include" });
      const data = (await resp.json()) as { authenticated: boolean; user: AuthUser | null };
      setUser(data.authenticated ? data.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function login(email: string, password: string) {
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = (await resp.json()) as { success: boolean; message?: string; user?: AuthUser };
      if (data.success && data.user) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, message: data.message ?? "Login failed." };
    } catch {
      return { success: false, message: "Network error." };
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
