// G19-S3 — Ölçüm istemcisi (tek giriş: `track(name, props)`).
//
//   track() ──► sözlük (metrics/events.ts) ─► beyaz liste + PII süzgeci (sanitize.ts)
//          ├─► Meta SDK — YALNIZ reklam olayları (sözlükte `meta`), rıza açıksa (G41: iOS'ta + ATT izinli)
//          └─► kuyruk (queue.ts) ─► Supabase analytics_events (toplu, çevrimdışı, yeniden deneme)
//
// Kimlik: anon_id (cihazda kalıcı) her satırda; giriş yapılmışsa user_id.
// Girişte `login`/`signup` olayı iki kimliği birlikte taşır → sunucu anon_id
// ile girişten önceki olayları kullanıcıya bağlar.
// Oturum: 30 dk sessizlikte yeni session_id (SessionClock).
// Kaynak: ilk açılışta first_touch; sipariş olaylarına ilk/son dokunma (attribution.ts).
// Rıza: consent.ts. Meta'ya ASLA: kişisel veri, beslenme verisi, marj/maliyet.
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { getSupabaseClient } from '../core/supabase';
import { EVENTS, eventDef, isClientEvent, type ClientEventName, type PropsOf } from './metrics/events';
import { sanitizeProps } from './metrics/sanitize';
import { EventQueue, SessionClock, genId, isRetryableError, type AnalyticsRow } from './metrics/queue';
import { activeSahaCode, attributionProps, captureTouch, isSahaCode, type Touch } from './metrics/attribution';
import {
  AD_CONSENT_KEY,
  FIRST_PARTY_KEY,
  fbSettingsFor,
  metaAllowed,
  parseAdConsent,
  parseFirstParty,
  type AdConsent,
  type AttStatus,
} from './metrics/consent';
import { getAttStatus } from './att';

export type { ClientEventName, PropsOf } from './metrics/events';

// ── Rıza durumu ───────────────────────────────────────────────────────────
let adConsent: AdConsent = 'unset';
let firstParty = true;
// G41-S1: iOS ATT durumu açılışta yalnız OKUNUR (soru yok); soru yalnız lib/att.ts (kullanıcı eylemiyle).
let att: AttStatus = Platform.OS === 'ios' ? 'undetermined' : 'unavailable';
let consentLoad: Promise<void> | null = null;

const loadConsent = (): Promise<void> => {
  if (!consentLoad) {
    consentLoad = (async () => {
      try {
        const [a, f, s] = await Promise.all([
          AsyncStorage.getItem(AD_CONSENT_KEY),
          AsyncStorage.getItem(FIRST_PARTY_KEY),
          getAttStatus(),
        ]);
        adConsent = parseAdConsent(a);
        firstParty = parseFirstParty(f);
        att = s;
      } catch {
        /* varsayılanlar */
      }
    })();
  }
  return consentLoad;
};

export const getConsent = () => ({ platform: Platform.OS, adConsent, firstParty, att });

/** Açılışta rıza + ATT durumunun diskten/sistemden okunmasını bekle (soru yok). */
export const ensureConsentLoaded = (): Promise<void> => loadConsent();

const consentState = () => ({ platform: Platform.OS, adConsent, att });

const applyFbSettings = (): void => {
  const s = fbSettingsFor(consentState());
  // G27-S1: otomatik uygulama olayları (yükleme / etkinleştirme) da yalnız açık rızada.
  // app.config autoLogAppEventsEnabled=false → varsayılan kapalı; burada rızaya göre açılır.
  // G41-S1: iOS'ta ayrıca ATT izinli olmalı (metaAllowed).
  const allowed = metaAllowed(consentState());
  if (Platform.OS === 'ios') {
    void Settings.setAdvertiserTrackingEnabled(s.advertiserTracking);
    Settings.setAdvertiserIDCollectionEnabled(s.advertiserIdCollection);
  } else {
    Settings.setAdvertiserIDCollectionEnabled(s.advertiserIdCollection);
  }
  Settings.setAutoLogAppEventsEnabled(allowed);
};

/** Uygulama içi reklam rızası (G20-S1: hesap oluşturma bloğu + Veri ve reklam izinleri sayfası). */
export const setAdConsent = async (value: Exclude<AdConsent, 'unset'>): Promise<void> => {
  adConsent = value;
  try {
    await AsyncStorage.setItem(AD_CONSENT_KEY, value);
  } catch {
    /* bellekte geçerli */
  }
  if (initialized) {
    try {
      applyFbSettings();
    } catch {
      /* SDK yoksa yut */
    }
  }
};

