// revenuecat-webhook — SAF eşleme (Deno/Node ortak; bağımlılık yok, testi src/lib/subscription/__tests__).
//
// RevenueCat olayı → user_entitlements güncellemesi. Kurallar (G22-S1 md.3):
//  • app_user_id = Supabase user id (istemci Purchases.logIn(userId)). Anonim
//    ($RCAnonymousID:…) kimlikler yok sayılır; app_user_id / original_app_user_id /
//    aliases içinden ilk UUID alınır.
//  • Kademe: yetki (entitlement_ids) 'balance' > 'fresh'; yoksa ürün kimliği önekinden
//    (kcalai_balance* / kcalai_fresh*; G23-S1: App Store `kcalai_fresh_monthly` ve Google Play
//    abonelik+temel plan `kcalai_fresh:monthly` ikisi de önekle eşlenir).
//  • INITIAL_PURCHASE / RENEWAL / UNCANCELLATION → kademe aktif, expires_at, trial.
//  • CANCELLATION → kademe KORUNUR (dönem sonuna kadar geçerli), will_renew=false.
//  • EXPIRATION → free.
//  • PRODUCT_CHANGE → yükseltme (fresh→balance) hemen; düşürme bir sonraki RENEWAL'da
//    (RevenueCat: "yeni ürün hemen geçerli olmayabilir") → yalnız will_renew/ürün notu.
//  • Sırasız olay: last_event_at'ten eski olay yok sayılır.
//  • G58-S2 md.4 — PERSONEL / MANUEL HAK KORUMASI: mevcut satır store='manual' (ör. product_id=
//    'internal_staff') ve süresi geçmemişse (expires_at boş = süresiz) HİÇBİR RevenueCat olayı onu
//    ezmez (ör. App Store denemesi bitince gelen EXPIRATION Balance'ı free yapıyordu).
//  • G58-S2 md.4 — İZMİR TEKLİFİ: Fresh YILLIK INITIAL_PURCHASE (App Store / Play) + teklif
//    'izmir_fresh' (subscriber attribute `offer` ya da sunucu teklif kaydı) → 2 ücretsiz öğün kuponu
//    (izmirOfferDecision). Kişi başı bir kez + aynı olay iki kez gelirse tekrar yok (DB unique).
//    İade/iptal (CANCELLATION, EXPIRATION) → kullanılmamış kuponlar void.
export type Tier = 'free' | 'fresh' | 'balance';

export const TIER_RANK: Record<Tier, number> = { free: 0, fresh: 1, balance: 2 };

export const HANDLED_EVENTS = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'CANCELLATION',
  'EXPIRATION',
  'PRODUCT_CHANGE',
] as const;

export interface RevenueCatEvent {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  new_product_id?: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  period_type?: string;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  store?: string;
  environment?: string;
  /** RevenueCat: iptal nedeni (CUSTOMER_SUPPORT = iade, UNSUBSCRIBE, BILLING_ERROR …). */
  cancel_reason?: string | null;
  /** RevenueCat subscriber attributes: { offer: { value: 'izmir_fresh', updated_at_ms } }. */
  subscriber_attributes?: Record<string, { value?: string | null; updated_at_ms?: number } | undefined> | null;
}

export interface EntitlementRow {
  tier: Tier;
  product_id: string | null;
  expires_at: string | null;
  trial: boolean;
  store: string | null;
  will_renew: boolean;
  last_event_id: string | null;
  last_event_at: string | null;
}

