// G15-S1 (Ek karar) — Giriş v2 SAF mantığı. RN/native importu YOK (node:test).
// Kaynak: src/screens/auth/UnifiedLoginScreen.tsx (hedefiVarMi, navigateByTarget,
// handleSendCode, handleVerify, 18+ onayı) ve components/onboarding/SocialAuthButtons
// (handleResult). Davranış AYNEN; yalnız bağımlılıklar parametre olur.

export const ONBOARDING_DONE_KEY = '@kcal_onboarding_done';
export const AGE_CONFIRMED_KEY = '@kcal_age_18_confirmed';
export const RESEND_SECONDS = 60;
export const CODE_LENGTH = 6;

/** navigation/types.AuthRedirectTarget ile uyumlu (string birliği; saf kalsın diye burada geniş). */
export type LoginRedirect = string | undefined;

/** UnifiedLoginScreen.handleSendCode ile aynı e-posta kuralı. */
export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

/** Geri sayım "MM:SS". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** 18+ kapısı: bu cihazda onboarding bitmemiş VE yaş onayı verilmemişse gösterilir. */
export function needsAgeGate(onboardingDone: string | null, ageConfirmed: string | null): boolean {
  return onboardingDone !== 'true' && ageConfirmed !== 'true';
}

export type SendCodeCheck = 'ok' | 'age' | 'email';

/** handleSendCode ön kontrolleri (sıra aynı: önce yaş, sonra e-posta). */
export function checkSendCode(opts: { needsAgeGate: boolean; ageConfirmed: boolean; email: string }): SendCodeCheck {
  if (opts.needsAgeGate && !opts.ageConfirmed) return 'age';
  if (!isValidEmail(opts.email)) return 'email';
  return 'ok';
}

/** 6 haneli kod tamamlandı mı (yalnız rakam). */
export function sanitizeCode(raw: string): string {
  return raw.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
}

export function isCodeComplete(code: string): boolean {
  return code.length === CODE_LENGTH;
}

export type LoginTarget =
  | { name: 'Checkout' }
  | { name: 'Addresses' }
  | { name: 'NutritionProfile'; params: { firstTime: true } }
  | { name: 'Tabs'; params: { screen: 'Home' | 'Tracker' } };

/**
 * navigateByTarget kararı: Checkout/Addresses'e giderken ASLA araya girilmez;
 * yalnız anasayfaya dönen ve hedefi olmayan kullanıcı NutritionProfile'a gider.
 */
export function resolveLoginTarget(redirect: LoginRedirect, hasGoal: boolean, newShell = false): LoginTarget {
  if (redirect === 'Checkout') return { name: 'Checkout' };
  if (redirect === 'Addresses') return { name: 'Addresses' };
  // G17-S1 md.4: yeni kabukta her hesabın ilk hedefi Ana sayfa (Tracker). Hedef
  // kurulumu Ana sayfa makro kartından Final "Takibe başla" akışıyla açılır
  // (eski NutritionProfile ekranına düşmez).
  if (newShell) return { name: 'Tabs', params: { screen: 'Tracker' } };
  if (!hasGoal) return { name: 'NutritionProfile', params: { firstTime: true } };
  return { name: 'Tabs', params: { screen: 'Home' } };
}

/** hedefiVarMi için gereken en küçük Supabase yüzeyi. */
export interface GoalClient {
  auth: { getUser: () => Promise<{ data: { user?: { id?: string } | null } | null }> };
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
}

/**
 * UnifiedLoginScreen.hedefiVarMi AYNEN: kimlik yoksa / emin olamıyorsak / hata
 * olursa `true` döner (araya girme).
 */
export async function hasNutritionGoal(getClient: () => Promise<GoalClient>, userId?: string): Promise<boolean> {
  try {
    const supabase = await getClient();
    let id = userId;
    if (!id) {
      const { data: oturum } = await supabase.auth.getUser();
      id = oturum?.user?.id;
    }
    if (!id) return true;
    const { data, error } = await supabase
      .from('user_nutrition_profiles')
      .select('user_id')
      .eq('user_id', id)
      .maybeSingle();
    if (error) return true;
    return Boolean(data);
  } catch {
    return true;
  }
}

export interface SocialResult {
  error: string | null;
  cancelled?: boolean;
  email?: string;
  givenName?: string;
  familyName?: string;
}

export type SocialOutcome =
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; newUser: boolean };

/**
 * SocialAuthButtons.handleResult AYNEN: iptal = sessiz; sağlayıcı hatası = mesaj;
 * resolvePostSocialAuth hatası = mesaj (varsayılan "Bir hata oluştu.").
 */
export async function interpretSocialResult(
  result: SocialResult,
  resolvePost: (p: { email?: string; givenName?: string; familyName?: string }) => Promise<{
    outcome: 'new_user' | 'returning_user' | 'error';
    error?: string;
  }>,
): Promise<SocialOutcome> {
  if (result.cancelled) return { kind: 'cancelled' };
  if (result.error) return { kind: 'error', message: result.error };
  const post = await resolvePost({
    email: result.email,
    givenName: result.givenName,
    familyName: result.familyName,
  });
  if (post.outcome === 'error') return { kind: 'error', message: post.error ?? 'Bir hata oluştu.' };
  return { kind: 'done', newUser: post.outcome === 'new_user' };
}
