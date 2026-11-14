import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type UserRole = "admin" | "transport" | "labour_contractor" | "labour_worker" | "laptop_watch";

export interface AuthUser {
  id: number;
  name: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string; user?: AuthUser }>;
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

  useEffect(() => {
    void refresh();
  }, []);

  async function login(username: string, password: string) {
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: username, password }),
      });
      const data = (await resp.json()) as { success: boolean; message?: string; user?: AuthUser };
      if (data.success && data.user) {
        setUser(data.user);
        return { success: true, user: data.user };
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

export function roleDashboard(role: UserRole): string {
  if (role === 'laptop_watch') return '/laptop-watch';
  if (role === "admin") return "/admin";
  if (role === "transport") return "/transport";
  if (role === "labour_contractor") return "/labour";
  return "/worker";
}
