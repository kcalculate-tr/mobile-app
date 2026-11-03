import { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Cart: undefined;
  Subscriptions: undefined;
  Tracker: undefined;
  Profile: undefined;
};

export type AuthRedirectTarget = 'Tabs' | 'Checkout' | 'Addresses';

export type RootStackParamList = {
  WelcomeGate: undefined;
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
  Login: { redirectTo?: AuthRedirectTarget } | undefined;
  ProfileOrders: undefined;
  OrderDetail: { orderId: number };
  ProfileSavedCards: undefined;
  ProfileAddCard: undefined;
  ProfileCoupons: undefined;
  ProfileSupport: undefined;
  ProfileReviews: undefined;
  ProfileSecurity: undefined;
  ProfileNotificationPreferences: undefined;
  ProfileContracts: { slug?: string } | undefined;
  PersonalInfo: undefined;
  Feedback: undefined;
  NutritionProfile: { firstTime?: boolean } | undefined;
  MeasurementHistory: undefined;
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
