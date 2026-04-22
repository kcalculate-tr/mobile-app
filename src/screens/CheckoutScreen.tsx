import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { WebView } from 'react-native-webview';
import { ArrowLeft, CaretRight, CreditCard, Lock, House, Storefront, Lightning, CalendarBlank, MapPin, Info as InfoIcon } from 'phosphor-react-native';
import ScreenContainer from '../components/ScreenContainer';
import FormField from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import PrivilegedBadge from '../components/PrivilegedBadge';
import { fetchMacroProfile, isPrivileged, processOrderMacroEarn } from '../lib/macros';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { isApiBaseUrlConfigured } from '../lib/api';
import {
  createOrderDraftForPayment,
  createOrderFromCart,
  fetchPendingPaymentOrderById,
  PendingPaymentOrder,
  updateOrderPaymentStatus,
} from '../lib/orders';
import {
  getPaymentConfigStatus,
  initPayment,
  mapPaymentErrorToMessage,
} from '../lib/payment';
import {
  formatSupabaseErrorForDevLog,
  mapSupabaseErrorToUserMessage,
} from '../lib/supabaseErrors';
import { getSupabaseClient } from '../lib/supabase';
import {
  fetchGlobalDeliverySettings,
  resolveMinOrder,
  resolveShippingFee,
  resolveFreeShippingAbove,
  DeliveryGlobals,
  DeliveryZoneRow,
} from '../lib/delivery';
import { fetchBusinessHours, isShopOpenNow, isDateAvailableForScheduled, getAvailableScheduledDates, formatTime, BusinessHours } from '../lib/businessHours';
import { fetchBranches, Branch } from '../lib/branches';
import { RootStackParamList } from '../navigation/types';
import { useCartStore } from '../store/cartStore';
import { usePantryStore } from '../store/pantryStore';
import { useAddressStore } from '../store/addressStore';
import { Address, CouponValidationResult, DeliveryRuleStatus } from '../types';
import { haptic } from '../utils/haptics';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import DeliveryZonesSheet from '../components/DeliveryZonesSheet';
import { formatDeliveryDays, isDeliveryDay, DAY_NAMES_TR } from '../utils/deliveryDays';

type CheckoutRouteProp = RouteProp<RootStackParamList, 'Checkout'>;
type CheckoutNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const toCurrency = (value: number) => `₺${value.toFixed(2)}`;

const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const TIME_SLOTS = [
  { id: '1', label: '09:30 – 13:30', start: '09:30', end: '13:30', disabled: false },
  { id: '2', label: '13:30 – 17:30', start: '13:30', end: '17:30', disabled: false },
  { id: '3', label: '17:30 – 21:30', start: '17:30', end: '21:30', disabled: true },
] as const;

type TimeSlot = (typeof TIME_SLOTS)[number];



const TOSLA_PROCESS_URL = 'https://entegrasyon.tosla.com/api/Payment/ProcessCardForm';

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

const normalizeAddress = (row: Record<string, unknown>): Address => ({
  id: String(row.id ?? '').trim(),
  user_id: String(row.user_id ?? '').trim() || undefined,
  title: String(row.title ?? 'Adres').trim(),
  contact_name: String(row.contact_name ?? '').trim(),
  contact_phone: String(row.contact_phone ?? '').trim(),
  contact_email: String(row.contact_email ?? '').trim(),
  full_address: String(row.full_address ?? '').trim(),
  city: String(row.city ?? 'İzmir').trim() || 'İzmir',
  district: String(row.district ?? '').trim(),
  neighbourhood:
    String(
      row.neighborhood ?? row.neighbourhood ?? row.mahalle ?? '',
    ).trim() || null,
  created_at: String(row.created_at ?? '').trim() || undefined,
  updated_at: String(row.updated_at ?? '').trim() || undefined,
});

const resolveCheckoutErrorMessage = (error: unknown, fallback: string) =>
  mapSupabaseErrorToUserMessage(error, fallback);

const fallbackOrderCodeFromId = (orderId: string) =>
  `#${String(orderId || '').slice(0, 8).toUpperCase()}`;

const RULES_FETCH_ERROR_MESSAGE =
  'Teslimat kuralları yüklenemedi. Lütfen tekrar deneyin.';

const toNormalizedText = (value: unknown) =>
  String(value ?? '').trim().toLocaleLowerCase('tr-TR');

const readZoneNeighborhood = (row: Record<string, unknown>) =>
  String(row.neighborhood ?? row.neighbourhood ?? row.mahalle ?? '').trim();

const BRANCH_ADDRESS = 'Basın Sitesi Mah. 177/3. Sk. No:3A Karabağlar İzmir';

const getGoogleMapsKey = (): string => {
  const fromConfig =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
  const value =
    (typeof fromConfig === 'string' ? fromConfig : '') ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
    '';
  return String(value).trim();
};

// ─── Checkout Reducers ─────────────────────────────────────────────────────

type AddressState = {
  loadingAddresses: boolean;
  addressError: string;
  addresses: Address[];
  selectedAddressId: string;
  mapCoords: { lat: number; lng: number } | null;
  geocoding: boolean;
  deliveryRuleStatus: DeliveryRuleStatus;
};
type AddressAction =
  | { type: 'SET_LOADING_ADDRESSES'; payload: boolean }
  | { type: 'SET_ADDRESS_ERROR'; payload: string }
  | { type: 'SET_ADDRESSES'; payload: Address[] }
  | { type: 'SET_SELECTED_ADDRESS_ID'; payload: string }
  | { type: 'SET_MAP_COORDS'; payload: { lat: number; lng: number } | null }
  | { type: 'SET_GEOCODING'; payload: boolean }
  | { type: 'SET_DELIVERY_RULE_STATUS'; payload: DeliveryRuleStatus };
function addressReducer(state: AddressState, action: AddressAction): AddressState {
  switch (action.type) {
    case 'SET_LOADING_ADDRESSES': return { ...state, loadingAddresses: action.payload };
    case 'SET_ADDRESS_ERROR': return { ...state, addressError: action.payload };
    case 'SET_ADDRESSES': return { ...state, addresses: action.payload };
    case 'SET_SELECTED_ADDRESS_ID': return { ...state, selectedAddressId: action.payload };
    case 'SET_MAP_COORDS': return { ...state, mapCoords: action.payload };
    case 'SET_GEOCODING': return { ...state, geocoding: action.payload };
    case 'SET_DELIVERY_RULE_STATUS': return { ...state, deliveryRuleStatus: action.payload };
    default: return state;
  }
}
const addressInitial: AddressState = {
  loadingAddresses: true, addressError: '', addresses: [], selectedAddressId: '',
  mapCoords: null, geocoding: false, deliveryRuleStatus: { status: 'idle' },
};

type DeliveryState = {
  deliveryMethod: 'home_delivery' | 'pickup';
  deliveryTimeType: 'immediate' | 'scheduled';
  selectedScheduledDate: Date | null;
  selectedTimeSlot: TimeSlot | null;
  branches: Branch[];
  branchesLoading: boolean;
  branchesError: string;
  businessHours: BusinessHours | null;
};
type DeliveryAction =
  | { type: 'SET_DELIVERY_METHOD'; payload: 'home_delivery' | 'pickup' }
  | { type: 'SET_DELIVERY_TIME_TYPE'; payload: 'immediate' | 'scheduled' }
  | { type: 'SET_SCHEDULED_DATE'; payload: Date | null }
  | { type: 'SET_TIME_SLOT'; payload: TimeSlot | null }
  | { type: 'SET_BRANCHES'; payload: Branch[] }
  | { type: 'SET_BRANCHES_LOADING'; payload: boolean }
  | { type: 'SET_BRANCHES_ERROR'; payload: string }
  | { type: 'SET_BUSINESS_HOURS'; payload: BusinessHours | null };
function deliveryReducer(state: DeliveryState, action: DeliveryAction): DeliveryState {
  switch (action.type) {
    case 'SET_DELIVERY_METHOD': return { ...state, deliveryMethod: action.payload };
    case 'SET_DELIVERY_TIME_TYPE': return { ...state, deliveryTimeType: action.payload };
    case 'SET_SCHEDULED_DATE': return { ...state, selectedScheduledDate: action.payload };
    case 'SET_TIME_SLOT': return { ...state, selectedTimeSlot: action.payload };
    case 'SET_BRANCHES': return { ...state, branches: action.payload };
    case 'SET_BRANCHES_LOADING': return { ...state, branchesLoading: action.payload };
    case 'SET_BRANCHES_ERROR': return { ...state, branchesError: action.payload };
    case 'SET_BUSINESS_HOURS': return { ...state, businessHours: action.payload };
    default: return state;
  }
}
const deliveryInitial: DeliveryState = {
  deliveryMethod: 'home_delivery', deliveryTimeType: 'immediate',
  selectedScheduledDate: null, selectedTimeSlot: null,
  branches: [], branchesLoading: false, branchesError: '',
  businessHours: null,
};

type OrderFormState = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderNote: string;
  contractsAccepted: boolean;
  placingOrder: boolean;
  screenError: string;
  paymentNotice: string;
  settingsFetchStatus: 'loading' | 'ready' | 'error';
  settingsMinCartAmount: number;
  couponInfo: CouponValidationResult | null;
  rulesRefreshKey: number;
};
type OrderFormAction =
  | { type: 'SET_CUSTOMER_NAME'; payload: string }
  | { type: 'SET_CUSTOMER_EMAIL'; payload: string }
  | { type: 'SET_CUSTOMER_PHONE'; payload: string }
  | { type: 'SET_ORDER_NOTE'; payload: string }
  | { type: 'SET_CONTRACTS_ACCEPTED'; payload: boolean }
  | { type: 'SET_PLACING_ORDER'; payload: boolean }
  | { type: 'SET_SCREEN_ERROR'; payload: string }
  | { type: 'SET_PAYMENT_NOTICE'; payload: string }
  | { type: 'SET_SETTINGS_FETCH_STATUS'; payload: 'loading' | 'ready' | 'error' }
  | { type: 'SET_SETTINGS_MIN_CART'; payload: number }
  | { type: 'SET_COUPON_INFO'; payload: CouponValidationResult | null }
  | { type: 'SET_RULES_REFRESH_KEY'; payload: number };
