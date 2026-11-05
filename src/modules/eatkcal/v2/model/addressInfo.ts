// eatkcal v2 (G13-S2 md.5) — FinEkInfo (teslimat bilgisi sheet'i) için saf
// özetler. İlçe listesi + ilçe başına minimum `ilceleriOzetle`
// (src/components/DeliveryZonesSheet.tsx:57-86) ile hesaplanır; burada yalnız
// panonun ek satırları: ortak süre, ücretsiz mi, tek minimum tutar mı.
// Veri yoksa null → satır gizlenir (uydurma yok).
import {
  formatEstimatedDelivery,
  resolveShippingFee,
  type DeliveryGlobals,
  type DeliveryZoneRow,
} from '../../../../lib/deliveryRules';

type ZoneLike = DeliveryZoneRow & {
  is_active?: boolean | null;
  allow_immediate?: boolean | null;
};

const isFast = (z: ZoneLike) => z.is_active === true && z.allow_immediate === true;

/** Hemen teslim bölgelerinin TEK ortak süresi ("30-55 dk"); farklıysa/yoksa null. */
export function commonImmediateEta(zones: readonly ZoneLike[]): string | null {
  const set = new Set<string>();
  for (const z of zones) {
    if (!isFast(z)) continue;
    const eta = formatEstimatedDelivery(z);
    if (!eta) return null; // bir bölgede veri yoksa ortak süre iddia edilmez
    set.add(eta);
  }
  return set.size === 1 ? Array.from(set)[0] : null;
}

/** Hemen teslimde (ara toplam 0 iken) TÜM hızlı bölgelerde ücret 0 mı? */
export function immediateDeliveryFree(zones: readonly ZoneLike[], globals: DeliveryGlobals | null): boolean {
  const fast = zones.filter(isFast);
  if (fast.length === 0) return false;
  return fast.every((z) => resolveShippingFee(z, globals, 'immediate', 0) === 0);
}

/**
 * Minimum tutar satırı — DeliveryZonesSheet.tsx:132-140 ile aynı karar:
 * tek değer → o değer; birden fazla → 'varies'; hiç → null.
 */
export function minOrderSummary(minPerDistrict: readonly number[]): number | 'varies' | null {
  const uniq = Array.from(new Set(minPerDistrict.filter((n) => Number.isFinite(n) && n > 0)));
  if (uniq.length === 1) return uniq[0];
  if (uniq.length > 1) return 'varies';
  return null;
}
