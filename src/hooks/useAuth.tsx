import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { UserProfile } from '@/types/database';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const MOCK_USER: UserProfile = {
  id: 'u-001',
  user_id: 'auth-001',
  organisme_id: 'org-001',
  email: 'antoine@agencenikita.com',
  first_name: 'Antoine',
  last_name: 'Admin',
  role: 'admin',
  is_active: true,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(MOCK_USER);
  const [loading] = useState(false);

  const login = useCallback(async (email: string, _password: string) => {
    if (email) { setUser({ ...MOCK_USER, email }); return true; }
    return false;
  }, []);

  const logout = useCallback(() => { setUser(null); }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
