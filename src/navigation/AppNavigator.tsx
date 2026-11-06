import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useTheme as useDesignTheme } from '../core/design';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../core/AuthContext';
import { useFeature, useFlagsContext, type FlagKey } from '../core/flags';

import { haptic } from '../utils/haptics';
import { DURATION } from '../constants/motion';
import { CustomTabBar } from './CustomTabBar';
import {
  TabBarR3,
  TabBarCollapseProvider,
  resolveInitialShellTab,
} from '../modules/shell';
import { navigationRef } from './navigationRef';
import { useNavGate } from '../store/navGateStore';
import { RootStackParamList, TabParamList } from './types';
// G13-S2 — eatkcal yeni arayüzü (yalnız `yeni_siparis` açıkken kaydolur/görünür).
import { EkHomeTab, ekV2Routes, resolveHomeTab } from '../modules/eatkcal/v2/routes';

// EAGER (statik) — ana akış ve soğuk-açılış ekranları. Bunlar tembel YÜKLENMEZ:
//  · WelcomeGate: oturumsuz soğuk açılışın ilk ekranı (initialRouteName).
//  · Sekme hedefleri (Home/Cart/Tracker/Subscription/Profile): sekmeye basınca
//    Suspense fallback'i "boş kare" gibi parlamasın — sekme geçişinde slide yok.
//  · Checkout: görevde açıkça hariç tutuldu.
import WelcomeGateScreen from '../screens/WelcomeGateScreen';
// G12-S1 — yeni onboarding yığını (koyu zemin; beyaz flash olmasın diye eager
// import, WelcomeGate gibi). Yalnız `yeni_onboarding` açık + oturumsuz soğuk
// açılışta initialRouteName buna gelir.
import { OnboardingNavigator, TakibeBaslaNavigator, IntroOverlay } from '../modules/onboarding';
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
// Composer (G8-S2) — `kesfet_paylasim` açıkken veya __DEV__'de kayıtlı.
const ComposerScreen = lazy(() => import('../modules/kesfet/ui/ComposerScreen'));
// G15-S3 — Bildirimler tam sayfa (FinNotifications); `sosyal_bildirim` açıkken (ya da __DEV__) kayıtlı.
const KesfetNotificationsScreen = lazy(() => import('../modules/kesfet/ui/NotificationsScreen'));
// Yalnız __DEV__: G6-S3 Gün halkası/profil UI vitrini.
const GunProfilUiLabScreen = lazy(() => import('../screens/GunProfilUiLabScreen'));
const PublicProfileScreen = lazy(() => import('../modules/profil/ui/PublicProfileScreen'));
// G15-S1 Ek karar: `yeni_onboarding` açıkken Final görünümü (v2), kapalıyken eski
// ekran AYNEN (kapılar kendi içinde bayrağa bakar).
const KcalAiSignUpRouteScreen = lazy(() => import('../modules/onboarding/v2/SignupAIGate'));
const OffersScreen = lazy(() => import('../screens/OffersScreen'));
const OrderSuccessScreen = lazy(() => import('../modules/eatkcal/screens/OrderSuccessScreen'));
const ProductDetailScreen = lazy(() => import('../screens/ProductDetailScreen'));
const UnifiedLoginScreen = lazy(() => import('../modules/onboarding/v2/LoginGate'));
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
// Derin bağlantı hedefleri (G5-S4) — yalnız /p/ /u/ bağlantısıyla erişilir.
const SharedPostScreen = lazy(() => import('../screens/share/SharedPostScreen'));
const SharedProfileScreen = lazy(() => import('../screens/share/SharedProfileScreen'));
// AI tarama (G6-S4) — yalnız `ai_tarama` bayrağı açıkken TrackerScreen'den erişilir.
const ScanScreen = lazy(() => import('../modules/ai/scan/screens/ScanScreen'));
// eatkcal yeni ana ekran (G6-S4) — yalnız `restoran_yakinda` bayrağı açıkken
// Home sekmesinde bugünkü HomeScreen'in YERİNE gösterilir (bkz. HomeTabScreen).
const EatHomeScreen = lazy(() => import('../modules/eatkcal/screens/EatHomeScreen'));

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
const ComposerLazy = withSuspense(ComposerScreen);
const KesfetNotificationsLazy = withSuspense(KesfetNotificationsScreen);
const GunProfilUiLabLazy = withSuspense(GunProfilUiLabScreen);
const PublicProfileLazy = withSuspense(PublicProfileScreen);
const KcalAiSignUpLazy = withSuspense(KcalAiSignUpRouteScreen);
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
const SharedPostLazy = withSuspense(SharedPostScreen);
const SharedProfileLazy = withSuspense(SharedProfileScreen);
const ScanLazy = withSuspense(ScanScreen);
const EatHomeLazy = withSuspense(EatHomeScreen);

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// AI (Kcalculate AI) stack rotalarının geçiş token'ları — DURATION.base ile
// tutarlı (G11-S2 madde 5). eatkcal rotalarına DOKUNULMAZ (onlar kendi
// slide_from_bottom/slide_from_right ayarlarını korur).
const AI_PUSH = {
  animation: 'slide_from_right' as const,
  animationDuration: DURATION.base,
};
const AI_MODAL = {
  animation: 'slide_from_bottom' as const,
  animationDuration: DURATION.base,
};

