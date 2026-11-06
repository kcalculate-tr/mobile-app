// eatkcal v2 (G13-S2 md.8) — ekran adları + bileşenler.
//
// AppNavigator bu listeyi YALNIZ `yeni_siparis` açıkken stack'e kaydeder
// (md.11; `ekV2Routes(false)` → []). Kapalıyken hiçbir v2 ekranı kayıtlı
// değildir, hiçbir yerden açılamaz; bugünkü HomeScreen/Cart/Checkout AYNEN.
//
// Ekranlar tembel yüklenir (AppNavigator'daki `withSuspense` deseniyle aynı):
// bayrak kapalı kullanıcıda modül hiç değerlendirilmez.
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { DURATION } from '../../../core/design';
import type { EkRouteName } from './nav';
import { EK_V2_FROM_BOTTOM, ekV2RouteNames } from './routeTable';

export { resolveHomeTab, ekV2RouteNames, EK_V2_ROUTE_NAMES } from './routeTable';
export type { EkV2ParamList, EkRouteName, EkNav, EkNavList } from './nav';

const FALLBACK = <View style={{ flex: 1 }} />;
function withSuspense<P extends object>(Comp: React.ComponentType<P>): React.ComponentType<P> {
  return function EkLazyScreen(props: P) {
    return (
      <Suspense fallback={FALLBACK}>
        <Comp {...props} />
      </Suspense>
    );
  };
}

const COMPONENTS: Record<EkRouteName, React.ComponentType<object>> = {
  EkStore: withSuspense(lazy(() => import('./screens/EkStoreScreen'))),
  EkProduct: withSuspense(lazy(() => import('./screens/EkProductScreen'))),
  EkCart: withSuspense(lazy(() => import('./screens/EkCartScreen'))),
  EkCheckout: withSuspense(lazy(() => import('./screens/EkCheckoutScreen'))),
  EkAddresses: withSuspense(lazy(() => import('./screens/EkAddressesScreen'))),
  EkAddressAdd: withSuspense(lazy(() => import('./screens/EkAddressAddScreen'))),
  EkOrders: withSuspense(lazy(() => import('./screens/EkOrdersScreen'))),
  EkOrderDetail: withSuspense(lazy(() => import('./screens/EkOrderDetailScreen'))),
  EkCityGate: withSuspense(lazy(() => import('./screens/EkCityGateScreen'))),
};

/** Home sekmesi (FinEkHome) — stack rotası değil, sekme içeriği. */
export const EkHomeTab = withSuspense(lazy(() => import('./screens/EkHomeScreen')));

export interface EkRoute {
  name: EkRouteName;
  component: React.ComponentType<object>;
  options?: NativeStackNavigationOptions;
}

const BOTTOM: NativeStackNavigationOptions = {
  animation: 'slide_from_bottom',
  animationDuration: DURATION.base,
};

/** AppNavigator'ın kaydedeceği rotalar. `enabled=false` → boş liste. */
export function ekV2Routes(enabled: boolean): EkRoute[] {
  return ekV2RouteNames(enabled).map((name) => ({
    name,
    component: COMPONENTS[name],
    options: EK_V2_FROM_BOTTOM.has(name) ? BOTTOM : undefined,
  }));
}

/**
 * G15-S5 (md.1 + md.5 eski tasarım envanteri) — sipariş akışında bugün 1.0.7
 * ekranına giden MEVCUT rota adları, `yeni_siparis` açıkken v2 görünümle
 * kaydolur (çağıranlar — Profil, sekme çubuğu, ödeme dönüşü — aynı adı
 * kullanmaya devam eder). Kapalıyken verilen bugünkü bileşen AYNEN.
 * Parametre şekilleri aynı (src/navigation/types.ts):
 *  - ProfileSavedCards (undefined) → EkSavedCards (FinPrCards)
 *  - ProfileOrders (undefined)     → EkOrders (FinEkOrders)
 *  - Addresses ({ selectMode? })   → EkAddresses (FinEkAddresses; aynı parametre)
 */
const LEGACY_SWAP = {
  ProfileSavedCards: withSuspense(lazy(() => import('./screens/EkSavedCardsScreen'))),
  ProfileOrders: withSuspense(lazy(() => import('./screens/EkOrdersScreen'))),
  Addresses: withSuspense(lazy(() => import('./screens/EkAddressesScreen'))),
  // { orderCode, orderId?, noticeMessage? } — ödeme/ücretsiz sipariş dönüşü (FinMoPay son karesi)
  OrderSuccess: withSuspense(lazy(() => import('./screens/EkOrderSuccessScreen'))),
  // PaynKolay 3D Secure sayfası — mantık PaymentScreen.tsx'ten satır satır kopya, yalnız görünüm v2
  PaymentScreen: withSuspense(lazy(() => import('./screens/EkPaymentScreen'))),
  // Kart doğrulama — mantık AddCardScreen.tsx'ten satır satır kopya, yalnız görünüm v2
  ProfileAddCard: withSuspense(lazy(() => import('./screens/EkAddCardScreen'))),
  // Sipariş detayı / ödeme sözleşmeleri → Profil'in Final görünümleri (FinPrSupport / FinPrAgreements)
  ProfileSupport: withSuspense(lazy(() => import('./screens/EkProfileLinks').then((m) => ({ default: m.EkSupportRoute })))),
  ProfileContracts: withSuspense(lazy(() => import('./screens/EkProfileLinks').then((m) => ({ default: m.EkContractsRoute })))),
} as const;
export type EkLegacySwapName = keyof typeof LEGACY_SWAP;

export function v2ScreenFor<P extends object>(
  name: EkLegacySwapName,
  enabled: boolean,
  legacy: React.ComponentType<P>,
): React.ComponentType<P> {
  return enabled ? (LEGACY_SWAP[name] as unknown as React.ComponentType<P>) : legacy;
}
