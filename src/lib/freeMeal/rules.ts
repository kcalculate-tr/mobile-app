// G58-S2 md.4 — Ücretsiz öğün kuponu (free_item) SAF kuralları. Sunucunun validate_coupon_v2 hesabıyla
// BİREBİR (supabase/migrations/20260922173642_validate_coupon_v2_server_side_items.sql): indirim =
// uygun kalemler içindeki EN PAHALI bir adedin katalog fiyatı; içecek + yan ürün (+ koli) hariç;
// üst sınır varsa kırpılır (0 / boş = sınırsız); sepet tutarını aşamaz. İstemci yalnız GÖSTERİR —
// tahsilat her zaman sunucu hesabıyla (paynkolay-payment-init).

/** settings.free_meal_excluded_categories varsayılanı (içecek · yan ürün · çoklu paket). */
export const FREE_MEAL_DEFAULT_EXCLUDED: readonly string[] = ['Detoks & Shake', 'Soslar', 'Koliye Özel Fırsatlar'];
/** settings.free_meal_valid_days varsayılanı. */
export const FREE_MEAL_VALID_DAYS = 30;
/** İzmir teklifi: Fresh yıllık satın alımda kaç ücretsiz öğün. */
export const IZMIR_FREE_MEALS = 2;

export interface FreeMealItem {
  price: number | null | undefined;
  category: string | null | undefined;
  quantity?: number;
}

export function freeMealDiscount(
  items: readonly FreeMealItem[],
  opts: { cartTotal: number; maxTl?: number | null; excluded?: readonly string[] | null },
): number | null {
  const excluded = opts.excluded ?? FREE_MEAL_DEFAULT_EXCLUDED;
  let best: number | null = null;
  for (const it of items) {
    const price = Number(it.price ?? 0);
    if (!(price > 0)) continue;
    if ((it.quantity ?? 1) <= 0) continue;
    if (excluded.includes(String(it.category ?? ''))) continue;
    if (best == null || price > best) best = price;
  }
  if (best == null) return null; // sunucu: 'no_eligible_item'
  let d = best;
  const cap = Number(opts.maxTl ?? 0);
  if (cap > 0 && d > cap) d = cap;
  d = Math.round(d * 100) / 100;
  if (d > opts.cartTotal) d = opts.cartTotal;
  return d;
}

export interface FreeMealNotice {
  id: string;
  source: 'referral' | 'izmir_fresh';
  count: number;
}

/** my_free_meal_notices() yanıtı → bildirimler (bilinmeyen satırlar atlanır). */
export function parseFreeMealNotices(raw: unknown): FreeMealNotice[] {
  if (!Array.isArray(raw)) return [];
  const out: FreeMealNotice[] = [];
  for (const r of raw) {
    const o = r as Record<string, unknown>;
    const id = typeof o?.id === 'string' ? o.id : null;
    const source = o?.source === 'referral' || o?.source === 'izmir_fresh' ? o.source : null;
    const count = Math.max(1, Math.round(Number(o?.count ?? 1)) || 1);
    if (id && source) out.push({ id, source, count });
  }
  return out;
}

/** Tek bildirim metni: toplam öğün + kaynak (İzmir: "2 öğünün kupon kısmına tanımlandı"). */
export function freeMealNoticeKey(notices: readonly FreeMealNotice[]): { key: string; n: number } | null {
  if (notices.length === 0) return null;
  const n = notices.reduce((a, b) => a + b.count, 0);
  const onlyReferral = notices.every((x) => x.source === 'referral');
  return { key: onlyReferral ? 'free_meal.notice_referral' : 'free_meal.notice', n };
}
