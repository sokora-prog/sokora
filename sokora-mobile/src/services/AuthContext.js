import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Restaurer la session au démarrage
  useEffect(() => {
    (async () => {
      try {
        const { token, user: savedUser } = await authService.getSession();
        if (token && savedUser) {
          setUser(savedUser);
          // Revalider le token
          const { data } = await authService.me();
          setUser(data);
        }
      } catch {
        await authService.logout();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (phone_number, password) => {
    const { data } = await authService.login(phone_number, password);
    await authService.saveSession(data.access_token, data.user);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
