import { NavigatorScreenParams } from '@react-navigation/native';
import type { ProfileSubParams } from '../modules/profil/ui/screens/profileSub';

export type TabParamList = {
  Home: undefined;
  Cart: undefined;
  Subscriptions: undefined;
  // G18-S4 md.3: FinPush seri/hatırlatma dokunuşu → logla sheet'i açık (S2 tüketir).
  Tracker: { finOpenLog?: true | 'breakfast' | 'lunch' | 'dinner' | 'snack'; finOpenManual?: true | 'breakfast' | 'lunch' | 'dinner' | 'snack' } | undefined;
  Profile: undefined;
  // G11-S2 yeni kabuk: Keşfet sekmesi (yalnız `kesfet` + `yeni_kabuk` açıkken
  // R3 tab navigatörüne eklenir). `asTab` ekrana tab bağlamında olduğunu söyler
  // (alt boşluk hesabı; bkz. G11-CONTRACT). Stack `Kesfet` rotası ayrı kalır.
  KesfetTab: { asTab?: boolean } | undefined;
};

export type AuthRedirectTarget = 'Tabs' | 'Checkout' | 'Addresses';

export type RootStackParamList = {
  WelcomeGate: undefined;
  // G12-S1 — yeni onboarding akışı (yalnız `yeni_onboarding` açık + oturumsuz
  // soğuk açılış). Kapalıyken HİÇ kaydolmaz; WelcomeGate bugünküyle aynı.
  Onboarding: undefined;
  // G12-S1 — "Takibe başla" (hedef/tempo/beden/hareket/sonuç/ilk adım). Mevcut
  // beslenme profili servisini kullanır; `editGoal` Profil › Hedefim'den açılış.
  TakibeBasla: { editGoal?: boolean } | undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Categories: undefined;
  Offers: undefined;
  CategoryProducts: { categoryName: string };
  BrandLanding: { brandKey: string };
  ProductDetail: { productId: string };
  Checkout:
    | { selectedAddressId?: string; pendingPaymentOrderId?: string }
    | undefined;
  Addresses: { selectMode?: boolean } | undefined;
  // macro_points parametresi kaldırıldı: kazanılan Macro artık ekranın
  // kendisi tarafından siparişin tutarından hesaplanıyor (OrderSuccessScreen).
  OrderSuccess: { orderCode: string; orderId?: string; noticeMessage?: string };
  DevDiagnostics: undefined;
  // Yalnız __DEV__: yeni tasarım vitrini. Üretim derlemesinde ekran kaydı
  // AppNavigator'da __DEV__ ile koşullu, bu yüzden canlıda erişilemez.
  DesignShowcase: undefined;
  // Yalnız __DEV__: G5-S3 veri katmanı deneme ekranı (koşullu kayıt).
  FeedDataLab: undefined;
  // Keşfet (G6-S2) — kaydı AppNavigator'da `kesfet` bayrağı (veya __DEV__) ile
  // koşullu. Bayrak kapalı + üretimde HİÇ kaydolmaz; uygulama bugünküyle aynı.
  Kesfet: undefined;
  // G8 — Composer (herkes paylaşır); yalnız `kesfet_paylasim` açıkken erişilir.
  Composer: undefined;
  // G15-S3 — Bildirimler tam sayfa; yalnız `sosyal_bildirim` açıkken (ya da __DEV__) kayıtlı.
  KesfetNotifications: undefined;
  // G22-S2 md.4 — Keşfet arama (kişi · gönderi · tarif); `kesfet` bayrağıyla kayıtlı.
  KesfetSearch: undefined;
  // Yalnız __DEV__: G6-S3 Gün halkası/profil UI vitrini (koşullu kayıt).
  GunProfilUiLab: undefined;
  // `/u/:handle` — açık profil (bkz. modules/profil/ui/PublicProfileScreen).
  // G7-S1'de derin bağlantı eşlemesi `/u/:handle` → PublicProfile kuruldu.
  PublicProfile: { handle: string };
  // Kcal AI kaydı — `useFeature('kesfet')` arkasında (bkz. modules/profil/ui/signup).
  KcalAiSignUp: undefined;
  Login: { redirectTo?: AuthRedirectTarget } | undefined;
  ProfileOrders: undefined;
  OrderDetail: { orderId: number };
  ProfileSavedCards: undefined;
  ProfileAddCard: undefined;
  ProfileCoupons: undefined;
  // G21-S1 md.9 — FinPrProfile alt sayfaları (sağdan kayan yığın ekranı).
  ProfileSub: ProfileSubParams;
  ProfileSupport: undefined;
  ProfileReviews: undefined;
  ProfileSecurity: undefined;
  ProfileNotificationPreferences: undefined;
  ProfileContracts: { slug?: string } | undefined;
  PersonalInfo: undefined;
  Feedback: undefined;
  NutritionProfile: { firstTime?: boolean } | undefined;
  MeasurementHistory: undefined;
  // Derin bağlantı hedefleri (G5-S4) — l.eatkcal.com/p/:postId, /u/:handle.
  SharedPost: { postId: string; commentId?: string };
  SharedProfile: { handle: string };
  // AI tarama (G6-S4) — yalnız `ai_tarama` bayrağı açıkken erişilir.
  AiScan: undefined;
  AiScanOffline: undefined;
  // G22-S1 md.4 — kcalAI abonelikleri (`abonelik` bayrağı + RevenueCat anahtarı).
  SubPaywall: { from?: string; plan?: 'fresh' | 'balance'; yearly?: boolean; coach?: boolean } | undefined;
  SubProfile: undefined;
  // G24-S1 — kcalAI Koç (`koc` bayrağı). Parametreler: modules/coach/types CoachChatParams.
  CoachIntro: import('../modules/coach/types').CoachChatParams | undefined;
  CoachChat: import('../modules/coach/types').CoachChatParams | undefined;
  CoachHistory: undefined;
  // eatkcal ilk sipariş şehir kapısı sonrası mevcut sipariş akışı (G6-S4) —
  // bugünkü HomeScreen'i AYNEN yeniden kullanır, yeni bir katalog YAZILMADI.
  EatCatalog: undefined;
  PaymentScreen: {
    orderId: string;
    amount: number;
    orderCode?: string;
    noticeMessage?: string;
    // Sipariş Özeti'nde seçilen ödeme yöntemi (kart özelliği açık kullanıcı).
    payMode?: 'saved_card' | 'new_card';
    cardId?: string;
    saveCard?: boolean;
  };
};
