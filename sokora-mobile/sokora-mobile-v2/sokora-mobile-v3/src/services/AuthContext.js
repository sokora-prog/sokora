import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, hotelService } from '../services/api';

const AuthContext = createContext(null);

// ── Comptes démo offline — tous rôles ────────────────────────────────────────
export const DEMO_ACCOUNTS = {
  // CLIENT (téléphone + mot de passe)
  '0700000001': { password:'Sokora2026', full_name:'Moussa Koné',      role:'client', wallet:'SKW-PRO-0001', balance:2850000 },
  '0700000002': { password:'Sokora2026', full_name:'Aïcha Traoré',     role:'client', wallet:'SKW-PRO-0002', balance:1420000 },
  '0700000003': { password:'Sokora2026', full_name:'Ibrahim Bamba',    role:'client', wallet:'SKW-PRO-0003', balance:980000  },
  // ARTISAN (téléphone + mot de passe)
  '0600000001': { password:'Artisan2026!', full_name:'Mamadou Coulibaly', role:'artisan', specialty:'Coiffure', wallet:'SKW-ART-0001' },
  '0600000002': { password:'Artisan2026!', full_name:'Kadiatou Bah',      role:'artisan', specialty:'Couture',  wallet:'SKW-ART-0002' },
  // STAFF — Gérant / HoReCa / Hôtel / Chauffeur (téléphone + mot de passe)
  '0500000001': { password:'Manager2026!', full_name:'Konan Kouamé',      role:'manager', etablissement:'Restaurant Le Dakar', wallet:'SKW-PRO-0001' },
  '0500000002': { password:'Horeca2026!',  full_name:'Souleymane Diallo', role:'waiter',  etablissement:'Maquis Chez Fatou',   wallet:'SKW-STF-0002' },
  '0500000003': { password:'Hotel2026!',   full_name:'Aminata Diarra',    role:'manager', etablissement:'Hôtel Ivoire Palace',  wallet:'SKW-HTL-0003' },
  '0500000004': { password:'Driver2026!',  full_name:'Kofi Mensah',       role:'driver',  vehicule:'Toyota HiAce - AB 1234 CI', wallet:'SKW-DRV-0004' },
};

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
          // Session démo : ne pas revalider côté serveur
          if (token.startsWith('demo-') || token === 'client-token') {
            setLoading(false);
            return;
          }
          // Session réelle : revalider le token
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
    // Vérification démo offline d'abord
    const demo = DEMO_ACCOUNTS[phone_number?.trim()];
    if (demo && demo.password && demo.password === password?.trim()) {
      const demoUser = { id: Date.now(), full_name: demo.full_name, phone_number: phone_number.trim(), role: demo.role, wallet: demo.wallet, ...demo };
      await authService.saveSession(`demo-${phone_number}`, demoUser);
      setUser(demoUser);
      return demoUser;
    }
    // Connexion API normale
    const { data } = await authService.login(phone_number, password);
    let userObj = { ...data.user };
    // Détecter gérant hôtel vs restaurant
    if (userObj.role?.toLowerCase() === 'manager') {
      try {
        const hr = await hotelService.me();
        userObj = { ...userObj, hotel: hr.data, isHotelManager: true };
      } catch { /* gérant restaurant */ }
    }
    await authService.saveSession(data.access_token, userObj);
    setUser(userObj);
    return userObj;
  };

  // Connexion client (OTP ou démo offline) — met à jour le user directement
  const loginAsClient = async (clientUser, token) => {
    await authService.saveSession(token || 'client-token', clientUser);
    setUser(clientUser);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsClient, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
