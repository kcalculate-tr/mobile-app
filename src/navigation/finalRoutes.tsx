// G17-S1 md.13 — GERÇEK AKIŞ: bayraklar açıkken navigator'da kayıtlı ama hâlâ
// 1.0.7 bileşenine düşen rotalar Final karşılığına bağlanır. Rota ADLARI aynı
// kalır (banner/derin bağlantı/bildirim/eski çağıranlar çalışmaya devam eder).
// Bayrak KAPALIYKEN `finalScreenFor` verilen eski bileşeni AYNEN döner
// (v2ScreenFor deseni) → bayrak kapalı yol bayt bayt aynı.
//
// İki tür eşleme:
//  · Profil alt ekranı (Fin*/Settings*): `onBack = goBack` ile yığında çizilir.
//  · eatkcal v2 karşılığı olan rota: aynı parametreyle v2 rotasına `replace`.
import React, { Suspense, lazy, useEffect } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../core/design';
import { PAYMENT_PROVIDER } from '../config/payment';

type AnyNav = { goBack: () => void; replace: (name: string, params?: object) => void; canGoBack: () => boolean; navigate: (name: string, params?: object) => void };

const Blank = () => {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.color.bg }} />;
};

function profileSub(load: () => Promise<{ default: React.ComponentType<{ onBack: () => void }> }>) {
  const Comp = lazy(load);
  return function FinalProfileRoute() {
    const nav = useNavigation() as unknown as AnyNav;
    const back = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs', { screen: 'Profile' }));
    return (
      <Suspense fallback={<Blank />}>
        <Comp onBack={back} />
      </Suspense>
    );
  };
}

