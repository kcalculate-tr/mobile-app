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
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Categories: undefined;
  Offers: undefined;
  CategoryProducts: { categoryName: string };
  ProductDetail: { productId: string };
  Checkout:
    | { selectedAddressId?: string; pendingPaymentOrderId?: string }
    | undefined;
  Addresses: { selectMode?: boolean } | undefined;
  OrderSuccess: { orderCode: string; orderId?: string; noticeMessage?: string; macro_points?: number };
  DevDiagnostics: undefined;
  Login: { redirectTo?: AuthRedirectTarget } | undefined;
  Register: { redirectTo?: AuthRedirectTarget } | undefined;
  EmailVerification: { email: string };
  Onboarding: undefined;
  NutritionSetup: undefined;
  ProfileOrders: undefined;
  OrderDetail: { orderId: number };
  ProfileSavedCards: undefined;
  ProfileCoupons: undefined;
  ProfileSupport: undefined;
  ProfileSecurity: undefined;
  ProfileNotificationPreferences: undefined;
  ProfileContracts: { slug?: string } | undefined;
  PersonalInfo: undefined;
  Feedback: undefined;
  NutritionProfile: undefined;
  MeasurementHistory: undefined;
  PaymentScreen: { orderId: string; amount: number; orderCode?: string; noticeMessage?: string };
  MacroSuccess: { quantity: number; newBalance: number; privileged: boolean } | undefined;
};
