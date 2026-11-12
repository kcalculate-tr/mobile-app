// G19-S3 — Rıza kararları (saf).
//
// İki ayrı ölçüm:
//  • Meta (üçüncü taraf, reklam): YALNIZ uygulama içi reklam rızasına bağlı;
//    'denied' ise her platformda KAPALI. G26-S1 (İlter 11 Kas): iOS ATT KALDIRILDI —
//    Apple izleme sorusu hiç gösterilmez, iOS'ta `setAdvertiserTrackingEnabled(false)`
//    ve IDFA toplama kapalı SABİT. Meta ölçümü ATT'siz (AEM / SKAdNetwork) sürer.
//      - G27-S1 (İlter 11 Kas, KVKK açık rıza): varsayılan KAPALI. Yalnız uygulama içi
//        tercihte açıkça 'granted' ise olay gider; 'unset' = kapalı (iOS + Android).
//  • Birinci taraf (Supabase analytics_events): KVKK aydınlatması ile
//    (metin: core/i18n metrics.kvkk.*); kullanıcı "Kullanım ölçümü"nü
//    kapatırsa (firstParty=false) hiç yazılmaz.

export type AdConsent = 'unset' | 'granted' | 'denied';

export interface ConsentState {
  platform: string; // Platform.OS
  adConsent: AdConsent;
  firstParty: boolean;
}

export const AD_CONSENT_KEY = '@kcal_consent_ads';
export const FIRST_PARTY_KEY = '@kcal_consent_first_party';

/** Meta SDK'ya olay gidebilir mi? YALNIZ açık rıza ('granted'); 'unset' = kapalı (G27-S1). */
export function metaAllowed(s: Pick<ConsentState, 'adConsent'>): boolean {
  return s.adConsent === 'granted';
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
 * iOS: izleme ve IDFA HER ZAMAN kapalı (ATT yok). Android: reklam kimliği yalnız açık rızada.
 */
export function fbSettingsFor(s: Pick<ConsentState, 'platform' | 'adConsent'>): {
  advertiserTracking: boolean;
  advertiserIdCollection: boolean;
} {
  if (s.platform === 'ios') return { advertiserTracking: false, advertiserIdCollection: false };
  const allowed = metaAllowed(s);
  return { advertiserTracking: allowed, advertiserIdCollection: allowed };
}