// Home sekmesi — `restoran_yakinda` bayrağı açıkken T20Eat (EatHomeScreen),
// kapalıyken (varsayılan) bugünkü HomeScreen AYNEN. HomeScreen bu dosyada
// hiç değişmedi; "Sipariş ver" sonrası aynı bileşen `EatCatalog` rotasıyla
// yeniden kullanılır (bkz. aşağıdaki Stack.Screen).
// G13-S2: `yeni_siparis` açıkken eatkcal v2 ana sayfası (FinEkHome); kapalıyken
// karar `resolveHomeTab` ile bugünküyle AYNI (restoran_yakinda → EatHome, değilse HomeScreen).
function HomeTabScreen() {
  const restoranYakinda = useFeature('restoran_yakinda');
  const yeniSiparis = useColdStartFeature('yeni_siparis');
  const kind = resolveHomeTab({ yeniSiparis, restoranYakinda });
  if (kind === 'v2') return <EkHomeTab />;
  return kind === 'eatHome' ? <EatHomeLazy /> : <HomeScreen />;
}

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
        component={HomeTabScreen}
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

// ───────────────────────────────────────────────────────────────────────────
// YENİ KABUK (G11-S2) — `yeni_kabuk` bayrağı açıkken.
//
// Bayrak AÇILIŞTA BİR KEZ okunur ve sabitlenir: sunucudan çalışma anında gelen
// değişiklik navigasyonu BOZMAZ, bir sonraki soğuk açılışta uygulanır. Bayrak
// henüz çözülmediyse (ready=false) eski kabuk gösterilir (güvenli varsayılan);
// ilk çözümde değer dondurulur ve bir daha değişmez.
function useColdStartFeature(key: FlagKey): boolean {
  const live = useFeature(key);
  const ctx = useFlagsContext();
  const ready = ctx ? ctx.ready : true;
  const frozen = useRef<boolean | undefined>(undefined);
  if (frozen.current === undefined && ready) {
    frozen.current = live;
  }
  return frozen.current ?? false;
}

// R3 tab navigatörü — sekme ADLARI bugünküyle aynı (Tracker/Home/Profile), böylece
// mevcut navigate(...) çağrıları iki kabukta da çalışır. Keşfet sekmesi `kesfet`
// açıkken eklenir; Cart/Subscriptions düğmesiz (gizli) sekmeler. Oturum kapıları
// bugünkü TabNavigator'dakiyle aynı (Tracker/KesfetTab/Profile oturumsuzsa Login).
function TabNavigatorR3() {
  const { session } = useAuth();
  const designTheme = useDesignTheme();
  const kesfet = useColdStartFeature('kesfet');
  const initialRouteName = resolveInitialShellTab({
    session: !!session,
    // Sipariş geçmişi için YENİ sorgu yok; mevcut önbellek bunu vermiyor →
    // undefined (→ Home). S6 bir önbellek bağlarsa Tracker-ilk kuralı devreye girer.
    hasOrderHistory: undefined,
  });
  const authGate = (navigation: any) => ({
    tabPress: (e: { preventDefault: () => void }) => {
      haptic.selection();
      if (!session) {
        e.preventDefault();
        navigation.getParent()?.navigate('Login' as never);
      }
    },
  });
  return (
    <TabBarCollapseProvider>
      {/* G15-S2: yeni kabukta durum çubuğu temadan (App.tsx'teki global
          style="dark" koyu temada ikonları görünmez yapıyordu). Yalnız R3
          kabuğunda mount edilir → bayrak kapalıyken bugünküyle aynı. */}
      <StatusBar style={designTheme.isDark ? 'light' : 'dark'} />
      <Tab.Navigator
        initialRouteName={initialRouteName}
        tabBar={(props) => <TabBarR3 {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: designTheme.color.bg },
          // Sekme geçişine animasyon EKLENMEZ (24.09.2026 kararı, bkz. TabNavigator).
        }}
      >
        <Tab.Screen
          name="Tracker"
          component={TrackerScreen}
          listeners={({ navigation }) => authGate(navigation)}
        />
        {kesfet && (
          <Tab.Screen
            name="KesfetTab"
            component={KesfetLazy}
            initialParams={{ asTab: true }}
            listeners={({ navigation }) => authGate(navigation)}
          />
        )}
        <Tab.Screen
          name="Home"
          component={HomeTabScreen}
          listeners={{ tabPress: () => haptic.selection() }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          listeners={({ navigation }) => authGate(navigation)}
        />
        {/* Gizli (düğmesiz) sekmeler — bugünkü bileşenler, navigate ile erişilir. */}
        <Tab.Screen
          name="Cart"
          component={CartScreen}
          options={{ tabBarButton: () => null, lazy: false }}
        />
        <Tab.Screen
          name="Subscriptions"
          component={SubscriptionScreen}
          options={{ tabBarButton: () => null }}
        />
      </Tab.Navigator>
      {/* G12-S1 — mevcut müşteriye tanıtım: yeni kabuk ilk açılışında bir kez
          (oturumlu kullanıcı). Bugünkü kabukta (TabNavigator) YOK. */}
      <IntroOverlay />
    </TabBarCollapseProvider>
  );
}

