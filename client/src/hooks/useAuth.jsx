import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  const token = localStorage.getItem('token');

  if (!token) {
    setLoading(false);
    return;
  }

  api.me()
    .then((data) => setUser(data.user))
    .catch(() => {
      localStorage.removeItem('token');
      setUser(null);
    })
    .finally(() => setLoading(false));
}, []);

  const login = useCallback(async (email, password) => {
  const data = await api.login(email, password);

  localStorage.setItem('token', data.token);

  setUser(data.user);

  return data.user;
}, []);

  const logout = useCallback(async () => {
  localStorage.removeItem('token');

  try {
    await api.logout();
  } catch {}

  setUser(null);
}, []);

  const refreshUser = useCallback(async () => {
    const data = await api.me();
    setUser(data.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return ctx;
}
