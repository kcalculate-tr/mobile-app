import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const initializeAuth = async () => {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (error) {
          console.error('[Auth] Failed to get session:', error.message);
          setSession(null);
          setUser(null);
        } else {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
        }

        const {
          data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (!isMounted) return;
          // Invalid/expired refresh token — clear local session silently
          if (event === 'TOKEN_REFRESHED' && !nextSession) {
            supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setAuthLoading(false);
            return;
          }
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setAuthLoading(false);
            return;
          }
          setSession(nextSession ?? null);
          setUser(nextSession?.user ?? null);
          setAuthLoading(false);
        });

        subscription = authSubscription;
      } catch (error) {
        console.error('[Auth] Initialization error:', error);
        if (isMounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message || null };
    } catch (error) {
      console.error('[Auth] SignIn error:', error);
      return { error: error instanceof Error ? error.message : 'Giriş başarısız oldu' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error?.message || null };
    } catch (error) {
      console.error('[Auth] SignUp error:', error);
      return { error: error instanceof Error ? error.message : 'Kayıt başarısız oldu' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();
      return { error: error?.message || null };
    } catch (error) {
      console.error('[Auth] SignOut error:', error);
      return { error: error instanceof Error ? error.message : 'Çıkış başarısız oldu' };
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading: authLoading,
      authLoading,
      signIn,
      signUp,
      signOut,
    }),
    [user, session, authLoading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth sadece AuthProvider içinde kullanılabilir.');
  }
  return context;
};
