import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { getSupabaseClient } from '../lib/supabase';
import { useAddressStore } from '../store/addressStore';

const readEnvValue = (key: string): string =>
  (
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[key] ??
    process.env[key] ??
    ''
  ).toString().trim();

let googleConfigured = false;
const ensureGoogleConfigured = () => {
  if (googleConfigured) return;
  const iosClientId = readEnvValue('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
  const webClientId = readEnvValue('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  GoogleSignin.configure({
    iosClientId: iosClientId || undefined,
    webClientId: webClientId || undefined,
  });
  googleConfigured = true;
};

export type SocialSignInResult = {
  error: string | null;
  cancelled?: boolean;
  email?: string;
  givenName?: string;
  familyName?: string;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<SocialSignInResult>;
  signInWithGoogle: () => Promise<SocialSignInResult>;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: string | null }>;
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
            // Bir önceki kullanıcının adresi header'da ("Adres: X Mahallesi")
            // takılı kalmasın — bkz. useAddressStore, oturumdan bağımsız
            // AsyncStorage'da kalıcı, çıkışta temizlenmiyordu.
            useAddressStore.getState().setSelectedAddress(null);
            return;
          }
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setAuthLoading(false);
            useAddressStore.getState().setSelectedAddress(null);
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

  // Şifresiz giriş — FAZ G: checkout ve genel giriş için tek e-posta yöntemi.
  // shouldCreateUser: true → e-posta kayıtlı değilse Supabase yeni kullanıcı
  // açar, kayıtlıysa aynı hesaba giriş kodu gönderir (ayrı bir "kayıt" akışı
  // yok, tek mekanizma her iki durumu da kapsar).
  const signInWithOtp = useCallback(async (email: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      return { error: error?.message || null };
    } catch (error) {
      console.error('[Auth] signInWithOtp error:', error);
      return { error: error instanceof Error ? error.message : 'Kod gönderilemedi.' };
    }
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
      return { error: error?.message || null };
    } catch (error) {
      console.error('[Auth] verifyEmailOtp error:', error);
      return { error: error instanceof Error ? error.message : 'Kod doğrulanamadı.' };
    }
  }, []);

  const signInWithApple = useCallback(async (): Promise<SocialSignInResult> => {
    try {
      // Hash Apple'a gidiyor, raw Supabase'e — Apple identityToken'ın nonce
      // claim'i hash'i taşır; signInWithIdToken kendi tarafında aynı hash'i
      // üretip claim'le karşılaştırmak için raw değeri ister.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) {
        return { error: 'Apple ile giriş başarısız oldu (token alınamadı).' };
      }
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) return { error: error.message };

      const givenName = credential.fullName?.givenName ?? undefined;
      const familyName = credential.fullName?.familyName ?? undefined;
      // Apple ad/soyadı SADECE bu hesabın Apple ile İLK girişinde verir; sonraki
      // girişlerde credential.fullName tamamen boş gelir ve Apple bunu bir daha
      // asla göndermez — bu yüzden ilk seferinde user_metadata'ya kalıcı yazıyoruz.
      if (givenName || familyName) {
        await supabase.auth.updateUser({
          data: {
            given_name: givenName,
            family_name: familyName,
            full_name: [givenName, familyName].filter(Boolean).join(' '),
          },
        });
      }
      // authorizationCode HER girişte gelir (fullName/email'in aksine) —
      // sunucuda Apple refresh_token'a çevrilip saklanır (bkz. apple-link-token),
      // hesap silmede Apple'a token iptali göndermek için. Best-effort: bu adım
      // başarısız olsa da giriş tamamlanmıştır, kullanıcıya hata gösterilmez.
      if (credential.authorizationCode) {
        try {
          await supabase.functions.invoke('apple-link-token', {
            body: { authorizationCode: credential.authorizationCode },
          });
        } catch (linkErr) {
          console.error('[Auth] apple-link-token invoke failed:', linkErr);
        }
      }

      return { error: null, email: credential.email ?? undefined, givenName, familyName };
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') {
        return { error: null, cancelled: true };
      }
      console.error('[Auth] Apple sign-in error:', err);
      return { error: err?.message ?? 'Apple ile giriş başarısız oldu' };
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<SocialSignInResult> => {
    try {
      ensureGoogleConfigured();
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        return { error: null, cancelled: true };
      }
      const { idToken, user: gUser } = response.data;
      if (!idToken) {
        return { error: 'Google ile giriş başarısız oldu (token alınamadı).' };
      }
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) return { error: error.message };
      return {
        error: null,
        email: gUser.email,
        givenName: gUser.givenName ?? undefined,
        familyName: gUser.familyName ?? undefined,
      };
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        return { error: null, cancelled: true };
      }
      console.error('[Auth] Google sign-in error:', err);
      return { error: err?.message ?? 'Google ile giriş başarısız oldu' };
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
      signInWithApple,
      signInWithGoogle,
      signInWithOtp,
      verifyEmailOtp,
    }),
    [
      user,
      session,
      authLoading,
      signIn,
      signUp,
      signOut,
      signInWithApple,
      signInWithGoogle,
      signInWithOtp,
      verifyEmailOtp,
    ],
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
