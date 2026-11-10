// G22-S1 md.3/md.4 — kcalAI planları: SAF mantık (native bağımlılık yok, Node testi).
//
// Ürünler (İlter 10 Kas): App Store kcalai_fresh_monthly · kcalai_fresh_yearly · kcalai_balance_monthly ·
// kcalai_balance_yearly; Google Play abonelik kcalai_fresh / kcalai_balance + temel plan monthly /
// yearly (RevenueCat kimliği `kcalai_fresh:monthly`) — eşleme önekle (tierFromProductId). RevenueCat yetkileri `fresh`, `balance`; teklif `default`.
// Yıllıklarda 7 gün deneme mağazada tanımlı — istemci RevenueCat'in introPrice'ından okur.
// Fiyatlar YALNIZ RevenueCat'ten gelen yerel fiyat; yedek/sabit metin YOK (fiyat yoksa hata ekranı).
import { formatMoney } from '../money';

export type Tier = 'free' | 'fresh' | 'balance';
export type PlanKey = 'fresh_monthly' | 'fresh_yearly' | 'balance_monthly' | 'balance_yearly';

export const OFFERING_ID = 'default';
export const ENTITLEMENT_IDS = { fresh: 'fresh', balance: 'balance' } as const;
/** Kart sırası (FinSubPaywall): Fresh Aylık · Fresh Yıllık · Balance Aylık · Balance Yıllık. */
export const PLAN_ORDER: readonly PlanKey[] = ['fresh_monthly', 'fresh_yearly', 'balance_monthly', 'balance_yearly'];
export const PRODUCT_IDS: Record<PlanKey, string> = {
  fresh_monthly: 'kcalai_fresh_monthly',
  fresh_yearly: 'kcalai_fresh_yearly',
  balance_monthly: 'kcalai_balance_monthly',
  balance_yearly: 'kcalai_balance_yearly',
};
/** "En çok seçilen" = Balance Yıllık (tasarım). */
export const POPULAR_PLAN: PlanKey = 'balance_yearly';

export const TIER_RANK: Record<Tier, number> = { free: 0, fresh: 1, balance: 2 };

export function planTier(p: PlanKey): Exclude<Tier, 'free'> {
  return p.startsWith('balance') ? 'balance' : 'fresh';
}
export function planYearly(p: PlanKey): boolean {
  return p.endsWith('yearly');
}

/**
 * Mağaza ürün kimliği → kademe (G23-S1: ÖNEK eşlemesi). App Store `kcalai_fresh_monthly`,
 * Google Play abonelik + temel plan `kcalai_fresh:monthly` (RevenueCat biçimi) → ikisi de
 * `kcalai_fresh*` → fresh, `kcalai_balance*` → balance. revenuecat-webhook/mapping.ts ile AYNI kural.
 */
export function tierFromProductId(id: string | null | undefined): Exclude<Tier, 'free'> | null {
  const s = (id ?? '').trim().toLowerCase();
  if (s.startsWith('kcalai_balance')) return 'balance';
  if (s.startsWith('kcalai_fresh')) return 'fresh';
  return null;
}

/** Ürün kimliğinden dönem: "yearly"/"annual" geçerse yıllık, "monthly" geçerse aylık. */
export function periodFromProductId(id: string | null | undefined): 'monthly' | 'yearly' | null {
  const s = (id ?? '').trim().toLowerCase();
  if (/yearly|annual|p1y/.test(s)) return 'yearly';
  if (/monthly|p1m/.test(s)) return 'monthly';
  return null;
}

/** Mağaza ürün kimliği → plan (iOS `kcalai_fresh_monthly`, Play `kcalai_fresh:monthly`). */
export function planFromProductId(id: string | null | undefined): PlanKey | null {
  const tier = tierFromProductId(id);
  const period = periodFromProductId(id);
  if (!tier || !period) return null;
  return `${tier}_${period}` as PlanKey;
}

/** Etkin yetki kimlikleri → kademe (balance > fresh). */
export function tierFromEntitlements(active: readonly string[] | null | undefined): Tier {
  const s = new Set((active ?? []).map((x) => x.toLowerCase()));
  if (s.has(ENTITLEMENT_IDS.balance)) return 'balance';
  if (s.has(ENTITLEMENT_IDS.fresh)) return 'fresh';
  return 'free';
}

/**
 * Yetki önce RevenueCat'ten (anında), sunucu `my_entitlement` ile doğrulanır.
 *  • İkisi uyuşursa → o kademe, `verified`.
 *  • RevenueCat yüksek, sunucu düşük → satın alma yeni (webhook gecikmesi): RC kademesi
 *    gösterilir, `pending` (sunucu hakları yine sunucudaki kademeyle sayar).
 *  • Sunucu yüksek, RC düşük/bilinmiyor → sunucu (ör. başka cihazda satın alındı, RC önbelleği eski).
 */
export function resolveTier(rc: Tier | null, server: Tier | null): { tier: Tier; status: 'verified' | 'pending' | 'rc_only' | 'server_only' | 'unknown' } {
  if (rc == null && server == null) return { tier: 'free', status: 'unknown' };
  if (rc == null) return { tier: server as Tier, status: 'server_only' };
  if (server == null) return { tier: rc, status: 'rc_only' };
  if (rc === server) return { tier: rc, status: 'verified' };
  if (TIER_RANK[rc] > TIER_RANK[server]) return { tier: rc, status: 'pending' };
  return { tier: server, status: 'verified' };
}

