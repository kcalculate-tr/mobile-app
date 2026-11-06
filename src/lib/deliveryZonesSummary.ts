// G15-S6 — Saf teslimat bölgesi özeti (UI yok). eatkcal v2 InfoSheet (Final yolu)
// eski DeliveryZonesSheet/BottomSheet/COLORS zincirini import etmesin diye
// DeliveryZonesSheet.tsx'ten buraya taşındı; mantık satır satır aynı.
import { resolveMinOrder, type DeliveryGlobals, type DeliveryZoneRow } from './delivery';

export type ZoneRow = DeliveryZoneRow & {
  district: string;
  is_active: boolean | null;
  allow_immediate: boolean | null;
  allow_scheduled: boolean | null;
};

export type IlceSatiri = {
  district: string;
  hizli: boolean;
  minHizli: number;
};

/**
 * İlçeye indirger. Bir ilçenin herhangi bir aktif mahallesinde hızlı teslimat
 * varsa ilçe hızlı sayılır. Minimum tutarda ilçedeki EN DÜŞÜK değer alınır —
 * "şu tutardan başlıyor" anlamında; ödeme ekranı adrese özel kesin tutarı
 * zaten gösteriyor.
 */
export function ilceleriOzetle(
  zones: ZoneRow[],
  globals: DeliveryGlobals | null,
): IlceSatiri[] {
  const harita = new Map<string, IlceSatiri>();

  for (const z of zones) {
    if (z.is_active !== true) continue;
    const hizliVar = z.allow_immediate === true;
    const planliVar = z.allow_scheduled === true;
    if (!hizliVar && !planliVar) continue;

    const ilce = String(z.district || '').trim();
    if (!ilce) continue;

    const minHizli = hizliVar ? resolveMinOrder(z, globals, 'immediate') : Infinity;

    const mevcut = harita.get(ilce);
    if (!mevcut) {
      harita.set(ilce, { district: ilce, hizli: hizliVar, minHizli });
    } else {
      mevcut.hizli = mevcut.hizli || hizliVar;
      mevcut.minHizli = Math.min(mevcut.minHizli, minHizli);
    }
  }

  return Array.from(harita.values()).sort((a, b) =>
    a.district.localeCompare(b.district, 'tr'),
  );
}
