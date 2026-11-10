// G22-S2 md.5 (Tur 26j, G21 T3 — FinOnbAccountError) — Apple / Google giriş
// sonucunu SAF olarak sınıflar. Native modül import ETMEZ (tsx --test altında
// koşar); kodlar kütüphanelerin gerçek değerleridir:
//
//  • expo-apple-authentication (iOS): ASAuthorizationError → Expo istisnası →
//    kod `ERR_REQUEST_CANCELED` (iptal), `ERR_REQUEST_FAILED`, `ERR_REQUEST_UNKNOWN`,
//    `ERR_INVALID_RESPONSE`, `ERR_REQUEST_NOT_HANDLED`, `ERR_REQUEST_NOT_INTERACTIVE`.
//    Eski SDK / web: `ERR_CANCELED`.
//  • @react-native-google-signin: statusCodes.SIGN_IN_CANCELLED iOS'ta
//    kGIDSignInErrorCodeCanceled = "-5", Android'de "12501"; yeni API iptalde
//    `{ type: 'cancelled' }` döner (AuthContext bunu `cancelled: true` yapar).
//    Ağ: Android CommonStatusCodes.NETWORK_ERROR = "7"; iOS NSURLError -1009 vb.
//  • Supabase signInWithIdToken: ağ kopukken `AuthRetryableFetchError` (status 0).
//
// Karar (tasarım notu): İPTAL = SESSİZ (uyarı yok, toast yok). Ağ / hesap hatası =
// Apple–Google düğmelerinin hemen altında satır içi uyarı + "Tekrar dene".

export type SocialAuthFailure = 'cancel' | 'network' | 'account';

export interface SocialAuthOutcome {
  /** AuthContext `SocialSignInResult.cancelled`. */
  cancelled?: boolean;
  /** AuthContext `SocialSignInResult.error` (mesaj). null/undefined → başarı. */
  error?: string | null;
  /** Ham hata kodu (Expo `code`, Google `code`, Supabase `name`/`code`). */
  errorCode?: string | number | null;
  /** Cihaz çevrimdışı mı (NetInfo). false → her hata ağ sayılır. */
  online?: boolean | null;
}

const CANCEL_CODES = new Set([
  'ERR_REQUEST_CANCELED',
  'ERR_CANCELED',
  'ERR_CANCELLED',
  'SIGN_IN_CANCELLED',
  '-5', // iOS kGIDSignInErrorCodeCanceled
  '12501', // Android GoogleSignInStatusCodes.SIGN_IN_CANCELLED
]);

const NETWORK_CODES = new Set([
  'NETWORK_ERROR',
  'AuthRetryableFetchError',
  '7', // Android CommonStatusCodes.NETWORK_ERROR
  '-1001', // NSURLErrorTimedOut
  '-1004', // NSURLErrorCannotConnectToHost
  '-1005', // NSURLErrorNetworkConnectionLost
  '-1009', // NSURLErrorNotConnectedToInternet
  '-1020', // NSURLErrorDataNotAllowed
]);

const NETWORK_TEXT =
  /network|internet|offline|timed? ?out|failed to fetch|fetch failed|connection|unreachable|bağlantı|çevrimdışı/i;

/**
 * Sınıflandır. Başarıda (hata yok, iptal yok) `null` döner.
 * Öncelik: iptal > ağ > hesap.
 */
export function classifySocialAuthError(o: SocialAuthOutcome): SocialAuthFailure | null {
  const code = o.errorCode == null ? '' : String(o.errorCode);
  if (o.cancelled || CANCEL_CODES.has(code)) return 'cancel';
  const msg = o.error ?? '';
  if (!msg && !code) return null;
  if (o.online === false) return 'network';
  if (NETWORK_CODES.has(code) || NETWORK_TEXT.test(msg)) return 'network';
  return 'account';
}

/** Kullanıcıya uyarı gösterilmeli mi? (iptal sessiz.) */
export function shouldShowAuthAlert(kind: SocialAuthFailure | null): kind is 'network' | 'account' {
  return kind === 'network' || kind === 'account';
}

/** Satır içi uyarının i18n anahtarları (sağlayıcıya göre hesap başlığı). */
export function authAlertKeys(
  kind: 'network' | 'account',
  provider: 'apple' | 'google',
): { title: string; body: string } {
  if (kind === 'network') return { title: 'auth_error.net_title', body: 'auth_error.net_body' };
  return {
    title: provider === 'apple' ? 'auth_error.acc_apple_title' : 'auth_error.acc_google_title',
    body: 'auth_error.acc_body',
  };
}

/** Hata nesnesinden kodu çıkar (Expo/Google `code`, Supabase `name`). */
export function errorCodeOf(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as { code?: unknown; name?: unknown; status?: unknown };
  if (e.code != null && String(e.code) !== '') return String(e.code);
  if (e.name === 'AuthRetryableFetchError') return 'AuthRetryableFetchError';
  if (e.status === 0) return 'NETWORK_ERROR';
  return undefined;
}