export type MapResult =
  | { action: 'upsert'; userId: string; row: EntitlementRow }
  | { action: 'ignore'; reason: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** İlk Supabase kullanıcı kimliği (UUID); anonim RevenueCat kimlikleri atlanır. */
export function resolveUserId(ev: RevenueCatEvent): string | null {
  const ids = [ev.app_user_id, ev.original_app_user_id, ...(Array.isArray(ev.aliases) ? ev.aliases : [])];
  for (const id of ids) {
    if (typeof id === 'string' && UUID_RE.test(id.trim())) return id.trim().toLowerCase();
  }
  return null;
}

/** Ürün kimliğinden kademe (kcalai_fresh_monthly → fresh). */
export function tierFromProduct(productId: string | null | undefined): Tier | null {
  if (!productId) return null;
  const p = productId.toLowerCase();
  // Play Store ürünleri "kcalai_fresh_monthly:monthly-base" biçiminde gelebilir.
  if (p.startsWith('kcalai_balance')) return 'balance';
  if (p.startsWith('kcalai_fresh')) return 'fresh';
  return null;
}

/** Yetki listesinden en yüksek kademe; yoksa ürün önekinden. */
export function tierFromEvent(ev: RevenueCatEvent, productId?: string | null): Tier | null {
  const ents = [
    ...(Array.isArray(ev.entitlement_ids) ? ev.entitlement_ids : []),
    ...(ev.entitlement_id ? [ev.entitlement_id] : []),
  ].map((e) => String(e).toLowerCase());
  if (ents.includes('balance')) return 'balance';
  if (ents.includes('fresh')) return 'fresh';
  return tierFromProduct(productId ?? ev.product_id);
}

function iso(ms: number | null | undefined): string | null {
  return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
}

/** Personel / manuel hak (store='manual'), süresi geçmemiş (boş = süresiz) → korunur. */
export function isProtectedManual(current: EntitlementRow | null, nowMs: number = Date.now()): boolean {
  if (!current) return false;
  if (String(current.store ?? '').toLowerCase() !== 'manual') return false;
  if (current.tier === 'free') return false;
  if (!current.expires_at) return true;
  const exp = Date.parse(current.expires_at);
  return Number.isFinite(exp) && exp > nowMs;
}

export function mapRevenueCatEvent(ev: RevenueCatEvent, current: EntitlementRow | null, nowMs: number = Date.now()): MapResult {
  const type = String(ev.type ?? '').toUpperCase();
  if (!(HANDLED_EVENTS as readonly string[]).includes(type)) return { action: 'ignore', reason: `event:${type || 'none'}` };
  const userId = resolveUserId(ev);
  if (!userId) return { action: 'ignore', reason: 'anonymous_user' };
  // G58-S2: personel/manuel hak süresi boyunca RevenueCat olaylarıyla EZİLMEZ.
  if (isProtectedManual(current, nowMs)) return { action: 'ignore', reason: 'manual_entitlement' };

  const eventAt = iso(ev.event_timestamp_ms);
  if (current?.last_event_at && eventAt && Date.parse(eventAt) < Date.parse(current.last_event_at)) {
    return { action: 'ignore', reason: 'stale_event' };
  }
  if (current?.last_event_id && ev.id && current.last_event_id === ev.id) {
    return { action: 'ignore', reason: 'duplicate_event' };
  }

  const base: EntitlementRow = current ?? {
    tier: 'free',
    product_id: null,
    expires_at: null,
    trial: false,
    store: null,
    will_renew: true,
    last_event_id: null,
    last_event_at: null,
  };
  const meta = { last_event_id: ev.id ?? null, last_event_at: eventAt ?? base.last_event_at };
  const store = ev.store ?? base.store;

  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION': {
      const tier = tierFromEvent(ev);
      if (!tier) return { action: 'ignore', reason: 'unknown_product' };
      return {
        action: 'upsert',
        userId,
        row: {
          ...base,
          ...meta,
          tier,
          product_id: ev.product_id ?? base.product_id,
          expires_at: iso(ev.expiration_at_ms) ?? base.expires_at,
          trial: String(ev.period_type ?? '').toUpperCase() === 'TRIAL',
          store,
          will_renew: true,
        },
      };
    }
    case 'CANCELLATION':
      // Dönem sonuna kadar geçerli; yalnız yenileme kapanır.
      return {
        action: 'upsert',
        userId,
        row: {
          ...base,
          ...meta,
          tier: base.tier === 'free' ? tierFromEvent(ev) ?? 'free' : base.tier,
          product_id: base.product_id ?? ev.product_id ?? null,
          expires_at: iso(ev.expiration_at_ms) ?? base.expires_at,
          store,
          will_renew: false,
        },
      };
    case 'EXPIRATION':
      return {
        action: 'upsert',
        userId,
        row: {
          ...base,
          ...meta,
          tier: 'free',
          expires_at: iso(ev.expiration_at_ms) ?? base.expires_at,
          trial: false,
          store,
          will_renew: false,
        },
      };
    case 'PRODUCT_CHANGE': {
      const next = tierFromProduct(ev.new_product_id);
      if (!next) return { action: 'ignore', reason: 'unknown_product' };
      if (TIER_RANK[next] > TIER_RANK[base.tier]) {
        // Yükseltme hemen geçerli (App Store / Play varsayılan oranlama).
        return {
          action: 'upsert',
          userId,
          row: {
            ...base,
            ...meta,
            tier: next,
            product_id: ev.new_product_id ?? base.product_id,
            expires_at: iso(ev.expiration_at_ms) ?? base.expires_at,
            store,
            will_renew: true,
          },
        };
      }
      // Düşürme/aynı kademe: mevcut dönem sürer; yeni ürün RENEWAL ile gelir.
      return { action: 'upsert', userId, row: { ...base, ...meta, store } };
    }
  }
  return { action: 'ignore', reason: 'unreachable' };
}

