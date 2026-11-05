// eatkcal v2 (G13-S2 md.1–2) — Ana sayfa / Mağaza saf yardımcıları.
// Native/Supabase import YOK → birim testinden import edilir. Hesap/karar
// fonksiyonları MEVCUT saf lib'lerden (macroRules, deliveryRules, utils/price)
// beslenir; burada yalnız "ekranda ne gösterilir" kararı var.
import { macroProgress, type MacroProfile, type MacroSettings } from '../../../../lib/macroRules';
import { formatEstimatedDelivery, type DeliveryZoneRow } from '../../../../lib/deliveryRules';
import { getEffectivePrice, hasDiscount } from '../../../../utils/price';

/** activeOrder.ts ORDER_STEPS ile aynı sıra (confirmed → delivered). */
export const LIVE_ORDER_STATUSES = ['confirmed', 'preparing', 'on_way', 'delivered'] as const;
export type LiveOrderStatus = (typeof LIVE_ORDER_STATUSES)[number];

/** Canlı sipariş kartında aşama indeksi (0..3); bilinmeyen durum → -1 (kart gösterilmez). */
export function liveStepIndex(status: string | null | undefined): number {
  return LIVE_ORDER_STATUSES.indexOf(String(status ?? '') as LiveOrderStatus);
}

/**
 * Mağazalar: katalog ürünlerinin `brand` anahtarlarından, katalog sırasına
 * göre (ilk görüldüğü yer) tekil liste. Ayrı bir "marka listesi" fonksiyonu
 * yok; her anahtar için `fetchBrand(key)` (src/lib/brands.ts) çağrılır, aktif
 * olmayan marka null döner ve gizlenir.
 */
export function distinctBrandKeys(products: readonly { brand?: string | null }[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of products) {
    const k = String(p.brand ?? '').trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/** HomeScreen.tsx (displayProducts) ile aynı arama kuralı: ad içinde, küçük harf. */
export function filterProductsByQuery<T extends { name: string }>(products: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...products];
  return products.filter((p) => p.name.toLowerCase().includes(q));
}

/** Mağaza kategori çipleri: yalnız mağazanın ürünlerinde geçen kategoriler, katalog sırasıyla. */
export function storeCategories(
  allCategories: readonly { name: string }[],
  products: readonly { category?: string | null }[],
): string[] {
  const present = new Set(products.map((p) => String(p.category ?? '').trim()).filter(Boolean));
  return allCategories.map((c) => c.name).filter((n) => present.has(n));
}

export function filterByCategory<T extends { category?: string | null }>(
  products: readonly T[],
  category: string | null,
): T[] {
  if (!category) return [...products];
  return products.filter((p) => String(p.category ?? '').trim() === category);
}

/** Banner `navigate_to` → v2 hedefi. Bilinmeyen hedef 'legacy' (mevcut resolveNavigation). */
export type BannerTarget =
  | { kind: 'product'; productId: string }
  | { kind: 'store'; brandKey: string }
  | { kind: 'category'; categoryName: string }
  | { kind: 'legacy'; dest: string }
  | { kind: 'none' };

export function bannerTargetToEk(dest: string | null | undefined): BannerTarget {
  const target = String(dest ?? '').trim();
  if (!target) return { kind: 'none' };
  const after = (prefix: string) => target.substring(prefix.length).trim();
  if (target.startsWith('ProductDetail:')) {
    const id = after('ProductDetail:');
    return id ? { kind: 'product', productId: id } : { kind: 'none' };
  }
  if (target.startsWith('BrandLanding:')) {
    const k = after('BrandLanding:');
    return k ? { kind: 'store', brandKey: k } : { kind: 'none' };
  }
  if (target.startsWith('CategoryProducts:')) {
    const n = after('CategoryProducts:');
    return n ? { kind: 'category', categoryName: n } : { kind: 'none' };
  }
  return { kind: 'legacy', dest: target };
}

/** Macro şeridi: macroProgress (macroRules.ts) → nokta sayısı + kalan. */
export function macroStrip(profile: MacroProfile | null, settings: MacroSettings) {
  const p = macroProgress(profile, settings);
  return {
    toNext: p.macrosToNextMeal,
    total: p.mealCost,
    filled: p.mealCost - p.macrosToNextMeal,
  };
}

/**
 * Teslimat şeridi için bölge satırı — yalnız GÖSTERİM (tahmini süre). Sipariş
 * kuralı DEĞİL: ücret/minimum/izin kararları Sipariş özeti'nde mevcut
 * akışla verilir. Eşleme CheckoutScreen'deki ile aynı: ilçe satırları içinde
 * mahalle (tr-TR küçük harf) eşleşmesi, mahalle yoksa ilk satır.
 */
export function pickZoneRowForAddress(
  rows: readonly DeliveryZoneRow[],
  address: { district?: string | null; neighbourhood?: string | null } | null,
): DeliveryZoneRow | null {
  if (!address?.district || rows.length === 0) return null;
  const norm = (v: unknown) => String(v ?? '').trim().toLocaleLowerCase('tr-TR');
  const district = norm(address.district);
  const inDistrict = rows.filter((r) => norm(r.district) === district);
  if (inDistrict.length === 0) return null;
  const hood = norm(address.neighbourhood);
  if (!hood) return inDistrict[0];
  return inDistrict.find((r) => norm(r.neighborhood ?? r.neighbourhood ?? r.mahalle) === hood) ?? null;
}

/** "Hemen · 30-55 dk" çipi: bölge hemen teslime izin veriyor + dükkan açık + süre verisi var. */
export function deliveryChip(
  zone: DeliveryZoneRow | null,
  shopOpenNow: boolean,
): { estimate: string; immediate: boolean } | null {
  const estimate = formatEstimatedDelivery(zone);
  if (!estimate) return null;
  const immediate = shopOpenNow && zone?.allow_immediate !== false;
  return { estimate, immediate };
}

/** Kart fiyatı: indirimliyse üstü çizili eski fiyat + güncel fiyat (utils/price). */
export function cardPrice(p: { price?: number; discount_type?: string | null; discount_value?: number | null }) {
  const now = getEffectivePrice(p);
  return { now, before: hasDiscount(p) ? Number(p.price) || 0 : null };
}

/** Kart kcal etiketi; veri yoksa null (rozet gizlenir). */
export function cardKcal(p: { calories?: number | null; cal?: number | null }): number | null {
  const v = Number(p.calories ?? p.cal);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}
