import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // vérifie session au démarrage

  // ── Vérifie le token existant au chargement ──────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("sokora_token");
    const saved = localStorage.getItem("sokora_user");
    if (token && saved) {
      try {
        setUser(JSON.parse(saved));
        // Dev bypass : skip server validation in dev mode only
        if (import.meta.env.DEV && token === "dev-bypass") { setLoading(false); return; }
        // Revalider le token avec l'API
        authApi.me()
          .then(r => setUser(r.data))
          .catch(() => {
            localStorage.removeItem("sokora_token");
            localStorage.removeItem("sokora_user");
            setUser(null);
          })
          .finally(() => setLoading(false));
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (phone_number, password) => {
    const { data } = await authApi.login(phone_number, password);
    localStorage.setItem("sokora_token", data.access_token);
    localStorage.setItem("sokora_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem("sokora_token");
    localStorage.removeItem("sokora_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