// ── Fiyat ────────────────────────────────────────────────────────────────────
/** RevenueCat StoreProduct'ın kullandığımız alt kümesi. */
export interface StoreProductLike {
  identifier: string;
  price: number;
  priceString: string;
  currencyCode: string;
  pricePerWeek?: number | null;
  pricePerWeekString?: string | null;
  introPrice?: { price: number; periodNumberOfUnits?: number; periodUnit?: string } | null;
}

/**
 * Yerel fiyat (G23-S1): sayısal fiyat + para birimi → ortak `formatMoney`. TRY → "1799 TL"
 * (₺ ve binlik ayraç YOK); diğer para birimleri cihazın yerel biçimi ("$59.99", "59,99 €").
 * RevenueCat `priceString` DOĞRUDAN GÖSTERİLMEZ (TRY'de ₺ içerir).
 */
export function formatStorePrice(value: number, currencyCode: string, locale?: string): string {
  return formatMoney(value, currencyCode, locale);
}

/** Haftalık eşdeğer (yıllık/52, aylık·12/52). RevenueCat pricePerWeek verirse o. */
export function weeklyPrice(p: StoreProductLike, yearly: boolean): number {
  if (typeof p.pricePerWeek === 'number' && p.pricePerWeek > 0) return p.pricePerWeek;
  return yearly ? p.price / 52 : (p.price * 12) / 52;
}

/** Yıllığın aylığa göre indirimi (%, tam sayı). Aylık fiyat yoksa null. */
export function yearlyDiscountPct(monthly: number | null | undefined, yearly: number | null | undefined): number | null {
  if (!monthly || !yearly || monthly <= 0 || yearly <= 0) return null;
  const pct = Math.round((1 - yearly / (monthly * 12)) * 100);
  return pct > 0 ? pct : null;
}

/** Ücretsiz deneme günü (introPrice fiyatı 0 ise). */
export function trialDays(p: StoreProductLike): number | null {
  const ip = p.introPrice;
  if (!ip || ip.price > 0) return null;
  const n = ip.periodNumberOfUnits ?? 0;
  const u = (ip.periodUnit ?? '').toUpperCase();
  if (!n) return null;
  if (u === 'DAY') return n;
  if (u === 'WEEK') return n * 7;
  if (u === 'MONTH') return n * 30;
  return null;
}

export interface PlanCard {
  key: PlanKey;
  tier: Exclude<Tier, 'free'>;
  yearly: boolean;
  productId: string;
  price: number;
  currency: string;
  priceText: string;
  weeklyText: string;
  /** Yıllık kartta aylığa göre indirim (%). */
  discountPct: number | null;
  trialDays: number | null;
  popular: boolean;
}

/**
 * Teklifteki paketlerden 4 kart. Herhangi bir ürün eksikse null → FinSubError (yedek fiyat YOK).
 */
export function buildPlanCards(products: readonly StoreProductLike[], locale?: string): PlanCard[] | null {
  const byPlan = new Map<PlanKey, StoreProductLike>();
  for (const p of products) {
    const k = planFromProductId(p.identifier);
    if (k && !byPlan.has(k)) byPlan.set(k, p);
  }
  if (PLAN_ORDER.some((k) => !byPlan.has(k))) return null;
  return PLAN_ORDER.map((key) => {
    const p = byPlan.get(key) as StoreProductLike;
    const yearly = planYearly(key);
    const monthlyTwin = byPlan.get(key.replace('yearly', 'monthly') as PlanKey);
    return {
      key,
      tier: planTier(key),
      yearly,
      productId: p.identifier,
      price: p.price,
      currency: p.currencyCode,
      priceText: formatStorePrice(p.price, p.currencyCode, locale),
      weeklyText: formatStorePrice(Math.round(weeklyPrice(p, yearly) * 100) / 100, p.currencyCode, locale),
      discountPct: yearly ? yearlyDiscountPct(monthlyTwin?.price, p.price) : null,
      trialDays: yearly ? trialDays(p) : null,
      popular: key === POPULAR_PLAN,
    };
  });
}

// ── Kart dizisi hareketi (FinMoSub) ──────────────────────────────────────────
/** Kart adımı (kart genişliği + boşluk), pt. FinMoSub: d = |kart − merkez| / 261. */
export const CARD_STEP = 261;

/** d ∈ [0,1]: kartın merkeze uzaklığı (adım cinsinden, 1'de doyar). */
export function cardDistance(index: number, scrollX: number, step: number = CARD_STEP): number {
  return Math.min(1, Math.abs(index * step - scrollX) / step);
}

/** Ölçek 1 − 0.14·d, opaklık 1 − 0.45·d, çerçeve 1 − d. Azaltılmış harekette ölçek 1. */
export function cardVisual(index: number, scrollX: number, reduced = false, step: number = CARD_STEP) {
  const d = cardDistance(index, scrollX, step);
  return { d, scale: reduced ? 1 : 1 - 0.14 * d, opacity: 1 - 0.45 * d, frame: 1 - d };
}

/** Kaydırma konumundan seçili kart (snap ortası). */
export function selectedCard(scrollX: number, count: number = PLAN_ORDER.length, step: number = CARD_STEP): number {
  return Math.max(0, Math.min(count - 1, Math.round(scrollX / step)));
}

/** Açılış kartı: varsayılan Balance Yıllık; hak sheet'inden gelinirse ilgili plan. */
export function initialCard(plan?: Exclude<Tier, 'free'>, yearly = true): number {
  return (plan === 'fresh' ? 0 : 2) + (yearly ? 1 : 0);
}

/** Özellik şeridi: Fresh kartları (0,1) → Fresh şeridi; Balance (2,3) → Balance şeridi. */
export function stripFor(cardIndex: number): Exclude<Tier, 'free'> {
  return cardIndex >= 2 ? 'balance' : 'fresh';
}
