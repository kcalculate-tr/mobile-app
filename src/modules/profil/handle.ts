// Kullanıcı adı (@handle) doğrulama — SAF (native/ağ yok). Benzersizlik SUNUCUDA
// (claim_handle) denetlenir; burada yalnız BİÇİM denetimi yapılır. Instagram/X
// benzeri kurallar: küçük harf, rakam, alt çizgi, nokta; başta/sonda nokta yok;
// ardışık nokta yok; 3–30 karakter; rezerve adlar yasak. (G9-3d: sunucu CHECK /
// claim_handle / check_handle ile birebir aynı kural ve uzunluk — 3–30.)

export type HandleReason =
  | 'empty'
  | 'too_short'
  | 'too_long'
  | 'invalid_chars'
  | 'edge_dot'
  | 'consecutive_dots'
  | 'reserved';

export interface HandleCheck {
  ok: boolean;
  reason: HandleReason | null;
  normalized: string;
}

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

// Kurumsal/sistem adları — kullanıcı alamaz. (G11-1: liste + kural sunucu
// public.handle_is_reserved() ile BİREBİR; ortak test vektörü
// __tests__/handle.reserved.test.ts + supabase/tests/feed_rls_test.sql T28.)
// Ayrılmışlık iki yoldan: (a) tam eşleşme (aşağıdaki liste), (b) marka önekiyle
// başlayıp ardından harf/rakam gelen adlar (kcal*, eatkcal* — ör. `kcalofficial`).
// Noktalı/alt çizgili türevler (örn. `kcal.official`, `kcal_`) ayrılmış DEĞİL:
// marka önekinden sonra ayraç (./_) geldiği için impersonation sayılmaz.
const RESERVED_EXACT = new Set([
  'admin',
  'administrator',
  'kcal',
  'kcalai',
  'kcalculate',
  'kcalculateai',
  'eatkcal',
  'support',
  'destek',
  'yardim',
  'help',
  'root',
  'null',
  'undefined',
  'system',
  'sistem',
  'moderator',
  'mod',
  'official',
  'resmi',
  'api',
  'www',
  'app',
]);

// `kcalculate` zaten `kcal` önekiyle kapsanır; yine de netlik için ikisi de yok,
// `kcal` + `eatkcal` yeterli (kcal, kcalculate'in de önekidir).
const RESERVED_BRAND_PREFIXES = ['kcal', 'eatkcal'];

/** Ayrılmış ad mı? normalized zaten küçük harf + kırpılmış olmalı. */
export function isReservedHandle(normalized: string): boolean {
  if (RESERVED_EXACT.has(normalized)) return true;
  for (const prefix of RESERVED_BRAND_PREFIXES) {
    if (
      normalized.length > prefix.length &&
      normalized.startsWith(prefix) &&
      /[a-z0-9]/.test(normalized[prefix.length])
    ) {
      return true;
    }
  }
  return false;
}

const VALID_CHARS = /^[a-z0-9_.]+$/;

/** Girdiyi handle biçimine indirger: kırp + küçük harf. @ önekini at. */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, '').toLowerCase();
}

/** Biçim denetimi. Benzersizlik DEĞİL — o sunucuda. */
export function validateHandle(input: string): HandleCheck {
  const normalized = normalizeHandle(input);
  if (normalized.length === 0) return { ok: false, reason: 'empty', normalized };
  if (normalized.length < HANDLE_MIN) return { ok: false, reason: 'too_short', normalized };
  if (normalized.length > HANDLE_MAX) return { ok: false, reason: 'too_long', normalized };
  if (!VALID_CHARS.test(normalized)) return { ok: false, reason: 'invalid_chars', normalized };
  if (normalized.startsWith('.') || normalized.endsWith('.')) {
    return { ok: false, reason: 'edge_dot', normalized };
  }
  if (normalized.includes('..')) return { ok: false, reason: 'consecutive_dots', normalized };
  if (isReservedHandle(normalized)) return { ok: false, reason: 'reserved', normalized };
  return { ok: true, reason: null, normalized };
}

/** Doğrulama hatasını i18n anahtarına eşle (profil.* altında). */
export function handleReasonI18nKey(reason: HandleReason): string {
  switch (reason) {
    case 'too_short':
      return 'profil.handle_too_short';
    case 'too_long':
      return 'profil.handle_too_long';
    case 'reserved':
      return 'profil.handle_taken';
    default:
      return 'profil.handle_invalid';
  }
}
