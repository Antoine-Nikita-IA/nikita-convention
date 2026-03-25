import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { UserProfile } from '@/types/database';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: UserProfile | null;
  supabaseUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_ORGANISME_ID = 'a0000000-0000-0000-0000-000000000001';

const MOCK_USER: UserProfile = {
  id: 'u-001',
  user_id: 'auth-001',
  organisme_id: DEFAULT_ORGANISME_ID,
  email: 'antoine@agencenikita.com',
  first_name: 'Antoine',
  last_name: 'Admin',
  role: 'admin',
  is_active: true,
  is_validated: true,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(isSupabaseConfigured ? null : MOCK_USER);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  // Initialize auth state from Supabase session
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let mounted = true;

    // Listen for auth changes (fires on init + login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setSupabaseUser(session.user);
          await loadUserProfile(session.user.id);
        } else {
          setSupabaseUser(null);
          setUser(null);
          setLoading(false);
        }
      }
    );

    // Safety timeout: if auth takes more than 3s, stop loading and show login
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 3000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function loadUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        // User authenticated but no profile yet — build from auth metadata
        const supaUser = (await supabase.auth.getUser()).data.user;
        const profile: UserProfile = {
          id: userId,
          user_id: userId,
          organisme_id: DEFAULT_ORGANISME_ID,
          email: supaUser?.email || '',
          first_name: supaUser?.user_metadata?.first_name || 'Admin',
          last_name: supaUser?.user_metadata?.last_name || '',
          role: 'admin',
          is_active: true,
          is_validated: true,
        };
        setUser(profile);
      } else {
        setUser({
          id: data.id,
          user_id: data.user_id || userId,
          organisme_id: data.organisme_id || DEFAULT_ORGANISME_ID,
          email: data.email,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          role: data.role || 'user',
          is_active: data.is_active ?? true,
          is_validated: data.is_validated ?? false,
        });
      }
    } catch {
      setUser(null);
    }
    setLoading(false);
  }

  const login = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      // Mock mode
      if (email) {
        setUser({ ...MOCK_USER, email });
        return true;
      }
      return false;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Login error:', error.message);
        setLoading(false);
        return false;
      }
      // Load profile immediately so user is set before navigate()
      if (data.user) {
        setSupabaseUser(data.user);
        await loadUserProfile(data.user.id);
      }
      return true;
    } catch {
      setLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSupabaseUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, supabaseUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
