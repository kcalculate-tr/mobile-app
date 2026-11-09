// G21-S1 md.9 — Profil alt sayfaları (FinPrProfile) kök yığında `ProfileSub` rotası.
// Saf modül (RN yok): rota tipi + adlar; hem navigation/types hem testler okur.

export const PROFILE_SUBS = [
  'personal',
  'notify',
  'security',
  'privacy',
  'dataConsent',
  'agreements',
  'support',
  'feedback',
  'macro',
  'macroSub',
  'progress',
  'badges',
  'collection',
  'public',
  'reviews',
  'coupons',
  'measurements',
  'cards',
] as const;

export type ProfileSubName = (typeof PROFILE_SUBS)[number];

/** `ProfileSub` rota parametreleri. Kimlik/görünüm alanları yalnız `public`/`badges` içindir. */
export type ProfileSubParams = {
  sub: ProfileSubName;
  handle?: string | null;
  displayName?: string;
  avatarUrl?: string | null;
  isPrivate?: boolean;
};

export function isProfileSub(v: unknown): v is ProfileSubName {
  return typeof v === 'string' && (PROFILE_SUBS as readonly string[]).includes(v);
}

/**
 * Yığın kimliği: aynı alt sayfa iki kez üst üste açılmaz; farklı alt sayfa
 * (Gizlilik → Güvenlik) yeni ekran olarak üstüne itilir. Geri = bir önceki sayfa.
 */
export function profileSubId(params: { sub?: unknown } | undefined): string | undefined {
  return isProfileSub(params?.sub) ? params.sub : undefined;
}
