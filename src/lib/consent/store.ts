// G20-S1 — Rıza kaydı: cihaz (AsyncStorage) + sunucu (user_consents).
//
// Hesap oluşturulurken kullanıcı henüz giriş yapmamıştır → satırlar cihazda
// BEKLER (`@kcal_consent_pending`), oturum açılınca `flushPending` yazar. Yazım
// başarısızsa (migration henüz yok / çevrimdışı) satırlar kalır, sonraki açılışta
// yeniden denenir. Cihaz kaydı (`@kcal_consent_policy`) kabul anında yazılır →
// bilgilendirme sheet'i bir kez gösterilir.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getSupabaseClient } from '../../core/supabase';
import { setAdConsent, setFirstPartyConsent } from '../analytics';
import { saveAgeOk } from '../../modules/onboarding/first/store';
import {
  DEFAULT_VERSIONS,
  DOC_SLUG,
  PENDING_KEY,
  POLICY_KEY,
  appendPending,
  parsePending,
  parsePolicyRecord,
  policyRows,
  toggleRow,
  versionsFrom,
  type ConsentRow,
  type ConsentSource,
  type DocVersions,
  type PolicyRecord,
  type ServerStatus,
} from './policy';

const appVersion = (): string | null => Constants.expoConfig?.version ?? null;
const platform = (): string | null => (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null);

// ── Değişiklik bildirimi (kapı + ayar sayfası dinler) ─────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();
export function onConsentChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const emit = () => {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      /* dinleyici hatası yutulur */
    }
  }
};

// ── Kapı tutma ────────────────────────────────────────────────────────────────
// Hesap oluşturma sürerken (Apple/Google sheet'i, e-posta kodu) oturum kabul
// kaydından ÖNCE açılabilir; bu sırada kapı "mevcut kullanıcı" sheet'i göstermesin
// diye akış kapıyı tutar.
let holds = 0;
export function holdGate(): () => void {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    emit();
  };
}
export const gateHeld = (): boolean => holds > 0;

// ── Cihaz kaydı ───────────────────────────────────────────────────────────────
export async function readPolicyRecord(): Promise<PolicyRecord | null> {
  try {
    return parsePolicyRecord(await AsyncStorage.getItem(POLICY_KEY));
  } catch {
    return null;
  }
}

async function writePolicyRecord(v: DocVersions): Promise<void> {
  try {
    await AsyncStorage.setItem(POLICY_KEY, JSON.stringify({ v, at: new Date().toISOString() }));
  } catch {
    /* bellekte değil; sonraki açılışta sheet yeniden gelebilir */
  }
}

/** Sunucuda kabul görülen sürümleri cihaza yansıt (başka cihazda kabul). */
export async function rememberAccepted(v: DocVersions): Promise<void> {
  await writePolicyRecord(v);
}

async function queueRows(rows: ConsentRow[]): Promise<void> {
  try {
    const prev = parsePending(await AsyncStorage.getItem(PENDING_KEY));
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(appendPending(prev, rows)));
  } catch {
    /* yazılamadı */
  }
}

// ── Sunucu ────────────────────────────────────────────────────────────────────
/** Herkese açık legal_documents → güncel sürümler (sürüm alanı yoksa 1). */
export async function fetchDocVersions(): Promise<DocVersions> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('legal_documents')
      .select('slug, version')
      .in('slug', [DOC_SLUG.terms, DOC_SLUG.privacy]);
    if (error || !Array.isArray(data)) return { ...DEFAULT_VERSIONS };
    return versionsFrom(data as { slug: unknown; version: unknown }[]);
  } catch {
    return { ...DEFAULT_VERSIONS };
  }
}

/** my_consent_status() — null: okunamadı (migration yok / ağ yok). */
export async function fetchServerStatus(): Promise<ServerStatus | null> {
  try {
    const { data, error } = await getSupabaseClient().rpc('my_consent_status');
    if (error || !data || typeof data !== 'object') return null;
    const d = data as Partial<ServerStatus>;
    if (!Array.isArray(d.docs)) return null;
    return {
      docs: d.docs,
      ad_measurement: typeof d.ad_measurement === 'boolean' ? d.ad_measurement : null,
      first_party: typeof d.first_party === 'boolean' ? d.first_party : null,
      ai_photo: typeof d.ai_photo === 'boolean' ? d.ai_photo : null,
      ai_photo_version: typeof d.ai_photo_version === 'number' && d.ai_photo_version >= 1 ? Math.floor(d.ai_photo_version) : null,
    };
  } catch {
    return null;
  }
}

let flushing: Promise<void> | null = null;
/** Bekleyen satırları oturumdaki kullanıcı adına yaz. */
export function flushPending(userId: string): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      await flushQueue(PENDING_KEY, userId);
      // G27-S1: yan kuyruk AYRI yazılır — yeni kind'lar (health_data) migration uygulanmadıysa
      // CHECK ile reddedilir; ortak kuyruktaki politika satırlarını tıkamasın.
      await flushQueue(SIDE_PENDING_KEY, userId);
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

async function flushQueue(key: string, userId: string): Promise<void> {
  try {
    const rows = parsePending(await AsyncStorage.getItem(key));
    if (!rows.length) return;
    const { error } = await getSupabaseClient()
      .from('user_consents')
      .insert(rows.map((r) => ({ ...r, user_id: userId })));
    if (!error) await AsyncStorage.removeItem(key);
    else if (__DEV__) console.warn(`[consent] user_consents yazılamadı (bekliyor, ${key}):`, error.message);
  } catch {
    /* sonraki açılışta yeniden */
  }
}