// `Tabs` kök sekme ekranı — açılışta bir kez `yeni_kabuk`u okur ve kabuğu seçer.
function TabsRoot() {
  const yeniKabuk = useColdStartFeature('yeni_kabuk');
  return yeniKabuk ? <TabNavigatorR3 /> : <TabNavigator />;
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
  // G8: Composer yalnız `kesfet_paylasim` açıkken (ya da __DEV__) kayıtlı.
  const kesfetPaylasimEnabled = useFeature('kesfet_paylasim');
  const sosyalBildirimEnabled = useFeature('sosyal_bildirim');
  // G12-S1: `yeni_onboarding` açıkken oturumsuz soğuk açılış WelcomeGate yerine
  // yeni onboarding akışını gösterir (soğuk-başlangıçta bir kez okunur, böylece
  // process ömrü boyunca tek initialRoute). Kapalıyken WelcomeGate bugünküyle aynı.
  const yeniOnboarding = useColdStartFeature('yeni_onboarding');
  // G13-S2 — eatkcal v2 rotaları; kapalıyken `ekV2Routes(false)` → [] (hiç kayıt yok).
  const yeniSiparis = useColdStartFeature('yeni_siparis');
  const initialRouteName = session
    ? 'Tabs'
    : yeniOnboarding
      ? 'Onboarding'
      : 'WelcomeGate';

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
      {/* G12-S1 — yeni onboarding (koyu zemin, geri jesti kapalı). Bayrak
          kapalıyken initialRoute WelcomeGate olduğundan erişilmez. */}
      <Stack.Screen
        name="Onboarding"
        component={OnboardingNavigator}
        options={{ gestureEnabled: false, contentStyle: { backgroundColor: '#000000' } }}
      />
      {/* G12-S1 — Takibe başla (hedef/tempo/beden/hareket/sonuç/ilk adım).
          Onboarding'den (yeni kullanıcı) ve Profil › Hedefim'den (editGoal, S4
          bağlar) açılır. Mevcut beslenme profili servisini kullanır. */}
      <Stack.Screen name="TakibeBasla" component={TakibeBaslaNavigator} />
      <Stack.Screen name="Tabs" component={TabsRoot} />
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
        <Stack.Screen name="Kesfet" component={KesfetLazy} options={AI_PUSH} />
      )}
      {(kesfetPaylasimEnabled || __DEV__) && (
        <Stack.Screen name="Composer" component={ComposerLazy} options={AI_MODAL} />
      )}
      {(sosyalBildirimEnabled || __DEV__) && (
        <Stack.Screen name="KesfetNotifications" component={KesfetNotificationsLazy} options={AI_PUSH} />
      )}
      {__DEV__ && (
        <Stack.Screen name="GunProfilUiLab" component={GunProfilUiLabLazy} options={{ title: 'Gün halkası / profil (UI)' }} />
      )}
      <Stack.Screen name="PublicProfile" component={PublicProfileLazy} options={AI_PUSH} />
      <Stack.Screen name="KcalAiSignUp" component={KcalAiSignUpLazy} options={AI_PUSH} />
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
      {/* Derin bağlantı hedefleri (G5-S4). Koyu zeminli iniş ekranları. */}
      <Stack.Screen name="SharedPost" component={SharedPostLazy} options={{ ...AI_PUSH, contentStyle: { backgroundColor: '#0A0A0A' } }} />
      <Stack.Screen name="SharedProfile" component={SharedProfileLazy} options={{ ...AI_PUSH, contentStyle: { backgroundColor: '#0A0A0A' } }} />
      {/* AI tarama (G6-S4) — tam ekran kamera görünümü. */}
      <Stack.Screen
        name="AiScan"
        component={ScanLazy}
        options={{ ...AI_MODAL, contentStyle: { backgroundColor: '#2C2C2E' } }}
      />
      {/* eatkcal şehir kapısı sonrası mevcut sipariş akışı (G6-S4) — bugünkü
          HomeScreen AYNEN, yalnız T20Eat'ten farklı bir rotayla açılıyor. */}
      <Stack.Screen name="EatCatalog" component={HomeScreen} />
      {/* G13-S2 — eatkcal yeni arayüzü (src/modules/eatkcal/v2/routes.tsx). Yalnız
          `yeni_siparis` açıkken; kapalıyken liste boş, bugünkü akış AYNEN. */}
      {ekV2Routes(yeniSiparis).map((r) => (
        <Stack.Screen key={r.name} name={r.name as never} component={r.component} options={r.options} />
      ))}
    </Stack.Navigator>
  );
}
