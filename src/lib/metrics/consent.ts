// G19-S3 — Rıza kararları (saf).
//
// İki ayrı ölçüm:
//  • Meta (üçüncü taraf, reklam): YALNIZ uygulama içi reklam rızasına bağlı;
//    'denied' ise her platformda KAPALI.
//      - G27-S1 (İlter 11 Kas, KVKK açık rıza): varsayılan KAPALI. Yalnız uygulama içi
//        tercihte açıkça 'granted' ise olay gider; 'unset' = kapalı (iOS + Android).
//      - G41-S1 md.1/2 (13 Kas): iOS ATT GERİ GELDİ ama YALNIZ kayıttaki isteğe bağlı
//        Meta kutusu işaretlenince (açılışta asla). iOS'ta olay için ayrıca ATT = 'granted'
//        şart; reddedilirse Meta'ya cihaz kimliği (IDFA) gitmez ve olay gönderilmez.
//  • Birinci taraf (Supabase analytics_events): KVKK aydınlatması ile
//    (metin: core/i18n metrics.kvkk.*); kullanıcı "Kullanım ölçümü"nü
//    kapatırsa (firstParty=false) hiç yazılmaz.

export type AdConsent = 'unset' | 'granted' | 'denied';

/** iOS App Tracking Transparency durumu; iOS dışı her zaman 'unavailable'. */
export type AttStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface ConsentState {
  platform: string; // Platform.OS
  adConsent: AdConsent;
  firstParty: boolean;
  att: AttStatus;
}

/** ATT sistem durumu (`status` dizesi) → AttStatus (iOS dışı 'unavailable'). */
export function toAttStatus(platform: string, raw: string | null | undefined): AttStatus {
  if (platform !== 'ios') return 'unavailable';
  return raw === 'granted' || raw === 'denied' ? raw : 'undetermined';
}

export const AD_CONSENT_KEY = '@kcal_consent_ads';
export const FIRST_PARTY_KEY = '@kcal_consent_first_party';

/**
 * Meta SDK'ya olay gidebilir mi? YALNIZ açık rıza ('granted'); 'unset' = kapalı (G27-S1).
 * G41-S1: iOS'ta ayrıca ATT = 'granted' (sorulmadı / reddedildi → kapalı).
 */
export function metaAllowed(s: Pick<ConsentState, 'platform' | 'adConsent' | 'att'>): boolean {
  if (s.adConsent !== 'granted') return false;
  return s.platform !== 'ios' || s.att === 'granted';
}

export function parseAdConsent(raw: string | null | undefined): AdConsent {
  return raw === 'granted' || raw === 'denied' ? raw : 'unset';
}

export function parseFirstParty(raw: string | null | undefined): boolean {
  return raw !== '0';
}

/**
 * initFBSDK sırasında Settings'e verilecek değerler. Sıra analytics.ts'de
 * sabittir: setAdvertiserTrackingEnabled → setAdvertiserIDCollectionEnabled → initializeSDK.
 * G41-S1: iOS'ta izleme + IDFA YALNIZ rıza 'granted' VE ATT 'granted' iken açık; aksi hâlde kapalı.
 * Android: reklam kimliği yalnız açık rızada.
 */
export function fbSettingsFor(s: Pick<ConsentState, 'platform' | 'adConsent' | 'att'>): {
  advertiserTracking: boolean;
  advertiserIdCollection: boolean;
} {
  const allowed = metaAllowed(s);
  return { advertiserTracking: allowed, advertiserIdCollection: allowed };
}
