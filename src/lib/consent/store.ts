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
import { getConsent, setAdConsent, setFirstPartyConsent } from '../analytics';
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
// ve ATT sorusu giriş sheet'inin üstüne binmesin diye akış kapıyı tutar.
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
      const rows = parsePending(await AsyncStorage.getItem(PENDING_KEY));
      if (!rows.length) return;
      const { error } = await getSupabaseClient()
        .from('user_consents')
        .insert(rows.map((r) => ({ ...r, user_id: userId })));
      if (!error) await AsyncStorage.removeItem(PENDING_KEY);
      else if (__DEV__) console.warn('[consent] user_consents yazılamadı (bekliyor):', error.message);
    } catch {
      /* sonraki açılışta yeniden */
    } finally {
      flushing = null;
    }
  })();
  return flushing;
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

// ── Eylemler ──────────────────────────────────────────────────────────────────
/**
 * Politika kabulü (hesap oluşturma bloğu · bilgilendirme · tekrar kabul):
 * cihaz kaydı + reklam rızası + user_consents satırları.
 */
export async function acceptPolicies(i: {
  source: Extract<ConsentSource, 'signup_email' | 'signup_social' | 'notice' | 'reconsent'>;
  adOn: boolean;
  versions?: DocVersions;
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

/** iOS ATT sonucu (politika bloğundan SONRA sorulur). Red → Meta kapalı. */
export async function recordAtt(granted: boolean): Promise<void> {
  const rows: ConsentRow[] = [
    toggleRow({ kind: 'att', granted, source: 'att', platform: platform(), appVersion: appVersion(), at: new Date().toISOString() }),
  ];
  if (!granted && getConsent().adConsent !== 'denied') {
    await setAdConsent('denied');
    rows.push(
      toggleRow({ kind: 'ad_measurement', granted: false, source: 'att', platform: platform(), appVersion: appVersion(), at: new Date().toISOString() }),
    );
  }
  emit();
  await record(rows);
}
