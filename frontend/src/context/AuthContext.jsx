import { createContext, useContext, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { authAPI } from '../api';

const AuthContext = createContext(null);

// A session is "permanent" if we're on a native APK OR if the server flagged
// sessionPermanent=true (issued 100-year token for a whitelisted IP).
const getIsPermanentSession = () =>
  Capacitor.isNativePlatform() || localStorage.getItem('sessionPermanent') === 'true';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authAPI.me()
        .then(({ data }) => setUser(data.data))
        .catch(() => {
          // For APK / whitelisted-IP sessions never clear the session on network
          // errors or temporary backend outages — just leave the user logged in.
          if (!getIsPermanentSession()) {
            localStorage.clear();
            setUser(null);
          }
          // else: silently keep last state; they will retry on next page load / action
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { data } = await authAPI.login(email, password);
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    // Persist the server's permanent-session flag so it survives page reloads
    localStorage.setItem('sessionPermanent', data.data.sessionPermanent ? 'true' : 'false');
    setUser(data.data.user);
    return data.data.user;
  };

  const logout = async () => {
    // APK and whitelisted-IP users must never be logged out
    if (getIsPermanentSession()) return;
    await authAPI.logout().catch(() => { });
    localStorage.clear();
    setUser(null);
  };

  const hasPermission = (perm) => {
    if (!user) return false;
    if (user.role === 'Super Admin') return true;
    return user.permissions?.includes(perm) || false;
  };

  const isPermanentSession = getIsPermanentSession();

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, isPermanentSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
