// G19-S3 — Rıza kararları (saf).
//
// İki ayrı ölçüm:
//  • Meta (üçüncü taraf, reklam): iOS'ta ATT izni ŞART; ayrıca uygulama içi
//    reklam rızası 'denied' ise her platformda KAPALI.
//      - adConsent 'unset' → bugünkü davranış korunur (iOS: ATT'ye bağlı,
//        Android: açık). KVKK açık rıza varsayılanı için bkz. LOG SORULAR.
//  • Birinci taraf (Supabase analytics_events): KVKK aydınlatması ile
//    (metin: core/i18n metrics.kvkk.*); kullanıcı "Kullanım ölçümü"nü
//    kapatırsa (firstParty=false) hiç yazılmaz.

export type AttStatus = 'granted' | 'denied' | 'undetermined' | 'restricted' | 'unavailable';
export type AdConsent = 'unset' | 'granted' | 'denied';

export interface ConsentState {
  platform: string; // Platform.OS
  att: AttStatus;
  adConsent: AdConsent;
  firstParty: boolean;
}

export const AD_CONSENT_KEY = '@kcal_consent_ads';
export const FIRST_PARTY_KEY = '@kcal_consent_first_party';

/** Meta SDK'ya olay gidebilir mi / IDFA toplanabilir mi? */
export function metaAllowed(s: Pick<ConsentState, 'platform' | 'att' | 'adConsent'>): boolean {
  if (s.adConsent === 'denied') return false;
  if (s.platform === 'ios') return s.att === 'granted';
  return true;
}

/** expo-tracking-transparency durum dizesini AttStatus'a çevirir. */
export function toAttStatus(platform: string, raw: string | null | undefined): AttStatus {
  if (platform !== 'ios') return 'unavailable';
  switch (raw) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'restricted':
      return 'restricted';
    default:
      return 'undetermined';
  }
}

export function parseAdConsent(raw: string | null | undefined): AdConsent {
  return raw === 'granted' || raw === 'denied' ? raw : 'unset';
}

export function parseFirstParty(raw: string | null | undefined): boolean {
  return raw !== '0';
}

/**
 * initFBSDK sırasında Settings'e verilecek değerler. Sıra analytics.ts'de
 * sabittir: ATT iste → setAdvertiserTrackingEnabled → setAdvertiserIDCollectionEnabled
 * → initializeSDK.
 */
export function fbSettingsFor(s: Pick<ConsentState, 'platform' | 'att' | 'adConsent'>): {
  advertiserTracking: boolean;
  advertiserIdCollection: boolean;
} {
  const allowed = metaAllowed(s);
  return { advertiserTracking: allowed, advertiserIdCollection: allowed };
}
