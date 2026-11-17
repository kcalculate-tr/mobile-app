// G58-S2 md.5 — teklif önizleme bağlantısı: `kcal://teklif/izmir` (ve l.eatkcal.com/teklif/izmir hazır
// olunca) → SubPaywall { plan:'fresh', yearly:true, offer:'izmir_fresh' }. Pazarlama/SMS ve önizleme için:
// İzmir bölge + abonelik koşulu ve "bir kez gösterildi" kaydı (IZMIR_OFFER_SEEN_KEY) ATLANIR (bağlantı
// doğrudan rotayı açar, kayda dokunmaz). Abone kullanıcı paywall'ın bugünkü hâlini görür.
export const OFFER_LINK = 'teklif/:offer';
export const OFFER_LINK_FROM = 'offer_link';

export type PaywallOffer = 'izmir_fresh';

/** Bağlantıdaki teklif adı → paywall teklifi (bilinmeyen → yok). */
export function offerFromSlug(slug: string | null | undefined): PaywallOffer | undefined {
  const s = String(slug ?? '').trim().toLowerCase();
  if (s === 'izmir' || s === 'izmir_fresh' || s === 'izmir-fresh') return 'izmir_fresh';
  return undefined;
}

export interface PaywallLinkParams {
  from?: string;
  plan?: 'fresh' | 'balance';
  yearly?: boolean;
  coach?: boolean;
  offer?: PaywallOffer;
}

/** Teklifli açılışta plan/dönem verilmemişse teklifin planı seçili gelir (İzmir: Fresh yıllık). */
export function normalizePaywallParams<T extends PaywallLinkParams>(p: T | undefined | null): T {
  const params = { ...(p ?? {}) } as T;
  if (params.offer === 'izmir_fresh') {
    if (params.plan == null) params.plan = 'fresh';
    if (params.yearly == null) params.yearly = true;
    if (params.from == null) params.from = OFFER_LINK_FROM;
  }
  return params;
}

/** Satın almadan önce teklif kaydı yazılsın mı (İzmir yalnız Fresh yıllık satın alımda). */
export function offerForPurchase(offer: PaywallOffer | undefined, planKey: string): PaywallOffer | null {
  return offer === 'izmir_fresh' && planKey === 'fresh_yearly' ? 'izmir_fresh' : null;
}