function orderFormReducer(state: OrderFormState, action: OrderFormAction): OrderFormState {
  switch (action.type) {
    case 'SET_CUSTOMER_NAME': return { ...state, customerName: action.payload };
    case 'SET_CUSTOMER_EMAIL': return { ...state, customerEmail: action.payload };
    case 'SET_CUSTOMER_PHONE': return { ...state, customerPhone: action.payload };
    case 'SET_ORDER_NOTE': return { ...state, orderNote: action.payload };
    case 'SET_CONTRACTS_ACCEPTED': return { ...state, contractsAccepted: action.payload };
    case 'SET_PLACING_ORDER': return { ...state, placingOrder: action.payload };
    case 'SET_SCREEN_ERROR': return { ...state, screenError: action.payload };
    case 'SET_PAYMENT_NOTICE': return { ...state, paymentNotice: action.payload };
    case 'SET_SETTINGS_FETCH_STATUS': return { ...state, settingsFetchStatus: action.payload };
    case 'SET_SETTINGS_MIN_CART': return { ...state, settingsMinCartAmount: action.payload };
    case 'SET_COUPON_INFO': return { ...state, couponInfo: action.payload };
    case 'SET_RULES_REFRESH_KEY': return { ...state, rulesRefreshKey: action.payload };
    default: return state;
  }
}
const orderFormInitial: OrderFormState = {
  customerName: '', customerEmail: '', customerPhone: '',
  orderNote: '', contractsAccepted: false, placingOrder: false,
  screenError: '', paymentNotice: '',
  settingsFetchStatus: 'loading', settingsMinCartAmount: 0,
  couponInfo: null, rulesRefreshKey: 0,
};

type PayState = {
  step: 'summary' | 'payment';
  cardHolder: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  payLoading: boolean;
  payError: string;
  webViewHtml: string | null;
  pendingPaymentOrder: PendingPaymentOrder | null;
  loadingPendingOrder: boolean;
  retryPaymentOrderId: string;
};
type PayAction =
  | { type: 'SET_STEP'; payload: 'summary' | 'payment' }
  | { type: 'SET_CARD_HOLDER'; payload: string }
  | { type: 'SET_CARD_NUMBER'; payload: string }
  | { type: 'SET_EXPIRY'; payload: string }
  | { type: 'SET_CVV'; payload: string }
  | { type: 'SET_PAY_LOADING'; payload: boolean }
  | { type: 'SET_PAY_ERROR'; payload: string }
  | { type: 'SET_WEB_VIEW_HTML'; payload: string | null }
  | { type: 'SET_PENDING_PAYMENT_ORDER'; payload: PendingPaymentOrder | null }
  | { type: 'UPDATE_PENDING_PAYMENT_ORDER'; payload: Partial<PendingPaymentOrder> }
  | { type: 'SET_LOADING_PENDING_ORDER'; payload: boolean }
  | { type: 'SET_RETRY_PAYMENT_ORDER_ID'; payload: string };
function payReducer(state: PayState, action: PayAction): PayState {
  switch (action.type) {
    case 'SET_STEP': return { ...state, step: action.payload };
    case 'SET_CARD_HOLDER': return { ...state, cardHolder: action.payload };
    case 'SET_CARD_NUMBER': return { ...state, cardNumber: action.payload };
    case 'SET_EXPIRY': return { ...state, expiry: action.payload };
    case 'SET_CVV': return { ...state, cvv: action.payload };
    case 'SET_PAY_LOADING': return { ...state, payLoading: action.payload };
    case 'SET_PAY_ERROR': return { ...state, payError: action.payload };
    case 'SET_WEB_VIEW_HTML': return { ...state, webViewHtml: action.payload };
    case 'SET_PENDING_PAYMENT_ORDER': return { ...state, pendingPaymentOrder: action.payload };
    case 'UPDATE_PENDING_PAYMENT_ORDER':
      return state.pendingPaymentOrder
        ? { ...state, pendingPaymentOrder: { ...state.pendingPaymentOrder, ...action.payload } }
        : state;
    case 'SET_LOADING_PENDING_ORDER': return { ...state, loadingPendingOrder: action.payload };
    case 'SET_RETRY_PAYMENT_ORDER_ID': return { ...state, retryPaymentOrderId: action.payload };
    default: return state;
  }
}
const payInitial: PayState = {
  step: 'summary', cardHolder: '', cardNumber: '', expiry: '', cvv: '',
  payLoading: false, payError: '', webViewHtml: null,
  pendingPaymentOrder: null, loadingPendingOrder: false, retryPaymentOrderId: '',
};

