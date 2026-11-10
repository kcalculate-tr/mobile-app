// G22-S1 md.3 — RevenueCat (react-native-purchases) istemcisi + abonelik durumu.
//
// Yapılandırma: EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY (EAS env).
// Anahtar YOKSA ya da RNPurchases native modülü YOKSA (eski derleme / OTA) abonelik
// girişleri GİZLİ kalır — uyarı LOG'a, çökme yok. Girişte Purchases.logIn(userId),
// çıkışta logOut. Kademe önce RevenueCat'ten, sunucu `my_entitlement` ile doğrulanır
// (resolveTier). Sunucu hakları her zaman SUNUCUDAKİ kademeyle sayar.
import { NativeModules, Platform } from 'react-native';
import { create } from 'zustand';
import { getSupabaseClient } from '../../core/supabase';
import {
  OFFERING_ID,
  PRODUCT_IDS,
  resolveTier,
  type PlanKey,
  type StoreProductLike,
  type Tier,
} from './plans';
import { rcSnapshot, purchaseErrorResult, type CustomerInfoLike, type PurchaseResult, type RcSnapshot } from './rc';
import { LIMIT_SETTING_KEYS, limitsFromSettings, type QuotaSnapshot, type TierLimits } from './limits';

type PurchasesModule = typeof import('react-native-purchases');
type PurchasesDefault = PurchasesModule['default'];
type PackageLike = { identifier: string; product: StoreProductLike };

export interface ServerEntitlement {
  tier: Tier;
  product_id: string | null;
  expires_at: string | null;
  trial: boolean;
  store: string | null;
  will_renew: boolean;
  reset_at: string | null;
  ai: { limit: number | null; used: number; remaining: number | null; unlimited: boolean };
  barcode: { limit: number | null; used: number; remaining: number | null; unlimited: boolean };
}

export interface SubscriptionState {
  /** RevenueCat yapılandırıldı mı (anahtar + native modül). false → abonelik girişleri gizli. */
  available: boolean;
  rc: RcSnapshot | null;
  server: ServerEntitlement | null;
  limits: TierLimits | null;
  ai: QuotaSnapshot | null;
  barcode: QuotaSnapshot | null;
  setAvailable: (v: boolean) => void;
  setRc: (v: RcSnapshot | null) => void;
  setServer: (v: ServerEntitlement | null) => void;
  setLimits: (v: TierLimits | null) => void;
  recordQuota: (q: QuotaSnapshot) => void;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  available: false,
  rc: null,
  server: null,
  limits: null,
  ai: null,
  barcode: null,
  setAvailable: (available) => set({ available }),
  setRc: (rc) => set({ rc }),
  setServer: (server) => set({ server }),
  setLimits: (limits) => set({ limits }),
  recordQuota: (q) => set(q.kind === 'ai' ? { ai: q } : { barcode: q }),
  reset: () => set({ rc: null, server: null, ai: null, barcode: null }),
}));

/** Ekranda gösterilecek kademe + doğrulama durumu. */
export function useTier(): { tier: Tier; status: ReturnType<typeof resolveTier>['status'] } {
  const rc = useSubscriptionStore((s) => s.rc?.tier ?? null);
  const server = useSubscriptionStore((s) => s.server?.tier ?? null);
  return resolveTier(rc, server);
}

// ── Yapılandırma ─────────────────────────────────────────────────────────────
function readKey(): string | null {
  // expo/no-dynamic-env-var: anahtarlar SABİT yazılır (Metro derlemede değiştirir).
  const k = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  return typeof k === 'string' && k.trim() ? k.trim() : null;
}

let mod: PurchasesDefault | null = null;
let configured = false;
let warned = false;

function warnOnce(reason: string) {
  if (warned) return;
  warned = true;
  console.warn(`[kcalAI] abonelik kapalı (${reason}) — abonelik girişleri gizli`);
}

function loadPurchases(): PurchasesDefault | null {
  if (mod) return mod;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  // RNPurchases native modülü yoksa (eski derleme) require çalışır ama her çağrı fırlatır.
  if (!(NativeModules as Record<string, unknown>).RNPurchases) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = (require('react-native-purchases') as PurchasesModule).default;
    return mod;
  } catch {
    return null;
  }
}

/** Açılışta bir kez. Anahtar/modül yoksa available=false (çökme yok). */
export function initPurchases(): boolean {
  if (configured) return true;
  const key = readKey();
  if (!key) {
    warnOnce('EXPO_PUBLIC_REVENUECAT_*_KEY yok');
    useSubscriptionStore.getState().setAvailable(false);
    return false;
  }
  const P = loadPurchases();
  if (!P) {
    warnOnce('RNPurchases native modülü yok — yeni derleme gerekir');
    useSubscriptionStore.getState().setAvailable(false);
    return false;
  }
  try {
    P.configure({ apiKey: key });
    P.addCustomerInfoUpdateListener((info) => useSubscriptionStore.getState().setRc(rcSnapshot(info)));
    configured = true;
    useSubscriptionStore.getState().setAvailable(true);
    return true;
  } catch (e) {
    warnOnce(`configure: ${e instanceof Error ? e.message : 'hata'}`);
    useSubscriptionStore.getState().setAvailable(false);
    return false;
  }
}

