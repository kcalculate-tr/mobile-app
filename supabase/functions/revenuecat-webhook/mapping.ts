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

export function mapRevenueCatEvent(ev: RevenueCatEvent, current: EntitlementRow | null): MapResult {
  const type = String(ev.type ?? '').toUpperCase();
  if (!(HANDLED_EVENTS as readonly string[]).includes(type)) return { action: 'ignore', reason: `event:${type || 'none'}` };
  const userId = resolveUserId(ev);
  if (!userId) return { action: 'ignore', reason: 'anonymous_user' };

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