export default function CheckoutScreen() {
  const navigation = useNavigation<CheckoutNavigationProp>();
  const route = useRoute<CheckoutRouteProp>();
  const insets = useSafeAreaInsets();

  const { user, authLoading } = useAuth();
  const { isAuthenticated, loading } = useRequireAuth();

  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useCartStore((state) => state.getSubtotal());

  const [addr, dispatchAddr] = useReducer(addressReducer, addressInitial);
  const [delivery, dispatchDelivery] = useReducer(deliveryReducer, deliveryInitial);
  const [orderForm, dispatchOrder] = useReducer(orderFormReducer, orderFormInitial);
  const [pay, dispatchPay] = useReducer(payReducer, payInitial);

  // Destructure for JSX convenience
  const { loadingAddresses, addressError, addresses, selectedAddressId, mapCoords, geocoding, deliveryRuleStatus } = addr;
  const { deliveryMethod, deliveryTimeType, selectedScheduledDate, selectedTimeSlot, branches, branchesLoading, branchesError, businessHours } = delivery;
  const { customerName, customerEmail, customerPhone, orderNote, contractsAccepted, placingOrder, screenError, paymentNotice, settingsFetchStatus, settingsMinCartAmount, couponInfo, rulesRefreshKey } = orderForm;
  const { step, cardHolder, cardNumber, expiry, cvv, payLoading, payError, webViewHtml, pendingPaymentOrder, loadingPendingOrder, retryPaymentOrderId } = pay;

  const couponCode = '';
  const [showZonesSheet, setShowZonesSheet] = useState(false);
  const [deliveryDays, setDeliveryDays] = useState<number[] | null>(null);
  const [deliveryGlobals, setDeliveryGlobals] = useState<DeliveryGlobals | null>(null);

  const scheduledDates = useMemo(() =>
    businessHours ? getAvailableScheduledDates(businessHours, 21) : [],
  [businessHours]);
  const shopOpenNow = businessHours ? isShopOpenNow(businessHours) : true;

  // Dükkan kapalıysa otomatik randevuya geç
  useEffect(() => {
    if (businessHours && !isShopOpenNow(businessHours)) {
      dispatchDelivery({ type: 'SET_DELIVERY_TIME_TYPE', payload: 'scheduled' });
    }
  }, [businessHours]);

  const sectionOpacity = useRef(new Animated.Value(1)).current;
  const animateSection = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(sectionOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(sectionOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    callback();
  };
  const previousSubtotalRef = useRef(subtotal);

  const addToPantry = usePantryStore((s) => s.addItems);
  const setSelectedAddress = useAddressStore((s) => s.setSelectedAddress);

  const apiConfigured = isApiBaseUrlConfigured();
  const paymentConfig = getPaymentConfigStatus();
  const isPaymentFeatureEnabled = paymentConfig.isPaymentEnabled;
  const isPaymentConfigured = paymentConfig.isConfigured;
  const pendingPaymentOrderIdFromRoute = route.params?.pendingPaymentOrderId || '';
  const hasPendingOrderRoute = Boolean(pendingPaymentOrderIdFromRoute);
  const discountAmount = Number(couponInfo?.discountAmount || 0);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) || null,
    [addresses, selectedAddressId],
  );

  const rulesFetchFailed =
    settingsFetchStatus === 'error' || deliveryRuleStatus.status === 'error';
  const rulesLoading =
    settingsFetchStatus === 'loading' || deliveryRuleStatus.status === 'loading';

  // ─── Resolve min-order / shipping-fee from district override + globals ───
  const activeZoneRow: DeliveryZoneRow | null =
    deliveryRuleStatus.status === 'ok'
      ? ((deliveryRuleStatus.data.zoneRow as DeliveryZoneRow | undefined) ?? null)
      : null;

  const resolvedMinOrder = resolveMinOrder(activeZoneRow, deliveryGlobals, deliveryTimeType);
  const freeShippingAbove = resolveFreeShippingAbove(
    activeZoneRow,
    deliveryGlobals,
    deliveryTimeType,
  );
  const resolvedShippingFee =
    deliveryMethod === 'pickup'
      ? 0
      : resolveShippingFee(activeZoneRow, deliveryGlobals, deliveryTimeType, subtotal);

  const deliveryFee = resolvedShippingFee;
  const totalAmount = Math.max(0, subtotal + deliveryFee - discountAmount);

  // settingsMinCartAmount (from `settings.min_cart_amount`) remains a hard
  // floor across the whole app; district/global values layer on top.
  const effectiveMinAmount = Math.max(
    Math.max(0, settingsMinCartAmount),
    resolvedMinOrder,
  );

  const remainingToMinAmount = Math.max(0, effectiveMinAmount - subtotal);

  const checkoutBlockMessage = useMemo(() => {
    if (deliveryMethod === 'pickup') {
      if (remainingToMinAmount > 0) {
        return `Minimum sepet: ${toCurrency(effectiveMinAmount)} — Kalan: ${toCurrency(remainingToMinAmount)}`;
      }
      return '';
    }

    if (rulesFetchFailed) {
      return RULES_FETCH_ERROR_MESSAGE;
    }

    if (!selectedAddress) return 'Lütfen teslimat adresi seçin.';

    if (rulesLoading) {
      return 'Teslimat kuralları kontrol ediliyor...';
    }

    if (deliveryRuleStatus.status === 'not_configured') {
      return 'Bu bölge için teslimat kuralı tanımlı değil. Lütfen farklı bir adres seçin.';
    }

    if (deliveryRuleStatus.status === 'ok' && !deliveryRuleStatus.data.isActive) {
      return 'Bu bölgeye teslimat yok';
    }

    if (
      deliveryRuleStatus.status === 'ok' &&
      deliveryTimeType === 'immediate' &&
      !deliveryRuleStatus.data.allowImmediate
    ) {
      return 'Bu bölgede hemen teslimat yok. Lütfen randevulu teslimatı seçin.';
    }

    if (
      deliveryRuleStatus.status === 'ok' &&
      deliveryTimeType === 'scheduled' &&
      !deliveryRuleStatus.data.allowScheduled
    ) {
      return 'Bu bölgede randevulu teslimat yok. Lütfen hemen teslimatı seçin.';
    }

    if (deliveryTimeType === 'scheduled' && !selectedScheduledDate) {
      return 'Lütfen teslimat tarihi seçin.';
    }

    if (deliveryTimeType === 'scheduled' && selectedScheduledDate && !selectedTimeSlot) {
      return 'Lütfen teslimat saatini seçin.';
    }

    if (remainingToMinAmount > 0) {
      return `Minimum sepet: ${toCurrency(effectiveMinAmount)} — Kalan: ${toCurrency(remainingToMinAmount)}`;
    }

    return '';
  }, [
    deliveryMethod,
    rulesFetchFailed,
    rulesLoading,
    selectedAddress,
    deliveryRuleStatus,
    deliveryTimeType,
    effectiveMinAmount,
    remainingToMinAmount,
    selectedScheduledDate,
    selectedTimeSlot,
  ]);

  const isCheckoutDisabled = useMemo(() => {
    if (placingOrder) return true;

    // Randevulu teslimat için tarih ve saat zorunlu
    if (deliveryTimeType === 'scheduled' && (!selectedScheduledDate || !selectedTimeSlot)) {
      return true;
    }

    const rulesBlockNeeded = deliveryMethod === 'home_delivery';

    if (!isPaymentFeatureEnabled) {
      return (
        items.length === 0 ||
        !contractsAccepted ||
        (rulesBlockNeeded && (rulesLoading || rulesFetchFailed)) ||
        Boolean(checkoutBlockMessage)
      );
    }

    if (!isPaymentConfigured) return true;

    if (hasPendingOrderRoute) {
      return loadingPendingOrder || !pendingPaymentOrder;
    }

    return (
      items.length === 0 ||
      !contractsAccepted ||
      (rulesBlockNeeded && (rulesLoading || rulesFetchFailed)) ||
      Boolean(checkoutBlockMessage)
    );
  }, [
    placingOrder,
    deliveryMethod,
    isPaymentFeatureEnabled,
    isPaymentConfigured,
    hasPendingOrderRoute,
    loadingPendingOrder,
    pendingPaymentOrder,
    items.length,
    contractsAccepted,
    rulesLoading,
    rulesFetchFailed,
    checkoutBlockMessage,
    deliveryTimeType,
    selectedScheduledDate,
    selectedTimeSlot,
  ]);

  const actionButtonLabel = useMemo(() => {
    if (isPaymentFeatureEnabled) {
      if (!isPaymentConfigured) return 'Ödeme Yapılandırılmadı';
      if (placingOrder) return 'Ödeme İşleniyor...';
      if (hasPendingOrderRoute || retryPaymentOrderId) {
        return `Ödemeyi Tamamla • ${toCurrency(
          pendingPaymentOrder?.totalAmount || totalAmount,
        )}`;
      }
      return `Ödemeye Geç • ${toCurrency(totalAmount)}`;
    }

    return `Siparişi Oluştur • ${toCurrency(totalAmount)}`;
  }, [
    isPaymentFeatureEnabled,
    isPaymentConfigured,
    placingOrder,
    hasPendingOrderRoute,
    retryPaymentOrderId,
    pendingPaymentOrder?.totalAmount,
    totalAmount,
  ]);

  useEffect(() => {
    if (route.params?.selectedAddressId) {
      const id = route.params.selectedAddressId;
      dispatchAddr({ type: 'SET_SELECTED_ADDRESS_ID', payload: id });
      const address = addresses.find((a) => a.id === id);
      if (address) setSelectedAddress(address);
    }
  }, [route.params?.selectedAddressId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigation.replace('Login', { redirectTo: 'Checkout' });
    }
  }, [authLoading, user, navigation]);

  useEffect(() => {
    if (!user || !hasPendingOrderRoute) {
      dispatchPay({ type: 'SET_PENDING_PAYMENT_ORDER', payload: null });
      dispatchPay({ type: 'SET_RETRY_PAYMENT_ORDER_ID', payload: '' });
      return;
    }

    let mounted = true;

    const loadPendingOrder = async () => {
      dispatchPay({ type: 'SET_LOADING_PENDING_ORDER', payload: true });
      dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: '' });
      dispatchOrder({ type: 'SET_PAYMENT_NOTICE', payload: '' });

      try {
        const supabase = getSupabaseClient();
        const order = await fetchPendingPaymentOrderById({
          supabase,
          userId: user.id,
          orderId: pendingPaymentOrderIdFromRoute,
        });

        if (!mounted) return;

        if (!order) {
          dispatchPay({ type: 'SET_PENDING_PAYMENT_ORDER', payload: null });
          dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: 'Ödeme bekleyen sipariş bulunamadı.' });
          return;
        }

        dispatchPay({ type: 'SET_PENDING_PAYMENT_ORDER', payload: order });
        dispatchPay({ type: 'SET_RETRY_PAYMENT_ORDER_ID', payload: order.id });
      } catch (error: unknown) {
        if (!mounted) return;
        if (__DEV__) {
          console.warn(
            `[checkout] pending order load error: ${formatSupabaseErrorForDevLog(error)}`,
          );
        }
        dispatchPay({ type: 'SET_PENDING_PAYMENT_ORDER', payload: null });
        dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: mapSupabaseErrorToUserMessage(
            error,
            'Ödeme bekleyen sipariş alınamadı. Lütfen tekrar deneyin.',
          ) });
      } finally {
        if (mounted) {
          dispatchPay({ type: 'SET_LOADING_PENDING_ORDER', payload: false });
        }
      }
    };

    loadPendingOrder();

    return () => {
      mounted = false;
    };
  }, [user, hasPendingOrderRoute, pendingPaymentOrderIdFromRoute]);

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      dispatchOrder({ type: 'SET_SETTINGS_FETCH_STATUS', payload: 'loading' });
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('settings')
          .select('min_cart_amount')
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!mounted) return;
        if (error) throw error;

        dispatchOrder({ type: 'SET_SETTINGS_MIN_CART', payload: Math.max(0, Number(data?.min_cart_amount || 0)) });
        dispatchOrder({ type: 'SET_SETTINGS_FETCH_STATUS', payload: 'ready' });
        const bh = await fetchBusinessHours();
        dispatchDelivery({ type: 'SET_BUSINESS_HOURS', payload: bh });
        // Fetch global delivery defaults (delivery_settings.__GLOBAL__.cargo_rules).
        // If absent, per-type overrides on delivery_zones still take precedence via resolvers.
        const globals = await fetchGlobalDeliverySettings();
        if (mounted) setDeliveryGlobals(globals);
      } catch (error: unknown) {
        if (!mounted) return;
        if (__DEV__) {
          console.warn(
            `[checkout] settings load error: ${formatSupabaseErrorForDevLog(error)}`,
          );
        }
        dispatchOrder({ type: 'SET_SETTINGS_FETCH_STATUS', payload: 'error' });
      }
    };

    loadSettings();

    return () => {
      mounted = false;
    };
  }, [rulesRefreshKey]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const loadAddresses = async () => {
      dispatchAddr({ type: 'SET_LOADING_ADDRESSES', payload: true });
      dispatchAddr({ type: 'SET_ADDRESS_ERROR', payload: '' });

      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!mounted) return;

        if (error) throw error;

        const normalized = (Array.isArray(data) ? data : [])
          .map((row) => normalizeAddress(row as Record<string, unknown>))
          .filter((address) => address.id);

        dispatchAddr({ type: 'SET_ADDRESSES', payload: normalized });

        if (normalized.length > 0) {
          const targetId = route.params?.selectedAddressId;
          const hasTarget = normalized.some((item) => item.id === targetId);
          const id = hasTarget && targetId ? targetId : normalized[0].id;
          dispatchAddr({ type: 'SET_SELECTED_ADDRESS_ID', payload: id });
          const address = normalized.find((a) => a.id === id);
          if (address) setSelectedAddress(address);
        }
      } catch (error: unknown) {
        if (!mounted) return;
        if (__DEV__) {
          console.warn(`[checkout] addresses load error: ${formatSupabaseErrorForDevLog(error)}`);
        }
        dispatchAddr({ type: 'SET_ADDRESSES', payload: [] });
        dispatchAddr({ type: 'SET_ADDRESS_ERROR', payload: mapSupabaseErrorToUserMessage(
            error,
            'Adresler yüklenemedi. Lütfen tekrar deneyin.',
          ) });
      } finally {
        if (mounted) {
          dispatchAddr({ type: 'SET_LOADING_ADDRESSES', payload: false });
        }
      }
    };

    loadAddresses();

    return () => {
      mounted = false;
    };
  }, [user, route.params?.selectedAddressId]);

  useEffect(() => {
    if (!selectedAddress) return;

    dispatchOrder({ type: 'SET_CUSTOMER_NAME', payload: customerName || selectedAddress.contact_name || '' });
    dispatchOrder({ type: 'SET_CUSTOMER_EMAIL', payload: customerEmail || selectedAddress.contact_email || user?.email || '' });
    dispatchOrder({ type: 'SET_CUSTOMER_PHONE', payload: customerPhone || selectedAddress.contact_phone || '' });
  }, [selectedAddress, user?.email]);

  useEffect(() => {
    if (!user?.id) return;
    if (user.email) {
      dispatchOrder({ type: 'SET_CUSTOMER_EMAIL', payload: user.email });
    }
    const supabase = getSupabaseClient();
    supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.full_name) {
          dispatchOrder({ type: 'SET_CUSTOMER_NAME', payload: String(data.full_name) });
        }
        if (data.phone) {
          dispatchOrder({ type: 'SET_CUSTOMER_PHONE', payload: String(data.phone) });
        }
      });
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!selectedAddress?.district) {
      dispatchAddr({ type: 'SET_DELIVERY_RULE_STATUS', payload: { status: 'idle' } });
      setDeliveryDays(null);
      return;
    }

    let mounted = true;

    const fetchDistrictRule = async () => {
      dispatchAddr({ type: 'SET_DELIVERY_RULE_STATUS', payload: { status: 'loading' } });
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('delivery_zones')
          .select('*')
          .eq('district', selectedAddress.district)
          .order('updated_at', { ascending: false })
          .limit(50);

        if (!mounted) return;

        if (error) {
          dispatchAddr({ type: 'SET_DELIVERY_RULE_STATUS', payload: {
            status: 'error',
            message: RULES_FETCH_ERROR_MESSAGE,
          } });
          return;
        }

        const rows = Array.isArray(data) ? data : [];
        if (rows.length === 0) {
          dispatchAddr({ type: 'SET_DELIVERY_RULE_STATUS', payload: { status: 'not_configured' } });
          return;
        }

        const selectedNeighborhood = toNormalizedText(selectedAddress.neighbourhood);
        const matchingRow = selectedNeighborhood
          ? rows.find((row) => {
              const zoneNeighborhood = toNormalizedText(
                readZoneNeighborhood(row as Record<string, unknown>),
              );
              return zoneNeighborhood === selectedNeighborhood;
            })
          : rows[0];

        if (!matchingRow) {
          dispatchAddr({ type: 'SET_DELIVERY_RULE_STATUS', payload: { status: 'not_configured' } });
          return;
        }

        const zoneRow = matchingRow as Record<string, unknown>;
        // Pick per delivery type — fallback chain: new typed column → legacy delivery_days → weekdays.
        const typedCol =
          deliveryTimeType === 'immediate'
            ? zoneRow.delivery_days_immediate
            : zoneRow.delivery_days_scheduled;
        const rawDeliveryDays =
          typedCol !== undefined && typedCol !== null
            ? typedCol
            : zoneRow.delivery_days;
        const parsedDeliveryDays = Array.isArray(rawDeliveryDays)
          ? (rawDeliveryDays as unknown[])
              .map((v) => Number(v))
              .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
          : [];
        setDeliveryDays(parsedDeliveryDays.length > 0 ? parsedDeliveryDays : [1, 2, 3, 4, 5]);

        const hasAllowRule =
          zoneRow.allow_immediate !== undefined ||
          zoneRow.allow_scheduled !== undefined;

        const allowImmediate = hasAllowRule
          ? zoneRow.allow_immediate === true
          : true;
        const allowScheduled = hasAllowRule
          ? zoneRow.allow_scheduled === true
          : true;

        dispatchAddr({ type: 'SET_DELIVERY_RULE_STATUS', payload: {
          status: 'ok',
          data: {
            district: String(zoneRow.district || selectedAddress.district).trim(),
            neighbourhood: readZoneNeighborhood(zoneRow) || null,
            isActive: allowImmediate || allowScheduled,
            minOrder: Math.max(0, Number(zoneRow.min_order || 0)),
            allowImmediate,
            allowScheduled,
            zoneRow,
          },
        } });
      } catch (error: unknown) {
        if (!mounted) return;
        if (__DEV__) {
          console.warn(
            `[checkout] delivery rule error: ${formatSupabaseErrorForDevLog(error)}`,
          );
        }
        dispatchAddr({ type: 'SET_DELIVERY_RULE_STATUS', payload: {
          status: 'error',
          message: RULES_FETCH_ERROR_MESSAGE,
        } });
      }
    };

    fetchDistrictRule();

    return () => {
      mounted = false;
    };
  }, [
    selectedAddress?.district,
    selectedAddress?.neighbourhood,
    rulesRefreshKey,
    deliveryTimeType,
  ]);

  useEffect(() => {
    if (previousSubtotalRef.current === subtotal) return;
    previousSubtotalRef.current = subtotal;

    if (!couponInfo) return;
    dispatchOrder({ type: 'SET_COUPON_INFO', payload: null });
  }, [subtotal, couponInfo]);

  useEffect(() => {
    if (deliveryMethod !== 'pickup') return;

    let mounted = true;

    const loadBranches = async () => {
      dispatchDelivery({ type: 'SET_BRANCHES_LOADING', payload: true });
      dispatchDelivery({ type: 'SET_BRANCHES_ERROR', payload: '' });
      try {
        const data = await fetchBranches();
        if (!mounted) return;
        dispatchDelivery({ type: 'SET_BRANCHES', payload: data });
      } catch {
        if (!mounted) return;
        dispatchDelivery({ type: 'SET_BRANCHES_ERROR', payload: 'Şube bilgisi yüklenemedi. Lütfen tekrar deneyin.' });
      } finally {
        if (mounted) dispatchDelivery({ type: 'SET_BRANCHES_LOADING', payload: false });
      }
    };

    loadBranches();

    return () => {
      mounted = false;
    };
  }, [deliveryMethod]);

  useEffect(() => {
    if (!selectedAddress?.full_address) { dispatchAddr({ type: 'SET_MAP_COORDS', payload: null }); return; }
    let mounted = true;
    dispatchAddr({ type: 'SET_GEOCODING', payload: true });
    dispatchAddr({ type: 'SET_MAP_COORDS', payload: null });
    const run = async () => {
      try {
        const apiKey = getGoogleMapsKey();
        if (!apiKey) {
          if (__DEV__) {
            console.warn('[checkout] EXPO_PUBLIC_GOOGLE_MAPS_KEY missing — map disabled');
          }
          return;
        }
        const q = encodeURIComponent(
          `${selectedAddress.full_address}, ${selectedAddress.district}, ${selectedAddress.city || 'İzmir'}, Turkey`
        );
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${apiKey}`
        );
        const data = await res.json();
        if (mounted && data?.results?.[0]?.geometry?.location) {
          const { lat, lng } = data.results[0].geometry.location;
          dispatchAddr({ type: 'SET_MAP_COORDS', payload: { lat, lng } });
        }
      } catch (e) {
        // geocode error silently ignored
      }
      finally { if (mounted) dispatchAddr({ type: 'SET_GEOCODING', payload: false }); }
    };
    run();
    return () => { mounted = false; };
  }, [selectedAddress?.full_address, selectedAddress?.district]);

  const handleRetryRules = () => {
    dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: '' });
    dispatchOrder({ type: 'SET_RULES_REFRESH_KEY', payload: rulesRefreshKey + 1 });
  };

  const handleCreateOrder = async () => {
    dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: '' });
    dispatchOrder({ type: 'SET_PAYMENT_NOTICE', payload: '' });

    if (!user) {
      navigation.replace('Login', { redirectTo: 'Checkout' });
      return;
    }

    if (isPaymentFeatureEnabled && !isPaymentConfigured) {
      dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: 'Ödeme yapılandırılmadı.' });
      return;
    }

    const hasExistingPaymentOrder = Boolean(
      retryPaymentOrderId || pendingPaymentOrderIdFromRoute,
    );
    const shouldValidateDraftForm =
      !isPaymentFeatureEnabled || !hasExistingPaymentOrder;

    if (shouldValidateDraftForm) {
      if (deliveryMethod === 'home_delivery' && !selectedAddress) {
        dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: 'Lütfen adres seçin.' });
        return;
      }

      if (!customerName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
        dispatchOrder({
          type: 'SET_SCREEN_ERROR',
          payload: 'İletişim bilgileriniz eksik. Profil ayarlarından ad soyad ve telefonunuzu tamamlayın.',
        });
        return;
      }

      if (!contractsAccepted) {
        dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: 'Lütfen sözleşmeyi onaylayın.' });
        return;
      }

      if (checkoutBlockMessage) {
        dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: checkoutBlockMessage });
        return;
      }

      if (couponCode.trim() && !couponInfo && apiConfigured) {
        dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: 'Kuponu uygulayın veya alanı temizleyin.' });
        return;
      }

      if (deliveryTimeType === 'scheduled' && (!selectedScheduledDate || !selectedTimeSlot)) {
        dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: 'Lütfen teslimat tarihi ve saatini seçin.' });
        return;
      }
    } else if (!pendingPaymentOrder) {
      dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: 'Ödeme bekleyen sipariş bulunamadı.' });
      return;
    }

    dispatchOrder({ type: 'SET_PLACING_ORDER', payload: true });
    let paymentOrderId = retryPaymentOrderId || pendingPaymentOrderIdFromRoute;
    let paymentOrderCode =
      pendingPaymentOrder?.orderCode ||
      (paymentOrderId ? fallbackOrderCodeFromId(paymentOrderId) : '');
    let paymentOrderAmount = pendingPaymentOrder?.totalAmount || totalAmount;
    const noticeMessages: string[] = [];

    try {
      const supabase = getSupabaseClient();

      // Build scheduled delivery fields
      const scheduledFields =
        deliveryTimeType === 'scheduled' && selectedScheduledDate && selectedTimeSlot
          ? {
              delivery_type: 'scheduled' as const,
              scheduled_date: selectedScheduledDate.toISOString().slice(0, 10), // YYYY-MM-DD
              scheduled_time: selectedTimeSlot.start,                            // e.g. '13:30'
            }
          : {
              delivery_type: 'immediate' as const,
              scheduled_date: null,
              scheduled_time: null,
            };

      const pickupAddress = {
        id: 'pickup',
        title: 'Gel-Al',
        contact_name: customerName.trim(),
        contact_phone: customerPhone.trim(),
        contact_email: customerEmail.trim(),
        full_address: 'Gel-Al (Şubeden Teslim)',
        city: '',
        district: '',
        neighbourhood: null,
      };
      const effectiveAddress = deliveryMethod === 'pickup' ? pickupAddress : selectedAddress!;
      const orderDeliveryMethod = deliveryMethod === 'home_delivery' ? 'delivery' : 'pickup';

      if (!isPaymentFeatureEnabled) {
        const orderResult = await createOrderFromCart({
          supabase,
          userId: user.id,
          address: effectiveAddress,
          cartItems: items,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          subtotal,
          deliveryFee,
          discountAmount,
          couponCode: couponInfo?.campaign?.code || null,
          couponId: couponInfo?.campaign?.id || null,
          deliveryMethod: orderDeliveryMethod,
          orderNote: orderNote.trim() || null,
          deliveryType: scheduledFields.delivery_type,
          scheduledDate: scheduledFields.scheduled_date,
          scheduledTime: scheduledFields.scheduled_time,
        });

        haptic.success();
        clearCart();

        // Sipariş macro kazanımı — fire & forget, navigasyonu bloklama
        const totalForEarn = subtotal + deliveryFee - discountAmount;
        processOrderMacroEarn({
          userId: user.id,
          orderTotal: totalForEarn,
          orderId: orderResult.orderId,
        }).then(({ earnedMacros }) => {
          // macro_points params'a geçirildi — OrderSuccessScreen Supabase'e sorgu atmaz
          navigation.replace('OrderSuccess', {
            orderCode: orderResult.orderCode,
            orderId: orderResult.orderId,
            macro_points: earnedMacros,
            noticeMessage:
              orderResult.warnings.length > 0
                ? orderResult.warnings.map((warning) => warning.message).join('\n')
                : undefined,
          });
        }).catch(() => {
          navigation.replace('OrderSuccess', {
            orderCode: orderResult.orderCode,
            orderId: orderResult.orderId,
            macro_points: 0,
            noticeMessage:
              orderResult.warnings.length > 0
                ? orderResult.warnings.map((warning) => warning.message).join('\n')
                : undefined,
          });
        });
        return;
      }

      if (!paymentOrderId) {
        const draftResult = await createOrderDraftForPayment({
          supabase,
          userId: user.id,
          address: effectiveAddress,
          cartItems: items,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          subtotal,
          deliveryFee,
          discountAmount,
          couponCode: couponInfo?.campaign?.code || null,
          couponId: couponInfo?.campaign?.id || null,
          deliveryMethod: orderDeliveryMethod,
          orderNote: orderNote.trim() || null,
          deliveryType: scheduledFields.delivery_type,
          scheduledDate: scheduledFields.scheduled_date,
          scheduledTime: scheduledFields.scheduled_time,
        });

        paymentOrderId = draftResult.orderId;
        paymentOrderCode = draftResult.orderCode;
        paymentOrderAmount = draftResult.totalAmount;
        dispatchPay({ type: 'SET_RETRY_PAYMENT_ORDER_ID', payload: draftResult.orderId });
        dispatchPay({ type: 'SET_PENDING_PAYMENT_ORDER', payload: {
          id: draftResult.orderId,
          orderCode: draftResult.orderCode,
          totalAmount: draftResult.totalAmount,
          status: 'pending_payment',
          paymentStatus: 'pending',
          updatedAt: new Date().toISOString(),
        } });
        if (draftResult.warnings.length > 0) {
          noticeMessages.push(
            ...draftResult.warnings.map((warning) => warning.message),
          );
        }
      } else {
        await updateOrderPaymentStatus({
          supabase,
          orderId: paymentOrderId,
          userId: user.id,
          status: 'pending_payment',
          paymentStatus: 'pending',
          paymentErrorMessage: null,
        });
      }

      dispatchPay({ type: 'SET_STEP', payload: 'payment' });
    } catch (error: unknown) {
      if (__DEV__) {
        console.warn(`[checkout] create order error: ${formatSupabaseErrorForDevLog(error)}`);
      }

      if (isPaymentFeatureEnabled) {
        const paymentMessage = mapPaymentErrorToMessage(error);
        haptic.error();
        dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: paymentMessage });
        dispatchOrder({ type: 'SET_PAYMENT_NOTICE', payload: 'Ödeme tamamlanamadı. Tekrar deneyebilirsiniz.' });

        if (paymentOrderId) {
          dispatchPay({ type: 'SET_RETRY_PAYMENT_ORDER_ID', payload: paymentOrderId });
          dispatchPay({ type: 'UPDATE_PENDING_PAYMENT_ORDER', payload: {
            id: paymentOrderId,
            orderCode:
              pendingPaymentOrder?.orderCode ||
              paymentOrderCode ||
              fallbackOrderCodeFromId(paymentOrderId),
            totalAmount: pendingPaymentOrder?.totalAmount || paymentOrderAmount,
            status: 'payment_failed',
            paymentStatus: 'failed',
            updatedAt: new Date().toISOString(),
          } });

          try {
            const supabase = getSupabaseClient();
            await updateOrderPaymentStatus({
              supabase,
              orderId: paymentOrderId,
              userId: user.id,
              status: 'payment_failed',
              paymentStatus: 'failed',
              paymentErrorMessage: paymentMessage,
            });
          } catch (statusError: unknown) {
            if (__DEV__) {
              console.warn(
                `[checkout] payment status update error: ${formatSupabaseErrorForDevLog(statusError)}`,
              );
            }
          }
        }
      } else {
        haptic.error();
        dispatchOrder({ type: 'SET_SCREEN_ERROR', payload: resolveCheckoutErrorMessage(
            error,
            'Sipariş oluşturulamadı. Lütfen tekrar deneyin.',
          ) });
      }
    } finally {
      dispatchOrder({ type: 'SET_PLACING_ORDER', payload: false });
    }
  };

  const completeOrder = async (orderId: string) => {
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('orders')
        .update({ status: 'confirmed', payment_status: 'paid' })
        .eq('id', orderId);
    } catch (err) {
      console.error('Order update error:', err);
    }
  };

  const handlePay = async () => {
        dispatchPay({ type: 'SET_PAY_ERROR', payload: '' });
    const cardDigits = cardNumber.replace(/\D/g, '');
    const expiryDigits = expiry.replace(/\D/g, '');

    if (!cardHolder.trim()) { dispatchPay({ type: 'SET_PAY_ERROR', payload: 'Kart sahibi adını girin.' }); return; }
    if (cardDigits.length < 16) { dispatchPay({ type: 'SET_PAY_ERROR', payload: 'Geçerli bir kart numarası girin.' }); return; }
    if (expiryDigits.length < 4) { dispatchPay({ type: 'SET_PAY_ERROR', payload: 'Son kullanma tarihini girin.' }); return; }
    if (cvv.length < 3) { dispatchPay({ type: 'SET_PAY_ERROR', payload: 'CVV girin.' }); return; }

    const currentOrderId = retryPaymentOrderId || pendingPaymentOrderIdFromRoute;
    if (!currentOrderId) { dispatchPay({ type: 'SET_PAY_ERROR', payload: 'Sipariş bulunamadı.' }); return; }

    dispatchPay({ type: 'SET_PAY_LOADING', payload: true });
    try {
      const initResult = await initPayment(currentOrderId, totalAmount);
              if (!initResult.success || !initResult.threeDSessionId) {
        dispatchPay({ type: 'SET_PAY_ERROR', payload: initResult.error ?? 'Ödeme başlatılamadı.' });
        return;
      }

      const formData = new FormData();
      formData.append('ThreeDSessionId', initResult.threeDSessionId);
      formData.append('CardHolderName', cardHolder.trim());
      formData.append('CardNo', cardDigits);
      formData.append('ExpireDate', expiryDigits.slice(0, 2) + expiryDigits.slice(2, 4));
      formData.append('Cvv', cvv);
                  
      const res = await fetch(TOSLA_PROCESS_URL, { method: 'POST', body: formData });
      const responseText = await res.text();
      dispatchPay({ type: 'SET_WEB_VIEW_HTML', payload: responseText });
    } catch (err) {
      dispatchPay({ type: 'SET_PAY_ERROR', payload: String(err) });
    } finally {
      dispatchPay({ type: 'SET_PAY_LOADING', payload: false });
    }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color={COLORS.brand.green} size="large" />
  </View>;
  if (!isAuthenticated) return null;

  return (
    <ScreenContainer edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (step === 'payment') {
                dispatchPay({ type: 'SET_STEP', payload: 'summary' });
              } else {
                navigation.goBack();
              }
            }}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{step === 'summary' ? 'Sipariş Özeti' : 'Ödeme'}</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingHorizontal: SPACING.lg,
            paddingBottom: Math.max(120, insets.bottom + 100),
            paddingTop: SPACING.md,
            gap: SPACING.md,
            backgroundColor: '#f6f6f6',
          }}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'summary' ? (<>
          {/* ── Teslimat Yöntemi + Zamanı ── */}
          <View style={styles.card}>
            {/* Yöntem */}
            <View>
              <Text style={styles.deliveryGroupLabel}>Yöntem</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, deliveryMethod === 'home_delivery' && styles.chipActive]}
                  onPress={() => animateSection(() => dispatchDelivery({ type: 'SET_DELIVERY_METHOD', payload: 'home_delivery' }))}
                  activeOpacity={0.8}
                >
                  <House size={14} color={deliveryMethod === 'home_delivery' ? '#000' : COLORS.text.secondary} />
                  <Text style={[styles.chipText, deliveryMethod === 'home_delivery' && styles.chipTextActive]}>Eve Teslim</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, deliveryMethod === 'pickup' && styles.chipActive, !shopOpenNow && styles.chipDisabled]}
                  onPress={() => shopOpenNow && animateSection(() => dispatchDelivery({ type: 'SET_DELIVERY_METHOD', payload: 'pickup' }))}
                  activeOpacity={0.8}
                >
                  <Storefront size={14} color={deliveryMethod === 'pickup' ? '#000' : COLORS.text.secondary} />
                  <Text style={[styles.chipText, deliveryMethod === 'pickup' && styles.chipTextActive, !shopOpenNow && { color: '#dc2626' }]}>{shopOpenNow ? 'Gel-Al' : 'Kapalı'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setShowZonesSheet(true)} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '500', fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.text.tertiary }}>Teslimat bölgelerini gör →</Text>
              </TouchableOpacity>
            </View>

            {/* Zaman — sadece eve teslim */}
            {deliveryMethod === 'home_delivery' ? (
              <>
                <View style={styles.deliverySeparator} />
                <Animated.View style={{ opacity: sectionOpacity }}>
                <View>
                  <Text style={styles.deliveryGroupLabel}>Zaman</Text>
                  <View style={styles.chipRow}>
                    <TouchableOpacity
                      style={[styles.chip, deliveryTimeType === 'immediate' && styles.chipActive, !shopOpenNow && styles.chipDisabled]}
                      onPress={() => shopOpenNow && animateSection(() => dispatchDelivery({ type: 'SET_DELIVERY_TIME_TYPE', payload: 'immediate' }))}
                      activeOpacity={0.8}
                    >
                      <Lightning size={14} color={deliveryTimeType === 'immediate' ? '#000' : !shopOpenNow ? '#dc2626' : COLORS.text.secondary} />
                      <Text style={[styles.chipText, deliveryTimeType === 'immediate' && styles.chipTextActive, !shopOpenNow && { color: '#dc2626' }]}>
                        {shopOpenNow ? 'Hemen' : 'Kapalı'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chip, deliveryTimeType === 'scheduled' && styles.chipActive]}
                      onPress={() => animateSection(() => dispatchDelivery({ type: 'SET_DELIVERY_TIME_TYPE', payload: 'scheduled' }))}
                      activeOpacity={0.8}
                    >
                      <CalendarBlank size={14} color={deliveryTimeType === 'scheduled' ? '#000' : COLORS.text.secondary} />
                      <Text style={[styles.chipText, deliveryTimeType === 'scheduled' && styles.chipTextActive]}>Randevulu</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── Randevulu tarih seçici ── */}
                {deliveryTimeType === 'scheduled' ? (
                  <>
                    <View style={styles.deliverySeparator} />
                    <View>
                      <View style={{ height: 8 }} />
                      <Text style={styles.deliveryGroupLabel}>Teslimat Tarihi</Text>
                      {deliveryDays && deliveryDays.length < 7 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF9E6', padding: 12, borderRadius: 12, marginBottom: 12 }}>
                          <InfoIcon size={16} color="#F8C90E" weight="fill" style={{ marginRight: 8 }} />
                          <Text style={{ fontSize: 13, color: '#666', fontFamily: 'PlusJakartaSans_400Regular', flex: 1 }}>
                            Bu bölgeye teslimat günleri: {formatDeliveryDays(deliveryDays)}
                          </Text>
                        </View>
                      ) : null}
                      <FlatList
                        keyboardShouldPersistTaps="handled"
                        data={scheduledDates}
                        keyExtractor={(item) => item.toISOString()}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.dateFlatListContent}
                        renderItem={({ item }) => {
                          const isSelected =
                            selectedScheduledDate !== null &&
                            item.toDateString() === selectedScheduledDate.toDateString();
                          return (
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                if (!isDeliveryDay(item, deliveryDays)) {
                                  Alert.alert(
                                    'Teslimat Yapılmıyor',
                                    `${DAY_NAMES_TR[item.getDay()]} günü bu bölgeye teslimat yapılmamaktadır.\n\nMüsait günler: ${formatDeliveryDays(deliveryDays)}`,
                                  );
                                  return;
                                }
                                dispatchDelivery({ type: 'SET_SCHEDULED_DATE', payload: item });
                                dispatchDelivery({ type: 'SET_TIME_SLOT', payload: null });
                              }}
                              style={[styles.dateCard, isSelected && styles.dateCardActive]}
                            >
                              <Text style={[styles.dateDayName, isSelected && styles.dateLabelActive]}>
                                {TR_DAYS[item.getDay()]}
                              </Text>
                              <Text style={[styles.dateDayNum, isSelected && styles.dateLabelActive]}>
                                {item.getDate()}
                              </Text>
                              <Text style={[styles.dateMonth, isSelected && styles.dateLabelActive]}>
                                {TR_MONTHS[item.getMonth()]}
                              </Text>
                            </TouchableOpacity>
                          );
                        }}
                      />

                      {/* ── Time slot picker (shows after date selected) ── */}
                      {selectedScheduledDate !== null ? (
                        <View style={styles.timeSlotsWrap}>
                          <Text style={[styles.deliveryGroupLabel, { marginTop: SPACING.md, marginBottom: SPACING.sm }]}>
                            Teslimat Saati
                          </Text>
                          <View style={styles.timeSlotsRow}>
                            {TIME_SLOTS.map((slot) => {
                              const isActive = selectedTimeSlot?.id === slot.id;
                              const isDisabled = slot.disabled;
                              return (
                                <TouchableOpacity
                                  key={slot.id}
                                  activeOpacity={0.7}
                                  disabled={isDisabled}
                                  onPress={() => dispatchDelivery({ type: 'SET_TIME_SLOT', payload: slot })}
                                  style={[
                                    styles.timeSlotCard,
                                    isActive && styles.timeSlotCardActive,
                                    isDisabled && styles.timeSlotCardDisabled,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.timeSlotLabel,
                                      isActive && styles.timeSlotLabelActive,
                                      isDisabled && styles.timeSlotLabelDisabled,
                                    ]}
                                  >
                                    {slot.label}
                                  </Text>
                                  {isDisabled && (
                                    <Text style={styles.timeSlotFullText}>Dolu</Text>
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                    </View>
                  </>
                ) : null}
                </Animated.View>
              </>
            ) : null}

            {rulesFetchFailed ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{RULES_FETCH_ERROR_MESSAGE}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={handleRetryRules} disabled={rulesLoading}>
                  {rulesLoading ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.retryBtnText}>Tekrar Dene</Text>}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* ── Adres (eve teslim) ── */}
          {deliveryMethod === 'home_delivery' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Teslimat Adresi</Text>
              {loadingAddresses ? (
                <ActivityIndicator color={COLORS.brand.green} style={{ marginVertical: SPACING.sm }} />
              ) : null}
              {addressError ? <Text style={styles.errorText}>{addressError}</Text> : null}
              {!loadingAddresses && addresses.length === 0 ? (
                <View style={{ gap: SPACING.sm }}>
                  <Text style={styles.noteText}>Kayıtlı adresiniz yok.</Text>
                  <TouchableOpacity
                    style={styles.outlineBtn}
                    onPress={() => navigation.navigate('Addresses', { selectMode: true })}
                  >
                    <Text style={styles.outlineBtnText}>+ Adres Ekle</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {addresses.map((address) => {
                const active = selectedAddressId === address.id;
                return (
                  <Pressable
                    key={address.id}
                    onPress={() => {
                      dispatchAddr({ type: 'SET_SELECTED_ADDRESS_ID', payload: address.id });
                      setSelectedAddress(address);
                    }}
                    style={[styles.addressRow, active && styles.addressRowActive]}
                  >
                    <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                      {active ? <View style={styles.radioInner} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addressTitle}>{address.title || 'Adres'}</Text>
                      <Text style={styles.addressText} numberOfLines={2}>{address.full_address}</Text>
                      <Text style={styles.addressMeta}>{address.district} • {address.contact_name}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {mapCoords ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    const latLng = `${mapCoords.lat},${mapCoords.lng}`;
                    const label = 'Teslimat Adresi';
                    const url = Platform.select({
                      ios: `maps:0,0?q=${label}@${latLng}`,
                      android: `geo:0,0?q=${latLng}(${label})`,
                    });
                    Linking.openURL(url || `https://www.google.com/maps/search/?api=1&query=${latLng}`);
                  }}
                  style={styles.mapPreview}
                >
                  <Image
                    source={{ uri: `https://maps.googleapis.com/maps/api/staticmap?center=${mapCoords.lat},${mapCoords.lng}&zoom=16&size=800x300&scale=2&markers=color:0xE8431A%7C${mapCoords.lat},${mapCoords.lng}&style=feature:poi%7Cvisibility:off&key=${getGoogleMapsKey()}` }}
                    style={styles.mapPreviewImg}
                    resizeMode="cover"
                  />
                  <View style={styles.mapPreviewBadge}>
                    <MapPin size={11} color="#000" />
                    <Text style={styles.mapPreviewBadgeText}>Haritada Aç</Text>
                  </View>
                </TouchableOpacity>
              ) : geocoding ? (
                <View style={[styles.mapPreview, { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }]}>
                  <ActivityIndicator color={COLORS.text.secondary} size="small" />
                </View>
              ) : null}
              {addresses.length > 0 ? (
                <TouchableOpacity
                  style={[styles.outlineBtn, { marginTop: SPACING.xs }]}
                  onPress={() => navigation.navigate('Addresses', { selectMode: true })}
                >
                  <Text style={styles.outlineBtnText}>Adresleri Yönet</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* ── Gel-Al şube ── */}
          {deliveryMethod === 'pickup' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Şube Bilgisi</Text>
              {branchesLoading ? <ActivityIndicator color={COLORS.brand.green} style={{ marginVertical: SPACING.sm }} /> : null}
              {branchesError ? <Text style={styles.errorText}>{branchesError}</Text> : null}
              {!branchesLoading && !branchesError && branches.length === 0 ? (
                <Text style={styles.noteText}>Şube bilgisi bulunamadı.</Text>
              ) : null}
              {branches.map((branch) => (
                <View key={branch.id} style={{ gap: SPACING.sm }}>
                  <Text style={styles.addressTitle}>{branch.name}</Text>
                  <Text style={styles.addressText}>{branch.address}</Text>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(BRANCH_ADDRESS)}`)}
                    style={styles.mapPreview}
                  >
                    <Image
                      source={{ uri: `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(BRANCH_ADDRESS)}&zoom=16&size=800x300&scale=2&markers=color:0xE8431A%7C${encodeURIComponent(BRANCH_ADDRESS)}&style=feature:poi%7Cvisibility:off&key=${getGoogleMapsKey()}` }}
                      style={styles.mapPreviewImg}
                      resizeMode="cover"
                    />
                    <View style={styles.mapPreviewBadge}>
                      <MapPin size={11} color="#000" />
                      <Text style={styles.mapPreviewBadgeText}>Haritada Aç</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={[styles.noteText, { marginTop: SPACING.xs }]}>
                Siparişiniz hazır olduğunda şubemizden teslim alabilirsiniz.
              </Text>
            </View>
          ) : null}

          {/* ── Sipariş Notu ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sipariş Notu</Text>
            <TextInput
              style={styles.noteInput}
              value={orderNote}
              onChangeText={(v) => v.length <= 300 && dispatchOrder({ type: 'SET_ORDER_NOTE', payload: v })}
              placeholder="Notunuzu yazın..."
              placeholderTextColor={COLORS.text.tertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.noteCounter}>{orderNote.length}/300</Text>
          </View>

          {/* ── Sepet Özeti ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sepet Özeti</Text>
            {items.map((item) => (
              <View key={item.lineKey} style={styles.summaryRow}>
                <Text style={styles.summaryLabel} numberOfLines={1}>{item.name} ×{item.quantity}</Text>
                <Text style={styles.summaryValue}>{toCurrency(item.unitPrice * item.quantity)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ara Toplam</Text>
              <Text style={styles.summaryValue}>{toCurrency(subtotal)}</Text>
            </View>
            {deliveryMethod === 'home_delivery' ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Teslimat</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    deliveryFee === 0 ? { color: '#16a34a' } : null,
                  ]}
                >
                  {deliveryFee === 0 ? 'Ücretsiz' : toCurrency(deliveryFee)}
                </Text>
              </View>
            ) : null}
            {deliveryMethod === 'home_delivery' &&
            deliveryFee > 0 &&
            freeShippingAbove > 0 &&
            subtotal < freeShippingAbove ? (
              <Text style={[styles.summaryLabel, { fontSize: 12, color: '#64748b' }]}>
                Ücretsiz teslimat için {toCurrency(Math.max(0, freeShippingAbove - subtotal))} daha ekleyin.
              </Text>
            ) : null}
            {discountAmount > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>İndirim</Text>
                <Text style={[styles.summaryValue, { color: '#16a34a' }]}>-{toCurrency(discountAmount)}</Text>
              </View>
            ) : null}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Toplam</Text>
              <Text style={styles.summaryValueBold}>{toCurrency(totalAmount)}</Text>
            </View>
            {checkoutBlockMessage ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>{checkoutBlockMessage}</Text>
                {(checkoutBlockMessage.includes('teslimat yok') || checkoutBlockMessage.includes('teslimat kuralı tanımlı değil')) && (
                  <TouchableOpacity onPress={() => setShowZonesSheet(true)} style={{ marginTop: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F97316' }}>Teslimat bölgelerini görüntüle →</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>

          {/* ── Bekleyen ödeme ── */}
          {isPaymentFeatureEnabled && pendingPaymentOrder ? (
            <View style={[styles.card, { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' }]}>
              <Text style={styles.cardTitle}>Bekleyen Sipariş</Text>
              <Text style={styles.addressTitle}>{pendingPaymentOrder.orderCode}</Text>
              <Text style={styles.addressText}>Tutar: {toCurrency(pendingPaymentOrder.totalAmount)}</Text>
            </View>
          ) : null}

          {/* ── Sözleşme ── */}
          <View style={styles.contractRow}>
            <Pressable onPress={() => dispatchOrder({ type: 'SET_CONTRACTS_ACCEPTED', payload: !contractsAccepted })} style={styles.checkboxWrap}>
              <View style={[styles.checkbox, contractsAccepted && styles.checkboxActive]}>
                {contractsAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
            </Pressable>
            <Text style={styles.contractText}>
              <Text
                style={styles.contractLink}
                onPress={() => navigation.navigate('ProfileContracts', { slug: 'terms' })}
              >Kullanım Koşulları</Text>
              {' '}ile{' '}
              <Text
                style={styles.contractLink}
                onPress={() => navigation.navigate('ProfileContracts', { slug: 'distance-sales' })}
              >Mesafeli Satış Sözleşmesi</Text>
              {"'ni"} okudum ve onaylıyorum.
            </Text>
          </View>

          {/* ── Ödeme logosu ── */}
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Image source={require('../../assets/checkout-tosla.png')} style={{ width: 240, height: 52, opacity: 1 }} resizeMode="contain" />
          </View>

          {screenError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{screenError}</Text>
            </View>
          ) : null}
          </>) : (<>
            {/* ── Kart Görseli ── */}
            <View style={styles.cardVisual}>
              <View style={styles.cardDeco1} />
              <View style={styles.cardDeco2} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 }}>
                <CreditCard size={28} color="rgba(255,255,255,0.7)" />
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#d4183d', opacity: 0.9 }} />
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#ff8c00', opacity: 0.9, marginLeft: -10 }} />
                </View>
              </View>
              <Text style={styles.cardNumber}>{cardNumber || '•••• •••• •••• ••••'}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={styles.cardLabel}>Kart Sahibi</Text>
                  <Text style={styles.cardValue}>{cardHolder.toUpperCase() || 'AD SOYAD'}</Text>
                </View>
                <View>
                  <Text style={styles.cardLabel}>Son Kullanım</Text>
                  <Text style={styles.cardValue}>{expiry || 'AA/YY'}</Text>
                </View>
              </View>
            </View>

            {/* ── Kart Formu ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Kart Bilgileri</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Kart Numarası</Text>
                <TextInput style={styles.cardInput} placeholder="0000 0000 0000 0000" value={cardNumber} onChangeText={(v) => dispatchPay({ type: 'SET_CARD_NUMBER', payload: formatCardNumber(v) })} keyboardType="number-pad" maxLength={19} returnKeyType="next" placeholderTextColor={COLORS.text.tertiary} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Kart Üzerindeki İsim</Text>
                <TextInput style={styles.cardInput} placeholder="AD SOYAD" value={cardHolder} onChangeText={(v) => dispatchPay({ type: 'SET_CARD_HOLDER', payload: v.toUpperCase() })} autoCapitalize="characters" placeholderTextColor={COLORS.text.tertiary} />
              </View>
              <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Son Kullanım</Text>
                  <TextInput style={styles.cardInput} placeholder="AA/YY" value={expiry} onChangeText={(v) => dispatchPay({ type: 'SET_EXPIRY', payload: formatExpiry(v) })} keyboardType="number-pad" maxLength={5} returnKeyType="next" placeholderTextColor={COLORS.text.tertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>CVV</Text>
                  <TextInput style={styles.cardInput} placeholder="•••" value={cvv} onChangeText={(v) => dispatchPay({ type: 'SET_CVV', payload: v.replace(/\D/g, '').slice(0, 3) })} keyboardType="number-pad" maxLength={3} secureTextEntry returnKeyType="done" placeholderTextColor={COLORS.text.tertiary} />
                </View>
              </View>
            </View>

            {/* ── Kayıtlı Kart ── */}
            <TouchableOpacity style={styles.savedCardsBtn} onPress={() => navigation.navigate('ProfileSavedCards')} activeOpacity={0.8}>
              <View style={{ width: 36, height: 36, borderRadius: RADIUS.xs, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={16} color="#000000" />
              </View>
              <Text style={{ flex: 1, fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.primary }}>Kayıtlı Kart Kullan</Text>
              <CaretRight size={16} color={COLORS.text.tertiary} />
            </TouchableOpacity>

            {/* ── Güvenli ödeme ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, marginTop: SPACING.xs }}>
              <Lock size={13} color={COLORS.text.tertiary} />
              <Text style={{ fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary }}>256-bit SSL Şifrelemeli Güvenli Ödeme</Text>
            </View>

            {/* ── Kart logoları ── */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, marginTop: SPACING.md }}>
              <View style={{ backgroundColor: COLORS.white, borderRadius: RADIUS.xs, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderWidth: 1, borderColor: COLORS.border.medium }}>
                <Text style={{ fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1a1f71' }}>VISA</Text>
              </View>
              <View style={{ backgroundColor: COLORS.white, borderRadius: RADIUS.xs, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderWidth: 1, borderColor: COLORS.border.medium, flexDirection: 'row' }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#d4183d' }} />
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#ff8c00', marginLeft: -8, opacity: 0.9 }} />
              </View>
<View style={{ backgroundColor: COLORS.white, borderRadius: RADIUS.xs, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderWidth: 1, borderColor: COLORS.border.medium }}>
                <Text style={{ fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary }}>TROY</Text>
              </View>
            </View>

            {/* ── Ödeme logosu ── */}
            <View style={{ alignItems: 'center', paddingVertical: SPACING.sm }}>
              <Image source={require('../../assets/checkout-tosla.png')} style={{ width: 240, height: 52, opacity: 1 }} resizeMode="contain" />
            </View>

            {payError ? <Text style={[styles.errorText, { textAlign: 'center', marginTop: SPACING.sm }]}>{payError}</Text> : null}
          </>)}

        </ScrollView>

        {/* ── Footer ── */}
        <View style={{ backgroundColor: COLORS.white }}>
        <View style={[styles.footer, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
          {step === 'summary' ? (
            <TouchableOpacity
              style={[styles.orderBtn, isCheckoutDisabled && styles.orderBtnDisabled]}
              onPress={handleCreateOrder}
              disabled={isCheckoutDisabled}
              activeOpacity={0.85}
            >
              {placingOrder ? (
                <ActivityIndicator color={COLORS.brand.green} />
              ) : (
                <Text style={[styles.orderBtnText, isCheckoutDisabled && styles.orderBtnTextDisabled]}>
                  {actionButtonLabel}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.orderBtn, payLoading && styles.orderBtnDisabled]}
              onPress={handlePay}
              disabled={payLoading}
              activeOpacity={0.85}
            >
              {payLoading ? (
                <ActivityIndicator color={COLORS.brand.green} />
              ) : (
                <Text style={styles.orderBtnText}>
                  Ödemeyi Tamamla • {toCurrency(totalAmount)}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        </View>

      </KeyboardAvoidingView>

      {/* ── 3D Secure Modal ── */}
      <Modal visible={!!webViewHtml} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => dispatchPay({ type: 'SET_WEB_VIEW_HTML', payload: null })}>
        <View style={{ flex: 1, backgroundColor: '#F8F9FA', paddingTop: Math.max(insets.top, 44) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, backgroundColor: '#F8F9FA', minHeight: 52, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary, marginRight: SPACING.lg }}>3D Secure Doğrulama</Text>
            <TouchableOpacity onPress={() => dispatchPay({ type: 'SET_WEB_VIEW_HTML', payload: null })} style={{ height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 16, color: COLORS.text.primary, fontWeight: '600', fontFamily: 'PlusJakartaSans_600SemiBold' }}>✕</Text>
              <Text style={{ fontSize: 16, color: COLORS.text.primary, fontWeight: '600', fontFamily: 'PlusJakartaSans_600SemiBold', marginLeft: 4 }}>Kapat</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
          <WebView
            source={{ html: webViewHtml ?? '' }}
            style={{ flex: 1 }}
            onNavigationStateChange={(state) => {
              if ((state.url?.includes('tosla-callback') || state.url?.includes('payment-success') || state.url?.includes('kcal://')) && state.loading === false) {
                setTimeout(async () => {
                  const orderId = retryPaymentOrderId || pendingPaymentOrderIdFromRoute;
                  dispatchPay({ type: 'SET_WEB_VIEW_HTML', payload: null });

                  // Supabase'den ödeme durumunu kontrol et
                  try {
                    const supabase = getSupabaseClient();
                    const { data: orderData } = await supabase
                      .from('orders')
                      .select('payment_status, order_code')
                      .eq('id', orderId)
                      .maybeSingle();

                    if (orderData?.payment_status === 'paid') {
                      haptic.success();
                      const { items: cartItems } = useCartStore.getState();
                      addToPantry(cartItems.map((item) => ({
                        productId: String(item.productId),
                        name: item.name,
                        calories: item.calories ?? 0,
                        protein: item.protein ?? 0,
                        carbs: item.carbs ?? 0,
                        fat: item.fats ?? 0,
                        quantity: item.quantity,
                        imageUrl: item.img ?? undefined,
                      })));
                      clearCart();
                      navigation.replace('OrderSuccess', {
                        orderCode: orderData.order_code ?? pendingPaymentOrder?.orderCode ?? orderId,
                        orderId,
                        noticeMessage: undefined,
                      });
                    } else {
                      haptic.error();
                      dispatchPay({ type: 'SET_PAY_ERROR', payload: 'Ödeme tamamlanamadı. Lütfen tekrar deneyin.' });
                      dispatchPay({ type: 'SET_STEP', payload: 'payment' });
                    }
                  } catch {
                    haptic.error();
                    dispatchPay({ type: 'SET_PAY_ERROR', payload: 'Ödeme durumu kontrol edilemedi. Lütfen tekrar deneyin.' });
                    dispatchPay({ type: 'SET_STEP', payload: 'payment' });
                  }
                }, 2000);
              }
            }}
          />
          </View>
        </View>
      </Modal>
      <DeliveryZonesSheet visible={showZonesSheet} onClose={() => setShowZonesSheet(false)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Layout
  header: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  scrollView: { flex: 1 },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    marginBottom: 2,
  },

  // Address
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border.medium,
    backgroundColor: COLORS.background,
  },
  addressRowActive: {
    borderColor: '#000000',
    backgroundColor: COLORS.white,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.xs,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioOuterActive: {
    borderColor: '#000000',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.xs,
    backgroundColor: '#000000',
  },
  addressTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  addressText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#555555',
    lineHeight: 18,
    marginTop: 2,
  },
  addressMeta: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },

  // Buttons
  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  outlineBtn: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.primary,
  },
  mapBtn: {
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtnText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    color: '#555555',
    marginRight: SPACING.md,
  },
  summaryValue: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.primary,
  },
  summaryLabelBold: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  summaryValueBold: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: SPACING.xs,
  },

  // Coupon
  couponRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  // Contract
  contractRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.xs,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    flexShrink: 0,
  },
  checkboxActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  checkmark: {
    color: COLORS.brand.green,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  checkboxWrap: { paddingRight: 8 },
  contractLink: { color: COLORS.text.primary, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold', textDecorationLine: 'underline' },
  contractText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    color: '#555555',
    lineHeight: 19,
  },

  // Footer
  footer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    zIndex: 10,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  orderBtn: {
    height: 58,
    borderRadius: RADIUS.pill,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBtnDisabled: {
    backgroundColor: '#d0d0d0',
  },
  orderBtnText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.brand.green,
    letterSpacing: 0.2,
  },
  orderBtnTextDisabled: {
    color: '#9ca3af',
  },

  // Feedback
  errorText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#dc2626',
    marginTop: 2,
  },
  successText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#16a34a',
    marginTop: 2,
  },
  noteText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.text.secondary,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorBoxText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#dc2626',
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  retryBtn: {
    height: 40,
    borderRadius: RADIUS.xs,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: COLORS.brand.green,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  warningBox: {
    backgroundColor: '#fffbeb',
    borderRadius: RADIUS.xs,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginTop: SPACING.xs,
  },
  warningText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#92400e',
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },

  // Order note
  noteInput: {
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.text.primary,
    backgroundColor: COLORS.background,
    minHeight: 80,
  },
  noteCounter: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#aaaaaa',
    textAlign: 'right',
  },

  // Payment step
  cardVisual: {
    height: 180,
    borderRadius: RADIUS.lg,
    backgroundColor: '#000000',
    padding: SPACING['2xl'],
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  cardDeco1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(198,240,79,0.1)',
  },
  cardDeco2: {
    position: 'absolute',
    bottom: -40,
    right: 60,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(198,240,79,0.06)',
  },
  cardNumber: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.white,
    marginBottom: SPACING.lg,
    letterSpacing: 3,
  },
  cardLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  cardValue: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.white,
  },
  inputGroup: {
    gap: SPACING.xs,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.secondary,
  },
  cardInput: {
    height: 52,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.text.primary,
  },
  savedCardsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginTop: SPACING.xs,
  },
  deliveryRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  deliverySeparator: {
    height: 0,
  },
  deliveryGroupLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.xs,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  chipDisabled: {
    opacity: 0.5,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  chipActive: {
    backgroundColor: COLORS.brand.green,
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.secondary,
  },
  chipTextActive: {
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  // Scheduled date picker
  dateFlatListContent: {
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  dateCard: {
    width: 56,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dateCardActive: {
    backgroundColor: COLORS.brand.green,
  },
  dateDayName: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.secondary,
    letterSpacing: 0.2,
  },
  dateDayNum: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
    lineHeight: 24,
  },
  dateMonth: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.secondary,
  },
  dateLabelActive: {
    color: COLORS.text.primary,
  },

  // Time slot picker
  timeSlotsWrap: {
    marginTop: SPACING.xs,
  },
  timeSlotsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  timeSlotCard: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.xs,
    borderWidth: 1.5,
    borderColor: COLORS.border.medium,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotCardActive: {
    borderColor: COLORS.brand.green,
    backgroundColor: 'rgba(198,240,79,0.12)',
  },
  timeSlotLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.secondary,
  },
  timeSlotLabelActive: {
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  timeSlotCardDisabled: {
    opacity: 0.5,
    backgroundColor: '#e8e8e8',
  },
  timeSlotLabelDisabled: {
    color: '#999999',
  },
  timeSlotFullText: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#C1282E',
  },

  mapPreview: {
    height: 120,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    marginTop: SPACING.xs,
  },
  mapPreviewBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  mapPreviewBadgeText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  mapPreviewImg: {
    width: '100%',
    height: '100%',
  },
});
