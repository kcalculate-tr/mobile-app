import React, { Suspense, lazy, useEffect } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../core/AuthContext';

import { haptic } from '../utils/haptics';
import { DURATION } from '../constants/motion';
import { CustomTabBar } from './CustomTabBar';
import { navigationRef } from './navigationRef';
import { useNavGate } from '../store/navGateStore';
import { useFeature } from '../core/flags';
import { RootStackParamList, TabParamList } from './types';

// EAGER (statik) — ana akış ve soğuk-açılış ekranları. Bunlar tembel YÜKLENMEZ:
//  · WelcomeGate: oturumsuz soğuk açılışın ilk ekranı (initialRouteName).
//  · Sekme hedefleri (Home/Cart/Tracker/Subscription/Profile): sekmeye basınca
//    Suspense fallback'i "boş kare" gibi parlamasın — sekme geçişinde slide yok.
//  · Checkout: görevde açıkça hariç tutuldu.
import WelcomeGateScreen from '../screens/WelcomeGateScreen';
import HomeScreen from '../screens/HomeScreen';
import CartScreen from '../modules/eatkcal/screens/CartScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import TrackerScreen from '../screens/TrackerScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CheckoutScreen from '../modules/eatkcal/screens/CheckoutScreen';

// LAZY (code-split) — stack'e PUSH edilen ikincil ekranlar. 'slide_from_right'
// (veya slide_from_bottom) animasyonu chunk yüklenirken ekranı örttüğü için
// fallback görünmez; görünüm değişmez. Fallback zemini stack'in içerik zemini
// (#f6f6f6) ile aynı — geçişte ekstra renk kıpırtısı olmaz.
const AddressesScreen = lazy(() => import('../screens/AddressesScreen'));
const CategoriesScreen = lazy(() => import('../screens/CategoriesScreen'));
const CategoryProductsScreen = lazy(() => import('../screens/CategoryProductsScreen'));
const BrandLandingScreen = lazy(() => import('../screens/BrandLandingScreen'));
const DevDiagnosticsScreen = lazy(() => import('../screens/DevDiagnosticsScreen'));
// Yalnız __DEV__ vitrini; aşağıda Stack.Screen kaydı __DEV__ ile koşullu.
const DesignShowcaseScreen = lazy(() => import('../screens/DesignShowcaseScreen'));
// Yalnız __DEV__: G5-S3 veri katmanı deneme ekranı (Keşfet/profil/Gün/AI tarama).
const FeedDataLabScreen = lazy(() => import('../screens/FeedDataLabScreen'));
// Keşfet ekranı (G6-S2) — `kesfet` bayrağı açıkken veya __DEV__'de kayıtlı.
const KesfetScreen = lazy(() => import('../modules/kesfet/ui/KesfetScreen'));
const OffersScreen = lazy(() => import('../screens/OffersScreen'));
const OrderSuccessScreen = lazy(() => import('../modules/eatkcal/screens/OrderSuccessScreen'));
const ProductDetailScreen = lazy(() => import('../screens/ProductDetailScreen'));
const UnifiedLoginScreen = lazy(() => import('../screens/auth/UnifiedLoginScreen'));
const NutritionProfileScreen = lazy(() => import('../screens/tracker/NutritionProfileScreen'));
const MeasurementHistoryScreen = lazy(() => import('../screens/tracker/MeasurementHistoryScreen'));
const PaymentScreen = lazy(() => import('../modules/eatkcal/screens/PaymentScreen'));
const PersonalInfoScreen = lazy(() => import('../screens/PersonalInfoScreen'));
const FeedbackScreen = lazy(() => import('../screens/FeedbackScreen'));
const ContractsScreen = lazy(() => import('../screens/profile/ContractsScreen'));
const CouponsScreen = lazy(() => import('../screens/profile/CouponsScreen'));
const OrderDetailScreen = lazy(() => import('../screens/profile/OrderDetailScreen'));
const OrdersScreen = lazy(() => import('../screens/profile/OrdersScreen'));
const SavedCardsScreen = lazy(() => import('../screens/profile/SavedCardsScreen'));
const AddCardScreen = lazy(() => import('../screens/profile/AddCardScreen'));
const SecurityScreen = lazy(() => import('../screens/profile/SecurityScreen'));
const NotificationPreferencesScreen = lazy(() => import('../screens/profile/NotificationPreferencesScreen'));
const SupportScreen = lazy(() => import('../screens/profile/SupportScreen'));
const MyReviewsScreen = lazy(() => import('../screens/profile/MyReviewsScreen'));