/** G41-S1: ATT sonucu (kutu / Gizlilik satırı / bilgi kartı sonrası) — Meta ayarları yenilenir. */
export const setAttStatus = (value: AttStatus): void => {
  att = value;
  if (initialized) {
    try {
      applyFbSettings();
    } catch {
      /* SDK yoksa yut */
    }
  }
};

/** Birinci taraf kullanım ölçümü aç/kapa (KVKK: itiraz hakkı). */
export const setFirstPartyConsent = async (on: boolean): Promise<void> => {
  firstParty = on;
  try {
    await AsyncStorage.setItem(FIRST_PARTY_KEY, on ? '1' : '0');
  } catch {
    /* bellekte geçerli */
  }
};

// ── Meta SDK ─────────────────────────────────────────────────────────────
let initialized = false;

/**
 * Meta SDK başlatma. G41-S1 (İlter 13 Kas): açılışta ATT SORULMAZ — yalnız mevcut durum
 * okunur (getAttStatus). iOS'ta `setAdvertiserTrackingEnabled` + IDFA toplama YALNIZ rıza
 * 'granted' VE ATT 'granted' iken true, SONRA initializeSDK (app.config:
 * isAutoInitEnabled=false, advertiserIDCollectionEnabled=false → SDK açılışta IDFA okumaz).
 * G27-S1: olaylar (otomatik olanlar dahil) YALNIZ metaAllowed iken gider (varsayılan kapalı).
 */
export const initFBSDK = async (): Promise<void> => {
  if (initialized) return;
  try {
    await loadConsent();
    const s = fbSettingsFor(consentState());
    if (Platform.OS === 'ios') {
      await Settings.setAdvertiserTrackingEnabled(s.advertiserTracking);
      Settings.setAdvertiserIDCollectionEnabled(s.advertiserIdCollection);
      Settings.setAutoLogAppEventsEnabled(metaAllowed(consentState()));
    } else {
      applyFbSettings();
    }
    Settings.initializeSDK();
    initialized = true;
    if (__DEV__) console.log('[analytics] FB SDK initialized');
  } catch (err) {
    if (__DEV__) console.warn('[analytics] FB SDK init failed:', err);
  }
};

const safeLog = (eventName: string, params: Record<string, string | number>): void => {
  try {
    if (__DEV__) console.log(`[analytics] meta=${eventName}`, params);
    AppEventsLogger.logEvent(eventName, params);
  } catch (err) {
    if (__DEV__) console.warn(`[analytics] logEvent ${eventName} failed:`, err);
  }
};

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Meta uyarlayıcısı — parametreler G3 dönemindeki `logEvent.*` ile BİREBİR
 * (content_id, content_name, currency TRY, value, num_items, order_id,
 * registration_method). Yalnız sözlükte `meta` alanı olan olaylar buraya gelir.
 */
const forwardToMeta = (name: ClientEventName, raw: Record<string, unknown>): void => {
  const adapter = eventDef(name)?.meta;
  if (!adapter) return;
  if (!metaAllowed(consentState())) return;
  switch (adapter) {
    case 'viewContent':
      safeLog(AppEventsLogger.AppEvents.ViewedContent, {
        content_id: String(raw.product_id ?? ''),
        content_name: String(raw.product_name ?? ''),
        currency: 'TRY',
        value: num(raw.price),
      });
      return;
    case 'addToCart': {
      const quantity = num(raw.quantity);
      safeLog(AppEventsLogger.AppEvents.AddedToCart, {
        content_id: String(raw.product_id ?? ''),
        currency: 'TRY',
        value: Number((num(raw.price) * quantity).toFixed(2)),
        num_items: quantity,
      });
      return;
    }
    case 'initiateCheckout':
      safeLog(AppEventsLogger.AppEvents.InitiatedCheckout, {
        currency: 'TRY',
        value: Number(num(raw.price).toFixed(2)),
        num_items: num(raw.num_items),
      });
      return;
    case 'purchase':
      try {
        if (__DEV__) console.log('[analytics] meta=Purchase', { order_id: raw.order_id, price: raw.price });
        AppEventsLogger.logPurchase(Number(num(raw.price).toFixed(2)), 'TRY', { order_id: String(raw.order_id ?? '') });
      } catch (err) {
        if (__DEV__) console.warn('[analytics] logPurchase failed:', err);
      }
      return;
    case 'completeRegistration':
      safeLog(AppEventsLogger.AppEvents.CompletedRegistration, {
        registration_method: String(raw.method ?? 'unknown'),
      });
      return;
  }
};

