// G57 (İlter 17 Kas) — eatkcal İzmir teklifi: "2 öğün fiyatına Fresh yıllık üyelik, ekstra 2 öğün bizden."
// eatkcal'a İzmir teslimat bölgesinden giren, aboneliği olmayan, giriş yapmış kullanıcıya paywall
// (Fresh yıllık seçili) DOĞRUDAN bir kez açılır. SAF karar fonksiyonu + depolama anahtarı.
export const IZMIR_OFFER_FROM = 'izmir_offer';
export const IZMIR_OFFER_SEEN_KEY = '@izmir_fresh_offer_seen_v1';
/** Teklif kartındaki öğün görseli: Basmati Üzeri Tavuk Fileto ve Brokoli (products.id 6). */
export const IZMIR_OFFER_MEAL_IMG =
  'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/products/1779280386547-qlt6j95y.jpg';

export function shouldShowIzmirOffer(p: {
  signedIn: boolean;
  /** Teslimat bölgesinde (eatkcal teslimat şeridi süre gösteriyor). */
  inZone: boolean;
  tier: 'free' | 'fresh' | 'balance';
  /** Abonelik durumu biliniyor mu (RevenueCat/sunucu yanıt verdi). */
  tierKnown: boolean;
  subscriptionsEnabled: boolean;
  seen: boolean;
}): boolean {
  return p.signedIn && p.inZone && p.subscriptionsEnabled && p.tierKnown && p.tier === 'free' && !p.seen;
}
