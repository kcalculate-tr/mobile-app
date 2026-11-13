// G41-S1 md.1/2 — Meta reklam ölçümü onayı + iOS ATT (tek akış).
//
//   kutu işaretlendi ──► (iOS) requestAttOnce ──► izinli → onay AÇIK
//                                            └─► reddedildi/sorulamadı → onay "verilmedi" (kutu boş)
//   kutu kaldırıldı  ──► onay kapalı (ATT sorulmaz)
//
// Saklama YENİ TABLO AÇMAZ: mevcut `@kcal_consent_ads` (analytics.setAdConsent) + `user_consents`
// satırları (kind 'ad_measurement' / 'att', source 'att' — CHECK'te G20'den beri var).
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureConsentLoaded, getConsent, setAttStatus } from '../analytics';
import { requestAttOnce, type AttOutcome } from '../att';
import { metaAllowed, type AttStatus } from '../metrics/consent';
import { consentAppVersion, consentPlatform, recordConsentRows, setAdMeasurement } from './store';
import { toggleRow } from './policy';

/** ATT sonucunu bellekte güncelle + soruldıysa user_consents'e 'att' satırı (oturum yoksa bekler). */
async function applyAttOutcome(o: AttOutcome): Promise<void> {
  setAttStatus(o.status);
  if (!o.asked) return;
  await recordConsentRows([
    toggleRow({
      kind: 'att',
      granted: o.status === 'granted',
      source: 'att',
      platform: consentPlatform(),
      appVersion: consentAppVersion(),
      at: new Date().toISOString(),
    }),
  ]).catch(() => {});
}

/**
 * Kutu / satır AÇILMAK istendi → etkin değer. iOS'ta ATT YALNIZ burada (kullanıcı eylemiyle)
 * sorulur; izin yoksa false döner ("verilmedi"). Android'de doğrudan true.
 * Onayı KAYDETMEZ — çağıran kaydeder (kayıtta acceptPolicies, ayarlarda setMetaMeasurement).
 */
export async function requestMetaOptIn(): Promise<{ granted: boolean; att: AttStatus }> {
  if (Platform.OS !== 'ios') return { granted: true, att: 'unavailable' };
  const o = await requestAttOnce();
  await applyAttOutcome(o);
  return { granted: o.status === 'granted', att: o.status };
}

export type MetaToggleResult = { on: boolean; att: AttStatus };

/**
 * Profil › Gizlilik › "Meta reklam ölçümü" satırı. Kapatma her zaman olur (geri çekme).
 * Açma: iOS'ta ATT izinli olmalı; reddedilmişse kapalı kalır (iOS Ayarlar'dan açılabilir).
 */
export async function setMetaMeasurement(on: boolean): Promise<MetaToggleResult> {
  if (!on) {
    await setAdMeasurement(false);
    return { on: false, att: getConsent().att };
  }
  const r = await requestMetaOptIn();
  if (!r.granted) {
    await setAdMeasurement(false, 'att');
    return { on: false, att: r.att };
  }
  await setAdMeasurement(true);
  return { on: true, att: r.att };
}

/** Etkin Meta durumu (rıza + iOS'ta ATT) — Gizlilik satırı "Açık/Kapalı". */
export async function readMetaEffective(): Promise<boolean> {
  await ensureConsentLoaded();
  return metaAllowed(getConsent());
}

// ── Mevcut kullanıcı: tek seferlik bilgi kartı + ATT ───────────────────────────
export const ATT_NOTICE_KEY = '@kcal_att_notice_shown';

/**
 * Önceki sürümde Meta anahtarı AÇIK olan iOS kullanıcısı (rıza 'granted') için ATT sonucu yoksa
 * ('undetermined') bir sonraki açılışta TEK SEFER kart. Kart gösterildiği anda işaretlenir.
 */
export async function shouldShowAttNotice(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  await ensureConsentLoaded();
  const c = getConsent();
  if (c.adConsent !== 'granted' || c.att !== 'undetermined') return false;
  try {
    return (await AsyncStorage.getItem(ATT_NOTICE_KEY)) == null;
  } catch {
    return false;
  }
}

export async function markAttNoticeShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(ATT_NOTICE_KEY, new Date().toISOString());
  } catch {
    /* yazılamadı — en kötü ihtimalle bir kez daha */
  }
}

/** Kart "Devam" → ATT. Reddedilirse onay "verilmedi" olur (setAdMeasurement false, source 'att'). */
export async function continueAttNotice(): Promise<boolean> {
  const r = await requestMetaOptIn();
  if (!r.granted) await setAdMeasurement(false, 'att');
  return r.granted;
}