// ── Kimlik + kuyruk ──────────────────────────────────────────────────────
const ANON_ID_KEY = '@kcal_analytics_anon_id';
const session = new SessionClock();
let cachedAnonId: string | null = null;

const getAnonId = async (): Promise<string> => {
  if (cachedAnonId) return cachedAnonId;
  try {
    const stored = await AsyncStorage.getItem(ANON_ID_KEY);
    if (stored) {
      cachedAnonId = stored;
      return stored;
    }
    const fresh = genId();
    await AsyncStorage.setItem(ANON_ID_KEY, fresh);
    cachedAnonId = fresh;
    return fresh;
  } catch {
    cachedAnonId = cachedAnonId ?? genId();
    return cachedAnonId;
  }
};

const currentUserId = async (): Promise<string | null> => {
  const { data } = await getSupabaseClient().auth.getSession();
  return data?.session?.user?.id ?? null;
};

const queue = new EventQueue({
  storage: AsyncStorage,
  currentUserId,
  schedule: (fn, ms) => setTimeout(fn, ms),
  cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  send: async (rows: AnalyticsRow[]) => {
    // insert dönüşü istenmez (returning=minimal): istemcinin SELECT yetkisi yok (D-S1 A5).
    const { error, status } = await getSupabaseClient().from('analytics_events').insert(rows);
    if (!error) return { ok: true };
    if (__DEV__) console.warn('[analytics] flush failed:', error.message);
    return { ok: false, retryable: isRetryableError({ code: error.code, status, message: error.message }), message: error.message };
  },
});

const appVersion = (): string => Constants.expoConfig?.version ?? '0.0.0';

/**
 * Tek ölçüm giriş noktası. Ad ve prop'lar sözlükle tiplidir; listede olmayan
 * prop ve kişisel veri gibi görünen değer düşer. Hata uygulamayı bozmaz.
 */
export function track<N extends ClientEventName>(name: N, props?: PropsOf<N>): void {
  const raw = (props ?? {}) as Record<string, unknown>;
  // Tip dışından (JS, eski çağrı) gelen bilinmeyen/sunucu adı yazılmaz.
  if (!isClientEvent(name)) {
    if (__DEV__) console.warn(`[analytics] bilinmeyen/sunucu olayı yok sayıldı: ${String(name)}`);
    return;
  }
  try {
    forwardToMeta(name, raw);
  } catch {
    /* Meta hatası birinci taraf ölçümü engellemez */
  }
  const createdAt = new Date().toISOString();
  const sessionId = session.touch().id;
  void (async () => {
    try {
      await loadConsent();
      if (!firstParty) return;
      const def = EVENTS[name] as { attribution?: boolean };
      const merged = def.attribution ? { ...raw, ...(await attributionProps(AsyncStorage)) } : raw;
      const row: AnalyticsRow = {
        event_name: name,
        props: sanitizeProps(name, merged),
        user_id: await currentUserId().catch(() => null),
        anon_id: await getAnonId(),
        session_id: sessionId,
        platform: Platform.OS,
        app_version: appVersion(),
        created_at: createdAt,
      };
      await queue.enqueue(row);
      if (__DEV__) console.log(`[analytics] track(${name})`, row.props);
    } catch (err) {
      if (__DEV__) console.warn(`[analytics] track(${name}) failed:`, err);
    }
  })();
}

// ── Kimlik bağlama (AuthContext SIGNED_IN) ────────────────────────────────
const SIGNUP_SENT_KEY = '@kcal_analytics_signup_sent';
const NEW_USER_WINDOW_MS = 10 * 60 * 1000;
const identified = new Set<string>();

type AuthUserLike = {
  id: string;
  created_at?: string;
  app_metadata?: { provider?: string } | null;
};

export const signupMethod = (provider: string | undefined): 'apple' | 'google' | 'email' | 'phone' | 'unknown' =>
  provider === 'apple' || provider === 'google' || provider === 'email' || provider === 'phone' ? provider : 'unknown';