export async function purchasesLogIn(userId: string): Promise<void> {
  if (!configured || !mod) return;
  try {
    const { customerInfo } = await mod.logIn(userId);
    useSubscriptionStore.getState().setRc(rcSnapshot(customerInfo as CustomerInfoLike));
  } catch {
    // ağ yoksa sonra yeniden denenir (refresh)
  }
}

export async function purchasesLogOut(): Promise<void> {
  useSubscriptionStore.getState().reset();
  if (!configured || !mod) return;
  try {
    await mod.logOut();
  } catch {
    // zaten anonim → yok say
  }
}

// ── Sunucu doğrulaması ───────────────────────────────────────────────────────
function asServer(data: unknown): ServerEntitlement | null {
  const o = (data ?? null) as Partial<ServerEntitlement> | null;
  if (!o || (o.tier !== 'free' && o.tier !== 'fresh' && o.tier !== 'balance')) return null;
  return o as ServerEntitlement;
}

/** my_entitlement + app_settings limitleri; RPC yoksa (migration öncesi) sessiz null. */
export async function refreshEntitlement(): Promise<void> {
  const st = useSubscriptionStore.getState();
  try {
    const sb = getSupabaseClient();
    const [ent, settings] = await Promise.all([
      sb.rpc('my_entitlement'),
      sb.from('app_settings').select('key, value').in('key', [...LIMIT_SETTING_KEYS]),
    ]);
    const server = ent.error ? null : asServer(ent.data);
    st.setServer(server);
    if (!settings.error) st.setLimits(limitsFromSettings(settings.data as { key: string; value: unknown }[]));
    if (server) {
      st.recordQuota({ kind: 'ai', tier: server.tier, remaining: server.ai.remaining, limit: server.ai.limit, unlimited: server.ai.unlimited, resetAt: server.reset_at });
      st.recordQuota({ kind: 'barcode', tier: server.tier, remaining: server.barcode.remaining, limit: server.barcode.limit, unlimited: server.barcode.unlimited, resetAt: server.reset_at });
    }
  } catch {
    // çevrimdışı — mevcut durum kalır
  }
  if (configured && mod) {
    try {
      st.setRc(rcSnapshot((await mod.getCustomerInfo()) as CustomerInfoLike));
    } catch {
      // yok say
    }
  }
}

// ── Satın alma ───────────────────────────────────────────────────────────────
let packagesCache: PackageLike[] | null = null;

/** Teklif `default` (yoksa current) paketleri. Yapılandırma yoksa ya da ürün yoksa null. */
export async function loadOfferingProducts(): Promise<StoreProductLike[] | null> {
  if (!configured || !mod) return null;
  try {
    const o = await mod.getOfferings();
    const off = o.all?.[OFFERING_ID] ?? o.current ?? null;
    const pk = (off?.availablePackages ?? []) as unknown as PackageLike[];
    packagesCache = pk;
    return pk.length ? pk.map((p) => p.product) : null;
  } catch {
    return null;
  }
}

export async function purchasePlan(plan: PlanKey): Promise<PurchaseResult> {
  if (!configured || !mod) return 'error';
  const want = PRODUCT_IDS[plan];
  const pkg = (packagesCache ?? []).find((p) => p.product.identifier.toLowerCase().split(':')[0] === want);
  if (!pkg) return 'error';
  try {
    const res = await mod.purchasePackage(pkg as never);
    useSubscriptionStore.getState().setRc(rcSnapshot(res.customerInfo as CustomerInfoLike));
    void refreshEntitlement();
    return 'success';
  } catch (e) {
    return purchaseErrorResult(e);
  }
}

export type RestoreResult = 'restored' | 'none' | 'error';

export async function restorePurchases(): Promise<RestoreResult> {
  if (!configured || !mod) return 'error';
  try {
    const info = await mod.restorePurchases();
    const snap = rcSnapshot(info as CustomerInfoLike);
    useSubscriptionStore.getState().setRc(snap);
    void refreshEntitlement();
    return snap.tier === 'free' ? 'none' : 'restored';
  } catch {
    return 'error';
  }
}

/** Aboneliği yönet → mağaza (iOS sistem sayfası; yoksa managementURL; yoksa mağaza aboneliği). */
export async function manageSubscription(): Promise<void> {
  const { Linking } = await import('react-native');
  const url = useSubscriptionStore.getState().rc?.managementURL;
  if (Platform.OS === 'ios' && configured && mod) {
    try {
      await mod.showManageSubscriptions();
      return;
    } catch {
      // aşağıya düş
    }
  }
  const fallback =
    url ??
    (Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions?package=com.kcalmobile.app');
  await Linking.openURL(fallback).catch(() => {});
}

export { rcSnapshot, purchaseErrorResult };
export type { RcSnapshot, PurchaseResult };