// ── G58-S2 md.4: İzmir teklifi (Fresh yıllık → 2 ücretsiz öğün) ─────────────────
export const IZMIR_OFFER = 'izmir_fresh';
export const IZMIR_FREE_MEALS = 2;
/** Yalnız gerçek mağaza satın alımı (manuel/personel/promo hakları hariç). */
export const IZMIR_STORES = ['APP_STORE', 'PLAY_STORE'] as const;

/** Fresh YILLIK ürün mü (iOS kcalai_fresh_yearly · Play kcalai_fresh:yearly / …annual / P1Y). */
export function isFreshYearly(productId: string | null | undefined): boolean {
  const p = String(productId ?? '').toLowerCase();
  return p.startsWith('kcalai_fresh') && /yearly|annual|p1y/.test(p);
}

/** RevenueCat subscriber attribute `offer` (istemci satın almadan önce yazar). */
export function offerAttribute(ev: RevenueCatEvent): string | null {
  const a = ev.subscriber_attributes?.offer?.value;
  return typeof a === 'string' && a.trim() ? a.trim() : null;
}

export type IzmirDecision =
  | { action: 'grant'; userId: string; count: number; ref: string }
  | { action: 'void'; userId: string; reason: string }
  | { action: 'none'; reason: string };

/**
 * Teklif kararı (SAF). `offerRecorded` = sunucudaki teklif kaydı (subscription_offer_intents) var mı —
 * attribute yoksa yedek. Kişi başı bir kez + olay tekrarına karşı idempotensi DB'de (grant_free_meals).
 */
export function izmirOfferDecision(ev: RevenueCatEvent, opts: { offerRecorded?: boolean } = {}): IzmirDecision {
  const type = String(ev.type ?? '').toUpperCase();
  const userId = resolveUserId(ev);
  if (!userId) return { action: 'none', reason: 'anonymous_user' };
  if (String(ev.environment ?? '').toUpperCase() === 'SANDBOX') return { action: 'none', reason: 'sandbox' };
  if (!isFreshYearly(ev.product_id)) return { action: 'none', reason: 'not_fresh_yearly' };
  if (type === 'CANCELLATION' || type === 'EXPIRATION') {
    return { action: 'void', userId, reason: type === 'CANCELLATION' ? `cancel:${String(ev.cancel_reason ?? '').toLowerCase() || 'unknown'}` : 'expiration' };
  }
  if (type !== 'INITIAL_PURCHASE') return { action: 'none', reason: `event:${type || 'none'}` };
  const store = String(ev.store ?? '').toUpperCase();
  if (!(IZMIR_STORES as readonly string[]).includes(store)) return { action: 'none', reason: 'store' };
  const viaOffer = offerAttribute(ev) === IZMIR_OFFER || opts.offerRecorded === true;
  if (!viaOffer) return { action: 'none', reason: 'no_offer' };
  if (!ev.id) return { action: 'none', reason: 'no_event_id' };
  return { action: 'grant', userId, count: IZMIR_FREE_MEALS, ref: ev.id };
}

/** Sabit süreli karşılaştırma (Authorization paylaşılan sırrı). "Bearer x" ve çıplak "x" kabul. */
export function authorized(header: string | null | undefined, secret: string): boolean {
  if (!secret || !header) return false;
  const raw = header.trim();
  const candidates = [raw, raw.replace(/^Bearer\s+/i, '')];
  let ok = false;
  for (const c of candidates) {
    if (c.length !== secret.length) continue;
    let diff = 0;
    for (let i = 0; i < c.length; i++) diff |= c.charCodeAt(i) ^ secret.charCodeAt(i);
    if (diff === 0) ok = true;
  }
  return ok;
}