/** Oturum açıldığında bir kez: yeni hesapsa `signup` (Meta: CompletedRegistration), değilse `login`. */
export const identifyUser = async (user: AuthUserLike | null | undefined, now: number = Date.now()): Promise<void> => {
  if (!user?.id || identified.has(user.id)) return;
  identified.add(user.id);
  const method = signupMethod(user.app_metadata?.provider);
  const created = user.created_at ? Date.parse(user.created_at) : NaN;
  const isNew = Number.isFinite(created) && now - created >= 0 && now - created <= NEW_USER_WINDOW_MS;
  if (isNew) {
    let sent: string[] = [];
    try {
      sent = JSON.parse((await AsyncStorage.getItem(SIGNUP_SENT_KEY)) ?? '[]') as string[];
    } catch {
      sent = [];
    }
    if (!sent.includes(user.id)) {
      try {
        await AsyncStorage.setItem(SIGNUP_SENT_KEY, JSON.stringify([...sent, user.id].slice(-20)));
      } catch {
        /* en kötü: aynı cihazda ikinci signup */
      }
      await rememberIdentified(user.id);
      track('signup', { method });
      return;
    }
  }
  // Oturum geri yüklemesinde (SIGNED_IN tekrar gelebilir) aynı cihaz-kullanıcı
  // çifti bir kez bağlanır; hesap değişince yeniden `login`.
  let last: string | null = null;
  try {
    last = await AsyncStorage.getItem(IDENTIFIED_KEY);
  } catch {
    last = null;
  }
  if (last === user.id) return;
  await rememberIdentified(user.id);
  track('login', { method });
};

const IDENTIFIED_KEY = '@kcal_analytics_identified_uid';
const rememberIdentified = async (uid: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(IDENTIFIED_KEY, uid);
  } catch {
    /* en kötü: bir fazla login */
  }
};

// ── Kupon / saha kodu ────────────────────────────────────────────────────
/** validateCoupon sonucu: saha kodu (SAHA… ya da bağlantıdan gelen kod) → saha_code_apply, değilse coupon_apply. */
export const trackCouponResult = (
  code: string,
  result: { valid: boolean; reason?: string; discount_amount?: number },
): void => {
  void (async () => {
    const linkCode = await activeSahaCode(AsyncStorage).catch(() => null);
    const base = {
      code,
      ok: result.valid,
      reason: result.valid ? undefined : result.reason,
      discount: result.valid ? result.discount_amount : undefined,
    };
    if (isSahaCode(code, linkCode)) {
      track('saha_code_apply', { ...base, from_link: !!linkCode && code.trim().toUpperCase() === linkCode });
    } else {
      track('coupon_apply', base);
    }
  })();
};

// ── Açılış: kaynak yakalama, app_open, arka plan/ağ tetikleyicileri ─────────
const touchProps = (t: Touch) => ({
  source: t.source,
  medium: t.medium,
  campaign: t.campaign,
  content: t.content,
  term: t.term,
  code: t.code,
  link: t.link,
});

let started = false;

/** App.tsx'te bir kez çağrılır; dönen fonksiyon dinleyicileri kaldırır. */
export const startMetrics = (): (() => void) => {
  if (started) return () => {};
  started = true;
  void loadConsent();
  void queue.load().then(() => queue.flushNow());

  void (async () => {
    let initialUrl: string | null = null;
    try {
      initialUrl = await Linking.getInitialURL();
    } catch {
      initialUrl = null;
    }
    const res = await captureTouch(AsyncStorage, initialUrl, { initial: true });
    track('app_open', { cold: true, first: res.firstOpen });
    if (res.firstOpen && res.firstTouch) track('first_touch', touchProps(res.firstTouch));
  })();

  const linkSub = Linking.addEventListener('url', ({ url }) => {
    void captureTouch(AsyncStorage, url, { initial: false });
  });

  let lastState: AppStateStatus = AppState.currentState;
  const appSub = AppState.addEventListener('change', (next) => {
    if (next === 'background') void queue.flushNow();
    if (lastState === 'background' && next === 'active') track('app_open', { cold: false });
    lastState = next;
  });

  let wasOffline = false;
  const netUnsub = NetInfo.addEventListener((s) => {
    const online = s.isConnected !== false && s.isInternetReachable !== false;
    if (online && wasOffline) void queue.flushNow();
    wasOffline = !online;
  });

  return () => {
    linkSub.remove();
    appSub.remove();
    netUnsub();
    started = false;
  };
};
