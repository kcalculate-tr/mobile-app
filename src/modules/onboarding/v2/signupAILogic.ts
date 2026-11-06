// G15-S1 (Ek karar) — Kcal AI kayıt v2 SAF adım mantığı. RN/zustand İÇERMEZ
// (`tsx --test` doğrudan koşar). Kurallar `KcalAiSignUpScreen.tsx`'in birebir
// karşılığıdır (satır kaynakları yanında); yeni iş kuralı YOK.

export type SignupStep = 'welcome' | 'email' | 'handle' | 'profile';

/** KcalAiSignUpScreen.tsx afterAuthed: handle'ı varsa bitir, yoksa ad+handle adımı. */
export function stepAfterAuthed(hasHandle: boolean): SignupStep | 'done' {
  return hasHandle ? 'done' : 'handle';
}

/** Geri oku (KcalAiSignUpScreen header): email/handle → welcome; profile/welcome → çık (onBack). */
export function stepOnBack(step: SignupStep): SignupStep | 'exit' {
  if (step === 'email' || step === 'handle') return 'welcome';
  return 'exit';
}

/** Handle kaydı (reg.submit) başarılıysa profil adımı, değilse aynı adımda kal. */
export function stepAfterHandleSubmit(ok: boolean): SignupStep {
  return ok ? 'profile' : 'handle';
}

/** İlerleme çubuğu: 2 parça; handle=1, profile=2, diğerleri çubuksuz. */
export function progressFor(step: SignupStep): { total: number; done: number } | null {
  if (step === 'handle') return { total: 2, done: 1 };
  if (step === 'profile') return { total: 2, done: 2 };
  return null;
}

/** Sosyal giriş sonucu (Apple/Google): iptal → sessiz, hata → mesaj, aksi → devam. */
export function socialOutcome(res: { cancelled?: boolean; error?: string | null }): 'cancelled' | 'error' | 'ok' {
  if (res.cancelled) return 'cancelled';
  if (res.error) return 'error';
  return 'ok';
}

/** KcalAiSignUpScreen.tsx handleSendCode e-posta kuralı. */
export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

/** Bio üst sınırı (KcalAiSignUpScreen: slice(0,150)). */
export const BIO_MAX = 150;
export function clampBio(v: string): string {
  return v.slice(0, BIO_MAX);
}
