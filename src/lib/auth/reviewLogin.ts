// G28-S1 md.5 — App Store / Play inceleme girişi. İnceleyici e-postası kod (OTP) alamaz;
// bu adreslerden biri yazılınca giriş ekranında "Şifreyle giriş" alanı açılır
// (supabase.auth.signInWithPassword). Diğer herkes için akış AYNI (e-posta kodu).
// Adres listesi TEK SABİT burada. Şifre koda/repoya YAZILMAZ — hesap Supabase Auth'ta
// şifreyle oluşturulur (İlter). Saf modül (RN importu yok → tsx --test).

export const REVIEW_LOGIN_EMAILS: readonly string[] = ['apple@inceleme.eatkcal.com', 'review@inceleme.eatkcal.com'];

/** Yazılan e-posta inceleme adresi mi (baş/son boşluk ve büyük/küçük harf yok sayılır)? */
export function isReviewEmail(email: string | null | undefined): boolean {
  if (typeof email !== 'string') return false;
  const e = email.trim().toLowerCase();
  return REVIEW_LOGIN_EMAILS.includes(e);
}

/** Şifre girişine gönderilecek e-posta (normalize). */
export function reviewEmailOf(email: string): string {
  return email.trim().toLowerCase();
}
