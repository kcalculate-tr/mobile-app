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