// Lazy ekranı, stack içerik zeminiyle aynı renkte bloklamayan bir Suspense
// sınırına sarar. Sarmalayıcı MODÜL seviyesinde bir kez üretilir (her render'da
// yeni component referansı = remount olmasın diye).
const SUSPENSE_FALLBACK = <View style={{ flex: 1, backgroundColor: '#f6f6f6' }} />;
function withSuspense<P extends object>(Comp: React.ComponentType<P>): React.ComponentType<P> {
  return function LazyScreen(props: P) {
    return (
      <Suspense fallback={SUSPENSE_FALLBACK}>
        <Comp {...props} />
      </Suspense>
    );
  };
}

const AddressesLazy = withSuspense(AddressesScreen);
const CategoriesLazy = withSuspense(CategoriesScreen);
const CategoryProductsLazy = withSuspense(CategoryProductsScreen);
const BrandLandingLazy = withSuspense(BrandLandingScreen);
const DevDiagnosticsLazy = withSuspense(DevDiagnosticsScreen);
const DesignShowcaseLazy = withSuspense(DesignShowcaseScreen);
const FeedDataLabLazy = withSuspense(FeedDataLabScreen);
const KesfetLazy = withSuspense(KesfetScreen);
const OffersLazy = withSuspense(OffersScreen);
const OrderSuccessLazy = withSuspense(OrderSuccessScreen);
const ProductDetailLazy = withSuspense(ProductDetailScreen);
const UnifiedLoginLazy = withSuspense(UnifiedLoginScreen);
const NutritionProfileLazy = withSuspense(NutritionProfileScreen);
const MeasurementHistoryLazy = withSuspense(MeasurementHistoryScreen);
const PaymentLazy = withSuspense(PaymentScreen);
const PersonalInfoLazy = withSuspense(PersonalInfoScreen);
const FeedbackLazy = withSuspense(FeedbackScreen);
const ContractsLazy = withSuspense(ContractsScreen);
const CouponsLazy = withSuspense(CouponsScreen);
const OrderDetailLazy = withSuspense(OrderDetailScreen);
const OrdersLazy = withSuspense(OrdersScreen);
const SavedCardsLazy = withSuspense(SavedCardsScreen);
const AddCardLazy = withSuspense(AddCardScreen);
const SecurityLazy = withSuspense(SecurityScreen);
const NotificationPreferencesLazy = withSuspense(NotificationPreferencesScreen);
const SupportLazy = withSuspense(SupportScreen);
const MyReviewsLazy = withSuspense(MyReviewsScreen);

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  const { session } = useAuth();
  return (
    <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        // Sahne zemini uygulamanin ACIK temasiyla ayni olmali; #0A0A0A
        // sekme gecislerinde bir kare siyah parlama birakiyordu.
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: '#f6f6f6' },
          // SEKME GEÇİŞİNE ANİMASYON EKLENMİYOR — bilinçli karar (24.09.2026).
          //
          // Denenenler ve neden geri alındığı:
          //  · 'fade'  — yön hissi yok, sekme çubuğundaki sıra görünürken yanlış.
          //  · 'shift' — ekranı yalnız ±50px kaydırıyor VE opaklığı 0'a
          //              indiriyor; ilerleme değeri 0'a oturmadığında ekran
          //              görünmez kalıyor ("sepet yüklenmiyor").
          //  · özel sceneStyleInterpolator — aynı animasyon değeri hem
          //              transform'u hem de activityState/shouldFreeze'i
          //              besliyor; ekran donduğunda transform kaymış hâlde
          //              takılı kalıyordu.
          //
          // Kaydırmalı geçişin referansı stack ('slide_from_right', aşağıda):
          // marka sayfaları onu kullanıyor ve sorunsuz çalışıyor. Sepet de
          // kaymalı açılsın isteniyorsa doğru çözüm onu stack ekranına almak,
          // bu navigatörü zorlamak değil.
        }}
      >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        listeners={{ tabPress: () => haptic.selection() }}
      />
      <Tab.Screen
        name="Tracker"
        component={TrackerScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            haptic.selection();
            if (!session) {
              e.preventDefault();
              navigation.getParent()?.navigate('Login' as never);
            }
          },
        })}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarButton: () => null,
          // Sepet ÖNCEDEN yüklenir. Tembel yüklemede (varsayılan) ekran ilk
          // açılışta animasyon BAŞLADIKTAN sonra mount oluyor; bu yarış geçiş
          // değerinin 0'a oturmamasına ve sepetin boş görünmesine yol
          // açıyordu. Sepet yalnız store'u okuyor, önceden yüklemenin
          // maliyeti yok.
          lazy: false,
        }}
      />
      <Tab.Screen
        name="Subscriptions"
        component={SubscriptionScreen}
        listeners={{ tabPress: () => haptic.selection() }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            haptic.selection();
            if (!session) {
              e.preventDefault();
              navigation.getParent()?.navigate('Login' as never);
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}

// FAZ G — kayıtsız gezinme: zorunlu onboarding zinciri (Welcome→ValueProp→
// AuthGateway) kalktı, uygulama her zaman doğrudan Tabs (Home) ile açılır.
// Oturum sadece Checkout'ta (kendi guard'ı) ve Tracker/Profile sekmelerine
// basınca (yukarıdaki tabPress guard) isteniyor — 'Login' route'u artık
// UnifiedLoginScreen (Apple/Google/E-posta OTP), tek ekran, geri dönüşlü.
//
// Tek istisna — WelcomeGate: oturum yoksa SOĞUK başlatmada (initialRouteName,
// bir kez hesaplanır) tek ekranlı, bloklamayan bir karşılama gösterilir
// (bkz. WelcomeGateScreen). "Aynı oturumda bir daha gösterilmesin" kuralı
// EKSTRA STATE OLMADAN sağlanıyor: bu Stack.Navigator, `authLoading` true
// olduğunda yukarıda erken return ile hiç mount edilmiyor ve authLoading
// bu component'in ömrü boyunca bir daha true'ya dönmüyor (AuthContext'te
// sadece başlangıçta false yapılıyor) — yani initialRouteName, process
// başına TAM OLARAK BİR KEZ hesaplanır. App arka plana alınıp geri gelmek
// aynı process'te kalır, Stack.Navigator'ı yeniden mount etmez.
export default function AppNavigator() {
  const { authLoading, session } = useAuth();
  const pendingRoute = useNavGate((s) => s.pendingRoute);
  // Keşfet (G6-S2): bayrak açık DEĞİLSE üretimde ekran HİÇ kaydolmaz; tab bar ve
  // akış bugünküyle bire bir aynı kalır. __DEV__'de daima kayıtlı (geliştirici
  // FeedDataLab'tan açar). Canlı "Keşfet sekmesi" yerleşimi TabBarR3 kabuğuyla
  // birlikte (G6-S3) gelir; bu oturum ekranı ve bayrak kapısını teslim eder.
  const kesfetEnabled = useFeature('kesfet');
  const initialRouteName = session ? 'Tabs' : 'WelcomeGate';

  useEffect(() => {
    if (authLoading) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [authLoading]);

  // Stack geçişi sonrası tek seferlik deep-link (FIX 8 manuel makro).
  useEffect(() => {
    if (authLoading || !pendingRoute || !navigationRef.isReady()) return;
    const target = pendingRoute;
    useNavGate.getState().setPendingRoute(null);
    requestAnimationFrame(() => {
      if (navigationRef.isReady()) navigationRef.navigate(target as never);
    });
  }, [authLoading, pendingRoute]);

  // Oturum çözülene kadar HİÇBİR ŞEY çizilmez ve native splash (kcal logosu)
  // açık kalır. Önceden burada koyu zeminli bir ActivityIndicator vardı:
  // logo kayboluyor, araya bir "yükleniyor" karesi giriyor, sonra uygulama
  // açılıyordu. Splash yalnızca oturum hazır olunca gizleniyor, böylece
  // açılışta tek bir görsel var: logo → uygulama.
  if (authLoading) return null;

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: 'slide_from_right',
        animationDuration: DURATION.base,
        // Bu stack'teki ekranlarin HEPSI acik temali (#f6f6f6). Varsayilan
        // #0A0A0A idi: ekran kendi zeminini boyayana kadar gecis boyunca
        // siyah bir kare goruluyordu ("Hedef Duzenle"ye basinca siyah ekran).
        // Koyu zeminli tek ekran WelcomeGate — o kendi options'inda tanimli.
        contentStyle: { backgroundColor: '#f6f6f6' },
      }}
    >
      {/* Tam ekran fotograf zeminli tek ekran — acik zemin burada parlama yapardi. */}
      <Stack.Screen
        name="WelcomeGate"
        component={WelcomeGateScreen}
        options={{ gestureEnabled: false, contentStyle: { backgroundColor: '#0A0A0A' } }}
      />
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Categories" component={CategoriesLazy} />
      <Stack.Screen name="CategoryProducts" component={CategoryProductsLazy} />
      <Stack.Screen name="BrandLanding" component={BrandLandingLazy} />
      <Stack.Screen name="ProductDetail" component={ProductDetailLazy} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ animation: 'slide_from_bottom', animationDuration: DURATION.base }} />
      <Stack.Screen name="Addresses" component={AddressesLazy} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessLazy} options={{ animation: 'slide_from_bottom', animationDuration: DURATION.base }} />
      <Stack.Screen name="Offers" component={OffersLazy} />
      <Stack.Screen name="DevDiagnostics" component={DevDiagnosticsLazy} />
      {__DEV__ && (
        <Stack.Screen name="DesignShowcase" component={DesignShowcaseLazy} options={{ headerShown: false }} />
      )}
      {__DEV__ && (
        <Stack.Screen name="FeedDataLab" component={FeedDataLabLazy} options={{ title: 'Keşfet ve profil (veri)' }} />
      )}
      {(kesfetEnabled || __DEV__) && (
        <Stack.Screen name="Kesfet" component={KesfetLazy} />
      )}
      <Stack.Screen name="Login" component={UnifiedLoginLazy} />
      <Stack.Screen name="NutritionProfile" component={NutritionProfileLazy} />
      <Stack.Screen name="MeasurementHistory" component={MeasurementHistoryLazy} options={{ headerShown: false }} />
      <Stack.Screen name="ProfileOrders" component={OrdersLazy} />
      <Stack.Screen name="OrderDetail" component={OrderDetailLazy} />
      <Stack.Screen name="ProfileSavedCards" component={SavedCardsLazy} />
      <Stack.Screen name="ProfileAddCard" component={AddCardLazy} />
      <Stack.Screen name="ProfileCoupons" component={CouponsLazy} />
      <Stack.Screen name="ProfileSupport" component={SupportLazy} />
      <Stack.Screen name="ProfileReviews" component={MyReviewsLazy} />
      <Stack.Screen name="ProfileSecurity" component={SecurityLazy} />
      <Stack.Screen name="ProfileNotificationPreferences" component={NotificationPreferencesLazy} />
      <Stack.Screen name="Feedback" component={FeedbackLazy} />
      <Stack.Screen name="PersonalInfo" component={PersonalInfoLazy} />
      <Stack.Screen name="ProfileContracts" component={ContractsLazy} />
      <Stack.Screen name="PaymentScreen" component={PaymentLazy} />
    </Stack.Navigator>
  );
}
