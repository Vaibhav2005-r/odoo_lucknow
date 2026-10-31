import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = logged out
  useEffect(() => {
    api.get('/auth/me')
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const login = async (email, password) => {
    const u = await api.post('/auth/login', { email, password });
    setUser(u);
    return u;
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