function redirect(to: string, mapParams: (p: Record<string, unknown>) => object | undefined) {
  return function FinalRedirectRoute() {
    const nav = useNavigation() as unknown as AnyNav;
    const params = (useRoute().params ?? {}) as Record<string, unknown>;
    useEffect(() => {
      nav.replace(to, mapParams(params));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <Blank />;
  };
}

/** Bayrak açıkken Final karşılığı. Anahtar = mevcut RootStack rota adı. */
export const FINAL_ROUTES = {
  // Profil (yeni_kabuk) — FinPrProfile alt ekranlarının aynısı
  ProfileCoupons: { flag: 'yeni_kabuk', final: 'modules/profil/ui/screens/FinPrCouponsScreen.tsx', component: profileSub(() => import('../modules/profil/ui/screens/FinPrCouponsScreen')) },
  Offers: { flag: 'yeni_kabuk', final: 'modules/profil/ui/screens/FinPrCouponsScreen.tsx', component: profileSub(() => import('../modules/profil/ui/screens/FinPrCouponsScreen')) },
  ProfileReviews: { flag: 'yeni_kabuk', final: 'modules/profil/ui/screens/FinPrReviewsScreen.tsx', component: profileSub(() => import('../modules/profil/ui/screens/FinPrReviewsScreen')) },
  ProfileSecurity: { flag: 'yeni_kabuk', final: 'modules/profil/ui/screens/SettingsSecurityScreen.tsx', component: profileSub(() => import('../modules/profil/ui/screens/SettingsSecurityScreen')) },
  ProfileNotificationPreferences: { flag: 'yeni_kabuk', final: 'modules/profil/ui/screens/SettingsNotifyScreen.tsx', component: profileSub(() => import('../modules/profil/ui/screens/SettingsNotifyScreen')) },
  Feedback: { flag: 'yeni_kabuk', final: 'modules/profil/ui/screens/SettingsFeedbackScreen.tsx', component: profileSub(() => import('../modules/profil/ui/screens/SettingsFeedbackScreen')) },
  PersonalInfo: { flag: 'yeni_kabuk', final: 'modules/profil/ui/screens/SettingsPersonalScreen.tsx', component: profileSub(() => import('../modules/profil/ui/screens/SettingsPersonalScreen')) },
  // Gizli 'Subscriptions' sekmesi (yeni kabukta) → Final Macro ve Abonelik
  Subscriptions: { flag: 'yeni_kabuk', final: 'modules/profil/ui/screens/FinPrMacroScreen.tsx', component: profileSub(() => import('../modules/profil/ui/screens/FinPrMacroScreen')) },
  MeasurementHistory: { flag: 'yeni_kabuk', final: 'modules/profil/ui/screens/FinPrMeasurementsScreen.tsx', component: profileSub(() => import('../modules/profil/ui/screens/FinPrMeasurementsScreen')) },
  // eatkcal (yeni_siparis) — v2 rotasına aynı parametreyle
  ProductDetail: { flag: 'yeni_siparis', final: 'modules/eatkcal/v2/screens/EkProductScreen.tsx', component: redirect('EkProduct', (p) => ({ productId: String(p.productId ?? '') })) },
  BrandLanding: { flag: 'yeni_siparis', final: 'modules/eatkcal/v2/screens/EkStoreScreen.tsx', component: redirect('EkStore', (p) => ({ brandKey: String(p.brandKey ?? '') })) },
  OrderDetail: { flag: 'yeni_siparis', final: 'modules/eatkcal/v2/screens/EkOrderDetailScreen.tsx', component: redirect('EkOrderDetail', (p) => ({ orderId: Number(p.orderId) })) },
  // Kategori listesi/ürünleri ve eski katalog → eatkcal sekmesi (FinEkHome kategori şeridi)
  Categories: { flag: 'yeni_siparis', final: 'modules/eatkcal/v2/screens/EkHomeScreen.tsx', component: redirect('Tabs', () => ({ screen: 'Home' })) },
  CategoryProducts: { flag: 'yeni_siparis', final: 'modules/eatkcal/v2/screens/EkHomeScreen.tsx', component: redirect('Tabs', () => ({ screen: 'Home' })) },
  EatCatalog: { flag: 'yeni_siparis', final: 'modules/eatkcal/v2/screens/EkHomeScreen.tsx', component: redirect('Tabs', () => ({ screen: 'Home' })) },
  // Takip hedefi (yeni_onboarding) — Final "Takibe başla" düzenleme
  NutritionProfile: { flag: 'yeni_onboarding', final: 'modules/onboarding/takibe/TakibeNavigator.tsx', component: redirect('TakibeBasla', () => ({ editGoal: true })) },
  // Paylaşılan profil bağlantısı (kesfet) — Final açık profil
  SharedProfile: { flag: 'kesfet', final: 'modules/profil/ui/PublicProfileScreen.tsx', component: redirect('PublicProfile', (p) => ({ handle: String(p.handle ?? '').replace(/^@/, '') })) },
} as const;

export type FinalRouteName = keyof typeof FINAL_ROUTES;
export type FinalFlag = (typeof FINAL_ROUTES)[FinalRouteName]['flag'];

/** Bayrak açıksa Final, kapalıysa verilen eski bileşen AYNEN. */
export function finalScreenFor<P extends object>(
  name: FinalRouteName,
  enabled: boolean,
  legacy: React.ComponentType<P>,
): React.ComponentType<P> {
  return enabled ? (FINAL_ROUTES[name].component as unknown as React.ComponentType<P>) : legacy;
}

/**
 * Eski Checkout → v2 özet (yeni_siparis + Paynkolay). EkCheckout Paynkolay dışı
 * sağlayıcıda kendisi 'Checkout'a döndüğünden döngü olmasın diye sağlayıcı
 * burada da denetlenir; ödeme dönüşü (pendingPaymentOrderId) eski ekranda kalır.
 */
// Navigator her render'da çağırır → bileşen kimliği SABİT kalsın (yeniden mount yok).
const checkoutCache = new WeakMap<object, React.ComponentType<never>>();

export function checkoutScreenFor<P extends object>(enabled: boolean, legacy: React.ComponentType<P>): React.ComponentType<P> {
  if (!enabled || PAYMENT_PROVIDER !== 'paynkolay') return legacy;
  const hit = checkoutCache.get(legacy);
  if (hit) return hit as unknown as React.ComponentType<P>;
  const made = makeCheckoutRoute(legacy);
  checkoutCache.set(legacy, made as unknown as React.ComponentType<never>);
  return made;
}

function makeCheckoutRoute<P extends object>(legacy: React.ComponentType<P>): React.ComponentType<P> {
  const Legacy = legacy as React.ComponentType<object>;
  return function FinalCheckoutRoute(props: P) {
    const nav = useNavigation() as unknown as AnyNav;
    const params = (useRoute().params ?? {}) as { selectedAddressId?: string; pendingPaymentOrderId?: string };
    const toV2 = !params.pendingPaymentOrderId;
    useEffect(() => {
      if (toV2) nav.replace('EkCheckout', params.selectedAddressId ? { selectedAddressId: params.selectedAddressId } : undefined);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return toV2 ? <Blank /> : <Legacy {...(props as object)} />;
  } as unknown as React.ComponentType<P>;
}
