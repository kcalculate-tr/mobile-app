// eatkcal v2 (G13-S2 md.8) — rota tablosunun SAF kısmı (native yok → birim
// testinden import edilir). Bileşen eşlemesi `routes.tsx`'te.
//
// KURAL: `yeni_siparis` kapalıyken v2 HİÇBİR YERDE görünmez:
//  - `ekV2RouteNames(false)` → [] (stack'e tek bir v2 rotası kaydolmaz)
//  - `resolveHomeTab({ yeniSiparis: false, … })` hiçbir zaman 'v2' dönmez
//    (Home sekmesi bugünkü HomeScreen / EatHomeScreen ile AYNEN).
import type { EkRouteName } from './nav';

/** Stack'e kaydolan v2 ekranları — sıra önemsiz, adlar `nav.ts`'teki tiple aynı. */
export const EK_V2_ROUTE_NAMES: readonly EkRouteName[] = [
  'EkStore',
  'EkProduct',
  'EkCart',
  'EkCheckout',
  'EkAddresses',
  'EkAddressAdd',
  'EkOrders',
  'EkOrderDetail',
  'EkCityGate',
] as const;

/** Alttan açılan (modal hissi) v2 ekranları — mevcut Checkout/OrderSuccess gibi. */
export const EK_V2_FROM_BOTTOM: ReadonlySet<EkRouteName> = new Set<EkRouteName>(['EkCheckout', 'EkCityGate']);

export function ekV2RouteNames(enabled: boolean): readonly EkRouteName[] {
  return enabled ? EK_V2_ROUTE_NAMES : [];
}

export type HomeTabKind = 'v2' | 'eatHome' | 'legacy';

/**
 * Home sekmesinde hangi ekran? Bayraklar kapalıyken bugünkü kural AYNEN:
 * `restoran_yakinda` açık → EatHomeScreen, değilse HomeScreen.
 */
export function resolveHomeTab(flags: { yeniSiparis: boolean; restoranYakinda: boolean }): HomeTabKind {
  if (flags.yeniSiparis) return 'v2';
  return flags.restoranYakinda ? 'eatHome' : 'legacy';
}