/** G27-S1: yeni kind'lı satırların yan kuyruğu (ortak kuyruktan bağımsız yazılır). */
export const SIDE_PENDING_KEY = '@kcal_consent_pending_side';

async function queueSideRows(rows: ConsentRow[]): Promise<void> {
  try {
    const prev = parsePending(await AsyncStorage.getItem(SIDE_PENDING_KEY));
    await AsyncStorage.setItem(SIDE_PENDING_KEY, JSON.stringify(appendPending(prev, rows)));
  } catch {
    /* cihaz kuyruğu yazılamadı */
  }
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Satırları kuyruğa al; oturum varsa hemen yazmayı dene. */
async function record(rows: ConsentRow[]): Promise<void> {
  await queueRows(rows);
  const uid = await currentUserId();
  if (uid) await flushPending(uid);
}

/** G20-S3: başka rıza modülleri (ai_photo) aynı kuyruk + yazım yolunu kullanır. */
export const recordConsentRows = record;
/** G20-S3: değişikliği dinleyicilere duyur (ayar sayfası yenilensin). */
export const emitConsentChange = emit;
export const consentPlatform = platform;
export const consentAppVersion = appVersion;

// ── Eylemler ──────────────────────────────────────────────────────────────────
/**
 * Politika kabulü (hesap oluşturma bloğu · bilgilendirme · tekrar kabul):
 * cihaz kaydı + reklam rızası + user_consents satırları.
 */
export async function acceptPolicies(i: {
  source: Extract<ConsentSource, 'signup_email' | 'signup_social' | 'notice' | 'reconsent'>;
  adOn: boolean;
  versions?: DocVersions;
  /** G20-S3 md.6: kutu 18+ beyanını da içeriyordu → profiles.onboarding_state.age_ok. */
  ageOk?: boolean;
}): Promise<void> {
  const versions = i.versions ?? (await fetchDocVersions());
  await setAdConsent(i.adOn ? 'granted' : 'denied');
  await writePolicyRecord(versions);
  emit();
  await record(
    policyRows({
      versions,
      adOn: i.adOn,
      source: i.source,
      platform: platform(),
      appVersion: appVersion(),
      at: new Date().toISOString(),
    }),
  );
  if (i.ageOk) await recordAgeOk();
}

export const AGE_CONFIRMED_KEY = '@kcal_age_18_confirmed';

/**
 * 18+ beyanı: cihaz (eski giriş ekranıyla aynı anahtar) + oturum varsa hesaba
 * (`profiles.onboarding_state.age_ok`). Hata yutulur — beyan ekranda verildi.
 */
export async function recordAgeOk(): Promise<void> {
  try {
    await AsyncStorage.setItem(AGE_CONFIRMED_KEY, 'true');
  } catch {
    /* cihaz kaydı yazılamadı */
  }
  const uid = await currentUserId();
  if (uid) await saveAgeOk(uid).catch(() => false);
}

/** Ayarlar: reklam ölçümü (Meta) aç/kapa. */
export async function setAdMeasurement(on: boolean, source: ConsentSource = 'settings'): Promise<void> {
  await setAdConsent(on ? 'granted' : 'denied');
  emit();
  await record([
    toggleRow({ kind: 'ad_measurement', granted: on, source, platform: platform(), appVersion: appVersion(), at: new Date().toISOString() }),
  ]);
}

/** Ayarlar: uygulama içi kullanım ölçümü aç/kapa. */
export async function setUsageMeasurement(on: boolean): Promise<void> {
  await setFirstPartyConsent(on);
  emit();
  await record([
    toggleRow({ kind: 'first_party', granted: on, source: 'settings', platform: platform(), appVersion: appVersion(), at: new Date().toISOString() }),
  ]);
}

// ── G27-S1: sağlık verisi açık rızası (Takibe başla › Seni tanıyalım) ───────────
export const HEALTH_CONSENT_KEY = '@kcal_health_consent';
/** Metin sürümü (tb.about.consent): metin değişirse artır → bir sonraki onayda yeni satır yazılır. */
export const HEALTH_CONSENT_VERSION = 1;

/**
 * Sağlık verisi (boy, kilo, yaş, cinsiyet) açık rızası → user_consents AYRI satır
 * (kind 'health_data'). Aynı sürümde aynı değer cihazda zaten kayıtlıysa tekrar yazılmaz
 * (akış geri-ileri gezilirse satır çoğalmasın). Oturum yoksa satır yan kuyrukta bekler.
 */
export async function recordHealthConsent(granted: boolean, source: Extract<ConsentSource, 'takibe' | 'settings'> = 'takibe'): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(HEALTH_CONSENT_KEY);
    const prev = raw ? (JSON.parse(raw) as { granted?: unknown; v?: unknown }) : null;
    if (prev && prev.granted === granted && Number(prev.v) >= HEALTH_CONSENT_VERSION) return false;
  } catch {
    /* okunamadı → yaz */
  }
  const at = new Date().toISOString();
  try {
    await AsyncStorage.setItem(HEALTH_CONSENT_KEY, JSON.stringify({ granted, v: HEALTH_CONSENT_VERSION, at }));
  } catch {
    /* cihaz kaydı yazılamadı */
  }
  await queueSideRows([
    { kind: 'health_data', doc_slug: null, doc_version: null, granted, source, platform: platform(), app_version: appVersion(), created_at: at },
  ]);
  const uid = await currentUserId();
  if (uid) await flushPending(uid);
  emit();
  return true;
}
