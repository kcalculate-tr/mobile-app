// eatkcal v2 (G13-S2 md.4) — Sipariş özeti denetleyicisi.
//
// YENİ SİPARİŞ/ÖDEME MANTIĞI YOK. Bu hook bugünkü
// `src/modules/eatkcal/screens/CheckoutScreen.tsx` (KİMSE — değiştirilmedi)
// ekranının veri yüklemelerini ve `handleCreateOrder`'ının Paynkolay yolunu
// AYNI lib fonksiyonlarıyla, AYNI sırayla çağırır:
//   createOrderDraftForPayment · updateOrderPaymentStatus · cancelStaleOrderDraft ·
//   computeCartSignature/buildCartSignatureLines · resolveAddressId ·
//   fetchPendingPaymentOrderById · getPaymentConfigStatus · mapPaymentErrorToMessage ·
//   buildPaymentNavParams/resolveSelectedCardId · getCardsFeatureStatus/syncSavedCards ·
//   resolveMinOrder/resolveShippingFee/resolveFreeShippingAbove · fetchGlobalDeliverySettings ·
//   fetchBusinessHours/isShopOpenNow/getAvailableScheduledDates/toLocalDateStr ·
//   fetchBranches · fetchBranchAvailability/findClosedCartItemNames ·
//   fetchMacroProfile/fetchMacroSettings/macroEarnedForOrder ·
//   free-order-complete Edge Function (0 TL) · PaymentScreen (3D dahil, aynen).
// Satır satır kaynak eşlemesi: `model/checkoutModel.ts` yorumları.
//
// v2 YALNIZ Paynkolay yolunu taşır. `PAYMENT_PROVIDER !== 'paynkolay'` (eski
// Tosla satır içi kart formu) ya da ödeme bekleyen sipariş rotası
// (`pendingPaymentOrderId`) → bugünkü Checkout ekranına devredilir (ekran tarafı).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { useCartStore } from '../../../../store/cartStore';
import { useAddressStore } from '../../../../store/addressStore';
import {
  cancelStaleOrderDraft,
  createOrderDraftForPayment,
  fetchPendingPaymentOrderById,
  resolveAddressId,
  updateOrderPaymentStatus,
  type PendingPaymentOrder,
} from '../../../../lib/orders';
import { getPaymentConfigStatus, mapPaymentErrorToMessage } from '../../../../lib/payment';
import { PAYMENT_PROVIDER } from '../../../../config/payment';
import { mapSupabaseErrorToUserMessage } from '../../../../lib/supabaseErrors';
import { fetchGlobalDeliverySettings, type DeliveryGlobals } from '../../../../lib/delivery';
import {
  fetchBusinessHours,
  getAvailableScheduledDates,
  isShopOpenNow,
  toLocalDateStr,
  type BusinessHours,
} from '../../../../lib/businessHours';
import { fetchBranches, type Branch } from '../../../../lib/branches';
import {
  EMPTY_BRANCH_AVAILABILITY,
  fetchBranchAvailability,
  findClosedCartItemNames,
  type BranchAvailability,
} from '../../../../lib/branchAvailability';
import { getCardsFeatureStatus, syncSavedCards, type SavedCard } from '../../../../lib/cards';
import { resolveSelectedCardId } from '../../../../lib/checkoutPayment';
import {
  DEFAULT_MACRO_SETTINGS,
  fetchMacroProfile,
  fetchMacroSettings,
  macroEarnedForOrder,
  type MacroProfile,
  type MacroSettings,
} from '../../../../lib/macros';
import { normalizeAddress } from '../../../../lib/addresses';
import { fetchSettingsMinCart, fetchZoneRuleFor } from './data';
import { logEvent, track } from '../../../../lib/analytics';
import { tl } from '../../../../lib/money';
import { haptic } from '../../../../core/design';
import type { Address, DeliveryRuleStatus } from '../../../../types';
import {
  activeZoneRowOf,
  buildDraftInput,
  canReuseDraft,
  cartSignatureFor,
  closedItemsMessage,
  computeCheckoutTotals,
  fallbackOrderCodeFromId,
  orderDeliveryMethodOf,
  paymentRouteParams,
  payStateAllowsRetry,
  payStateFromOrder,
  pickupAddressOf,
  resolveCheckoutBlock,
  resolveFreeOrderErrorMessage,
  scheduledFieldsOf,
  type EkDeliveryMethod,
  type EkPayState,
  type EkPaymentRouteParams,
  type EkTimeSlot,
} from '../model/checkoutModel';

export type EkFieldErrors = {
  ad?: string;
  tel?: string;
  eposta?: string;
  adres?: string;
  zaman?: string;
  sozlesme?: string;
};

export type EkPlaceResult =
  | { kind: 'payment'; params: EkPaymentRouteParams }
  | { kind: 'free_success'; orderCode: string; orderId: string }
  | { kind: 'login' }
  | { kind: 'blocked' };

export function useEkCheckout(opts: { initialAddressId?: string }) {
  const { user } = useAuth();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const appliedCoupon = useCartStore((s) => s.appliedCoupon);
  const getDiscountAmount = useCartStore((s) => s.getDiscountAmount);
  const clearCart = useCartStore((s) => s.clearCart);
  const setSelectedAddress = useAddressStore((s) => s.setSelectedAddress);

  // ── Form / seçim durumu ────────────────────────────────────────────────
  const [deliveryMethod, setDeliveryMethodState] = useState<EkDeliveryMethod>('home_delivery');
  const [deliveryTimeType, setDeliveryTimeType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [timeSlot, setTimeSlot] = useState<EkTimeSlot | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [contractsAccepted, setContractsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<EkFieldErrors>({});
  const [screenError, setScreenError] = useState('');
  const [placing, setPlacing] = useState(false);

  // ── Yüklenen veri ──────────────────────────────────────────────────────
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressError, setAddressError] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [ruleStatus, setRuleStatus] = useState<DeliveryRuleStatus>({ status: 'idle' });
  const [deliveryDays, setDeliveryDays] = useState<number[] | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [settingsMinCart, setSettingsMinCart] = useState(0);
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [globals, setGlobals] = useState<DeliveryGlobals | null>(null);
  const [rulesRefreshKey, setRulesRefreshKey] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [branchAvailability, setBranchAvailability] = useState<BranchAvailability>(EMPTY_BRANCH_AVAILABILITY);
  const [deviceCoords, setDeviceCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [macroProfile, setMacroProfile] = useState<MacroProfile | null>(null);
  const [macroSettings, setMacroSettings] = useState<MacroSettings>(DEFAULT_MACRO_SETTINGS);

  // Kart (Paynkolay kart saklama) — CheckoutScreen.tsx:470-558 iki aşamalı kurgu.
  const [cardsEnabled, setCardsEnabled] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardsState, setCardsState] = useState<'basliyor' | 'yukleniyor' | 'kapali' | 'hazir' | 'liste_hatasi'>('basliyor');
  const cardsInFlight = useRef(false);
  const cardsFinal = useRef(false);

  // Taslak / ödeme sonucu — CheckoutScreen'in retryPaymentOrderId + pendingPaymentOrder'ı.
  const [draftOrderId, setDraftOrderId] = useState('');
  const [draftOrder, setDraftOrder] = useState<PendingPaymentOrder | null>(null);
  const [payState, setPayState] = useState<EkPayState>('idle');
  const awaitingPaymentRef = useRef(false);

  const paymentConfig = getPaymentConfigStatus();
  const isPaymentFeatureEnabled = paymentConfig.isPaymentEnabled;
  const isPaymentConfigured = paymentConfig.isConfigured;
  const isPaynkolay = PAYMENT_PROVIDER === 'paynkolay';

  const setDeliveryMethod = useCallback((m: EkDeliveryMethod) => {
    // deliveryReducer SET_DELIVERY_METHOD (CheckoutScreen.tsx:232-237): Gel-Al → hemen.
    setDeliveryMethodState(m);
    if (m === 'pickup') setDeliveryTimeType('immediate');
  }, []);

  // ── Ayarlar + çalışma saatleri + global teslimat (CheckoutScreen.tsx:1049-1093) ──
  useEffect(() => {
    let mounted = true;
    (async () => {
      setSettingsStatus('loading');
      try {
        const minCart = await fetchSettingsMinCart();
        if (!mounted) return;
        setSettingsMinCart(minCart);
        setSettingsStatus('ready');
        const [bh, g] = await Promise.all([fetchBusinessHours(), fetchGlobalDeliverySettings()]);
        if (!mounted) return;
        setBusinessHours(bh);
        setGlobals(g);
      } catch {
        if (mounted) setSettingsStatus('error');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [rulesRefreshKey]);

  // ── Adresler (CheckoutScreen.tsx:1095-1140) ──────────────────────────────
  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setAddressesLoading(true);
    setAddressError('');
    try {
      const { data, error } = await getSupabaseClient()
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const normalized = (Array.isArray(data) ? data : [])
        .map((row) => normalizeAddress(row as Record<string, unknown>))
        .filter((a) => a.id);
      setAddresses(normalized);
      if (normalized.length > 0) {
        const targetId = opts.initialAddressId;
        const hasTarget = normalized.some((a) => a.id === targetId);
        const def = normalized.find((a) => a.is_default);
        const id = hasTarget && targetId ? targetId : (def?.id ?? normalized[0].id);
        setSelectedAddressId(id);
        const a = normalized.find((x) => x.id === id);
        if (a) setSelectedAddress(a);
      }
    } catch (error: unknown) {
      setAddresses([]);
      setAddressError(mapSupabaseErrorToUserMessage(error, 'Adresler yüklenemedi. Lütfen tekrar deneyin.'));
    } finally {
      setAddressesLoading(false);
    }
  }, [user, opts.initialAddressId, setSelectedAddress]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddressId) || null,
    [addresses, selectedAddressId],
  );

  const selectAddress = useCallback(
    (id: string) => {
      setSelectedAddressId(id);
      const a = addresses.find((x) => x.id === id);
      if (a) setSelectedAddress(a);
      setFieldErrors((e) => (e.adres ? { ...e, adres: undefined } : e));
    },
    [addresses, setSelectedAddress],
  );

  // ── İletişim: adres + profil (CheckoutScreen.tsx:1185-1238) ─────────────
  useEffect(() => {
    if (!selectedAddress) return;
    setCustomerName((v) => v || selectedAddress.contact_name || '');
    setCustomerEmail((v) => v || selectedAddress.contact_email || user?.email || '');
    setCustomerPhone((v) => v || selectedAddress.contact_phone || '');
  }, [selectedAddress, user?.email]);

  useEffect(() => {
    if (!user?.id) return;
    if (user.email) setCustomerEmail(user.email);
    getSupabaseClient()
      .from('profiles')
      .select('full_name, first_name, last_name, phone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const ad =
          String(data.full_name ?? '').trim() ||
          [data.first_name, data.last_name].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ');
        if (ad) setCustomerName(ad);
        if (data.phone) setCustomerPhone(String(data.phone));
      });
  }, [user?.id, user?.email]);

  // ── Cihaz konumu (izin VARSA; istemez) — CheckoutScreen.tsx:665-703 ──────
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getLastKnownPositionAsync();
        if (mounted && pos) setDeviceCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        /* sessiz — yalnız şube önerisi için */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  // ── Bölge kuralı (CheckoutScreen.tsx:1240-1400) ──────────────────────────
  useEffect(() => {
    if (!selectedAddress?.district) {
      setRuleStatus({ status: 'idle' });
      setDeliveryDays(null);
      return;
    }
    let mounted = true;
    (async () => {
      setRuleStatus({ status: 'loading' });
      const res = await fetchZoneRuleFor(selectedAddress, deliveryTimeType);
      if (!mounted) return;
      setRuleStatus(res.status);
      setDeliveryDays(res.deliveryDays);
    })();
    return () => {
      mounted = false;
    };
  }, [selectedAddress?.district, selectedAddress?.neighbourhood, rulesRefreshKey, deliveryTimeType, selectedAddress]);

  // ── Şubeler (Gel-Al) — CheckoutScreen.tsx:1402-1430 ─────────────────────
  useEffect(() => {
    if (deliveryMethod !== 'pickup') return;
    let mounted = true;
    fetchBranches()
      .then((b) => mounted && setBranches(b))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [deliveryMethod]);

  // ── Şube stok durumu — CheckoutScreen.tsx:1481-1513 ─────────────────────
  useEffect(() => {
    let mounted = true;
    if (deliveryMethod !== 'home_delivery' || !selectedAddress?.district) {
      setBranchAvailability(EMPTY_BRANCH_AVAILABILITY);
      return;
    }
    (async () => {
      try {
        const r = await fetchBranchAvailability(getSupabaseClient(), {
          district: selectedAddress.district,
          neighbourhood: selectedAddress.neighbourhood,
          addressId: selectedAddress.id ?? null,
        });
        if (mounted) setBranchAvailability(r);
      } catch {
        if (mounted) setBranchAvailability(EMPTY_BRANCH_AVAILABILITY);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [deliveryMethod, selectedAddress?.id, selectedAddress?.district, selectedAddress?.neighbourhood, rulesRefreshKey]);

  const closedItemNames = useMemo(
    () =>
      findClosedCartItemNames(
        items.map((it) => ({ productId: it.productId, name: it.name })),
        branchAvailability.closedProductIds,
      ),
    [items, branchAvailability.closedProductIds],
  );

  // ── Macro (CheckoutScreen.tsx:603-615, 724-735) ─────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setMacroProfile(null);
      return;
    }
    let mounted = true;
    fetchMacroProfile(user.id)
      .then((p) => mounted && setMacroProfile(p))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [user?.id]);
  useEffect(() => {
    let mounted = true;
    fetchMacroSettings()
      .then((m) => mounted && setMacroSettings(m))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // ── Kartlar (CheckoutScreen.tsx:500-558) ─────────────────────────────────
  const loadCards = useCallback(async () => {
    if (!isPaynkolay || !user?.id) return;
    if (cardsInFlight.current || cardsFinal.current) return;
    cardsInFlight.current = true;
    setCardsState('yukleniyor');
    let acik: boolean;
    try {
      acik = (await getCardsFeatureStatus()).enabled;
    } catch {
      cardsInFlight.current = false;
      setCardsState('liste_hatasi');
      return;
    }
    if (!acik) {
      cardsFinal.current = true;
      cardsInFlight.current = false;
      setCardsState('kapali');
      return;
    }
    setCardsEnabled(true);
    try {
      const cards = (await syncSavedCards()).cards ?? [];
      setSavedCards(cards);
      setSelectedCardId((prev) => resolveSelectedCardId(prev, cards));
      cardsFinal.current = true;
      setCardsState('hazir');
    } catch {
      setCardsState('liste_hatasi');
    } finally {
      cardsInFlight.current = false;
    }
  }, [isPaynkolay, user?.id]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // ── Türetilmiş değerler ──────────────────────────────────────────────────
  const discountAmount = appliedCoupon ? getDiscountAmount(subtotal) : 0;
  const zoneRow = activeZoneRowOf(ruleStatus);
  const totals = computeCheckoutTotals({
    subtotal,
    discountAmount,
    deliveryMethod,
    deliveryTimeType,
    zoneRow,
    globals,
    settingsMinCartAmount: settingsMinCart,
  });
  const kazanilacakMacro = user?.id ? macroEarnedForOrder(totals.totalAmount, macroProfile, macroSettings) : 0;

  const scheduledDates = useMemo(
    () => (businessHours ? getAvailableScheduledDates(businessHours, 21) : []),
    [businessHours],
  );
  const shopOpenNow = businessHours ? isShopOpenNow(businessHours) : true;

  // Dükkan kapalıysa randevuya geç (CheckoutScreen.tsx:569-573).
  useEffect(() => {
    if (businessHours && !isShopOpenNow(businessHours)) setDeliveryTimeType('scheduled');
  }, [businessHours]);

  const rulesFetchFailed = settingsStatus === 'error' || ruleStatus.status === 'error';
  const rulesLoading = settingsStatus === 'loading' || ruleStatus.status === 'loading';

  // Bölge bayrakları (CheckoutScreen.tsx:740-805).
  const allowImmediateByZone =
    deliveryMethod === 'pickup' || !zoneRow ? true : (zoneRow as Record<string, unknown>).allow_immediate !== false;
  const allowScheduledByZone =
    deliveryMethod === 'pickup' || !zoneRow ? true : (zoneRow as Record<string, unknown>).allow_scheduled !== false;
  const canPickImmediate = allowImmediateByZone && shopOpenNow;
  const canPickScheduled = allowScheduledByZone;
  const deliveryRulesSettled =
    !rulesLoading && businessHours !== null && (deliveryMethod === 'pickup' || ruleStatus.status !== 'idle');
  const zoneBlocksDelivery =
    deliveryRulesSettled && deliveryMethod === 'home_delivery' && !!zoneRow && !canPickImmediate && !canPickScheduled;

  useEffect(() => {
    if (deliveryMethod !== 'home_delivery' || !zoneRow) return;
    if (deliveryTimeType === 'immediate' && !allowImmediateByZone && allowScheduledByZone) setDeliveryTimeType('scheduled');
    else if (deliveryTimeType === 'scheduled' && !allowScheduledByZone && allowImmediateByZone) setDeliveryTimeType('immediate');
  }, [deliveryMethod, deliveryTimeType, zoneRow, allowImmediateByZone, allowScheduledByZone]);

  const addressInDeliveryZone = ruleStatus.status === 'ok' && ruleStatus.data.isActive;
  const isDeliverable =
    deliveryMethod === 'pickup' ? true : !!selectedAddress && addressInDeliveryZone && !zoneBlocksDelivery;

  const checkoutBlockMessage = resolveCheckoutBlock({
    deliveryMethod,
    deliveryTimeType,
    rulesFetchFailed,
    rulesLoading,
    hasAddress: !!selectedAddress,
    ruleStatus,
    hasScheduledDate: !!scheduledDate,
    hasTimeSlot: !!timeSlot,
    effectiveMinAmount: totals.effectiveMinAmount,
    remainingToMinAmount: totals.remainingToMinAmount,
    formatMoney: tl,
  });

  const retryAllowed = payStateAllowsRetry(payState, draftOrder);

  // CheckoutScreen.tsx:890-940 (isCheckoutDisabled) — ödeme özelliği açık + yeni taslak dalı.
  const isCheckoutDisabled =
    placing ||
    !isPaymentConfigured ||
    items.length === 0 ||
    (deliveryMethod === 'home_delivery' && (rulesLoading || rulesFetchFailed)) ||
    Boolean(checkoutBlockMessage) ||
    !isDeliverable ||
    !retryAllowed;

  const clearFieldError = useCallback((k: keyof EkFieldErrors) => {
    setFieldErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  }, []);

  useEffect(() => {
    if (contractsAccepted) clearFieldError('sozlesme');
  }, [contractsAccepted, clearFieldError]);
  useEffect(() => {
    if (scheduledDate && timeSlot) clearFieldError('zaman');
  }, [scheduledDate, timeSlot, clearFieldError]);

  // ── Siparişi ver — CheckoutScreen.tsx:1524-1898 handleCreateOrder (Paynkolay yolu) ──
  const placeOrder = useCallback(async (): Promise<EkPlaceResult> => {
    setScreenError('');
    if (!user) return { kind: 'login' };

    if (closedItemNames.length > 0) {
      setScreenError(closedItemsMessage(closedItemNames));
      haptic('warning');
      return { kind: 'blocked' };
    }
    if (isPaymentFeatureEnabled && !isPaymentConfigured) {
      setScreenError('Ödeme yapılandırılmadı.');
      return { kind: 'blocked' };
    }
    if (!retryAllowed) return { kind: 'blocked' };

    // Form doğrulama — alanlar tek tek (CheckoutScreen.tsx:1566-1633).
    if (deliveryMethod === 'home_delivery' && !selectedAddress) {
      setFieldErrors({
        adres: addresses.length === 0 ? 'Devam etmek için bir teslimat adresi ekleyin.' : 'Teslimat adresi seçin.',
      });
      return { kind: 'blocked' };
    }
    if (!customerName.trim()) {
      setFieldErrors({ ad: 'Ad soyad girin.' });
      return { kind: 'blocked' };
    }
    if (!customerPhone.trim()) {
      setFieldErrors({ tel: 'Telefon numarası girin.' });
      return { kind: 'blocked' };
    }
    if (!customerEmail.trim()) {
      setFieldErrors({ eposta: 'E-posta adresi girin.' });
      return { kind: 'blocked' };
    }
    setFieldErrors({});

    // Profil iletişim güncellemesi — best-effort, siparişi bloklamaz (CheckoutScreen.tsx:1593-1611).
    {
      const trimmedName = customerName.trim();
      const [firstName, ...restName] = trimmedName.split(/\s+/).filter(Boolean);
      getSupabaseClient()
        .from('profiles')
        .update({
          full_name: trimmedName,
          first_name: firstName || null,
          last_name: restName.join(' ') || null,
          phone: customerPhone.trim(),
        })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.error('[EkCheckout] profil iletişim güncellemesi başarısız:', error.message);
        });
    }

    if (!contractsAccepted) {
      setFieldErrors({ sozlesme: 'Devam etmek için sözleşmeleri onaylayın.' });
      return { kind: 'blocked' };
    }
    if (checkoutBlockMessage) {
      setScreenError(checkoutBlockMessage);
      return { kind: 'blocked' };
    }
    if (deliveryTimeType === 'scheduled' && (!scheduledDate || !timeSlot)) {
      setFieldErrors({ zaman: !scheduledDate ? 'Teslimat tarihi seçin.' : 'Teslimat saati seçin.' });
      return { kind: 'blocked' };
    }

    setPlacing(true);
    setPayState('wait');

    if (!draftOrderId) {
      const numItems = items.reduce((sum, item) => sum + item.quantity, 0);
      logEvent.initiateCheckout(totals.totalAmount, numItems);
      track('begin_checkout', {
        price: totals.totalAmount,
        num_items: numItems,
        coupon_id: appliedCoupon?.campaignId ?? undefined,
      });
    }

    let paymentOrderId = draftOrderId;
    let paymentOrderCode = draftOrder?.orderCode || (paymentOrderId ? fallbackOrderCodeFromId(paymentOrderId) : '');
    let paymentOrderAmount = draftOrder?.totalAmount ?? totals.totalAmount;

    try {
      const supabase = getSupabaseClient();
      const scheduled = scheduledFieldsOf(
        deliveryTimeType,
        deliveryTimeType === 'scheduled' && scheduledDate ? toLocalDateStr(scheduledDate) : null,
        timeSlot,
      );
      const pickupBranch = branches.find((b) => b.id === selectedBranchId) ?? null;
      const effectiveAddress =
        deliveryMethod === 'pickup'
          ? pickupAddressOf({ name: customerName, phone: customerPhone, email: customerEmail }, pickupBranch)
          : selectedAddress!;
      const orderDeliveryMethod = orderDeliveryMethodOf(deliveryMethod);

      // Mükerrer koruma: mevcut taslak + imza (CheckoutScreen.tsx:1700-1717).
      if (paymentOrderId && draftOrder) {
        const currentSignature = cartSignatureFor(items, {
          couponCode: appliedCoupon?.code ?? null,
          addressId: resolveAddressId(effectiveAddress, orderDeliveryMethod),
          deliveryMethod: orderDeliveryMethod,
          deliveryType: scheduled.delivery_type,
          scheduledDate: scheduled.scheduled_date,
          scheduledTime: scheduled.scheduled_time,
        });
        if (!canReuseDraft(draftOrder.cartSignature, currentSignature)) {
          await cancelStaleOrderDraft({ supabase, orderId: paymentOrderId, userId: user.id });
          paymentOrderId = '';
          paymentOrderCode = '';
          paymentOrderAmount = totals.totalAmount;
          setDraftOrderId('');
          setDraftOrder(null);
        }
      }

      if (!isPaymentFeatureEnabled) {
        // GÜVENLİK (CheckoutScreen.tsx:1719-1740): ödeme kapalıyken sipariş YARATILMAZ.
        haptic('warning');
        setScreenError(
          'Ödeme sistemi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin veya destek ile iletişime geçin.',
        );
        setPayState('idle');
        return { kind: 'blocked' };
      }

      if (!paymentOrderId) {
        await useCartStore.getState().refreshMacros();
        const draftResult = await createOrderDraftForPayment({
          supabase,
          ...buildDraftInput({
            userId: user.id,
            address: effectiveAddress,
            cartItems: useCartStore.getState().items,
            customerName,
            customerEmail,
            customerPhone,
            totals,
            coupon: appliedCoupon,
            deliveryMethod,
            orderNote,
            scheduled,
            cardsEnabled,
            selectedCardId,
          }),
        });
        paymentOrderId = draftResult.orderId;
        paymentOrderCode = draftResult.orderCode;
        paymentOrderAmount = draftResult.totalAmount;
        setDraftOrderId(draftResult.orderId);
        setDraftOrder({
          id: draftResult.orderId,
          orderCode: draftResult.orderCode,
          totalAmount: draftResult.totalAmount,
          status: 'pending_payment',
          paymentStatus: 'pending',
          updatedAt: new Date().toISOString(),
          cartSignature: draftResult.cartSignature,
        });
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

      // 0 TL (CheckoutScreen.tsx:1801-1828).
      if (paymentOrderId && (paymentOrderAmount ?? totals.totalAmount) <= 0) {
        const { data: freeResult, error: freeError } = await supabase.functions.invoke('free-order-complete', {
          body: { orderId: paymentOrderId },
        });
        if (!freeError && freeResult?.ok) {
          haptic('success');
          clearCart();
          setPayState('idle');
          return { kind: 'free_success', orderCode: paymentOrderCode, orderId: paymentOrderId };
        }
        haptic('warning');
        setScreenError(resolveFreeOrderErrorMessage(freeResult?.reason ?? freeError?.message));
        setPayState('fail');
        return { kind: 'blocked' };
      }

      // Paynkolay (CheckoutScreen.tsx:1830-1841) — 3D dahil ödeme ekranı AYNEN.
      awaitingPaymentRef.current = true;
      return {
        kind: 'payment',
        params: paymentRouteParams({
          orderId: paymentOrderId,
          amount: paymentOrderAmount ?? totals.totalAmount,
          orderCode: paymentOrderCode,
          cardsEnabled,
          selectedCardId,
        }),
      };
    } catch (error: unknown) {
      // CheckoutScreen.tsx:1846-1892.
      const paymentMessage = mapPaymentErrorToMessage(error);
      haptic('warning');
      setScreenError(paymentMessage);
      setPayState('fail');
      if (paymentOrderId) {
        setDraftOrderId(paymentOrderId);
        setDraftOrder((prev) => ({
          id: paymentOrderId,
          orderCode: prev?.orderCode || paymentOrderCode || fallbackOrderCodeFromId(paymentOrderId),
          totalAmount: prev?.totalAmount || paymentOrderAmount,
          status: 'payment_failed',
          paymentStatus: 'failed',
          updatedAt: new Date().toISOString(),
          // UPDATE_PENDING_PAYMENT_ORDER (CheckoutScreen.tsx:1859) imzayı korur.
          cartSignature: prev?.cartSignature ?? '',
        }));
        try {
          await updateOrderPaymentStatus({
            supabase: getSupabaseClient(),
            orderId: paymentOrderId,
            userId: user.id,
            status: 'payment_failed',
            paymentStatus: 'failed',
            paymentErrorMessage: paymentMessage,
          });
        } catch {
          /* CheckoutScreen ile aynı: durum güncellemesi best-effort */
        }
      }
      return { kind: 'blocked' };
    } finally {
      setPlacing(false);
    }
  }, [
    user,
    closedItemNames,
    isPaymentFeatureEnabled,
    isPaymentConfigured,
    retryAllowed,
    deliveryMethod,
    selectedAddress,
    addresses.length,
    customerName,
    customerPhone,
    customerEmail,
    contractsAccepted,
    checkoutBlockMessage,
    deliveryTimeType,
    scheduledDate,
    timeSlot,
    draftOrderId,
    draftOrder,
    items,
    totals,
    appliedCoupon,
    branches,
    selectedBranchId,
    orderNote,
    cardsEnabled,
    selectedCardId,
    clearCart,
  ]);

  /**
   * PaymentScreen'den geri dönüldü (başarı OrderSuccess'e `replace` ile gider,
   * buraya yalnız başarısız / doğrulanıyor / inceleniyor / vazgeçildi döner).
   * Sonuç MEVCUT `fetchPendingPaymentOrderById` ile okunur → pano durumu.
   */
  const refreshPaymentOutcome = useCallback(async () => {
    if (!awaitingPaymentRef.current || !draftOrderId || !user) return;
    awaitingPaymentRef.current = false;
    setPayState('wait');
    try {
      const order = await fetchPendingPaymentOrderById({
        supabase: getSupabaseClient(),
        userId: user.id,
        orderId: draftOrderId,
      });
      if (order) setDraftOrder(order);
      setPayState(payStateFromOrder(order));
    } catch {
      setPayState('unknown');
    }
  }, [draftOrderId, user]);

  return {
    user,
    items,
    appliedCoupon,
    totals,
    kazanilacakMacro,
    // yöntem / zaman
    deliveryMethod,
    setDeliveryMethod,
    deliveryTimeType,
    setDeliveryTimeType,
    canPickImmediate,
    canPickScheduled,
    deliveryRulesSettled,
    shopOpenNow,
    scheduledDates,
    deliveryDays,
    scheduledDate,
    setScheduledDate: (d: Date | null) => {
      setScheduledDate(d);
      setTimeSlot(null);
    },
    timeSlot,
    setTimeSlot,
    // adres
    addresses,
    addressesLoading,
    addressError,
    selectedAddress,
    selectAddress,
    reloadAddresses: loadAddresses,
    isDeliverable,
    ruleStatus,
    deviceCoords,
    retryRules: () => setRulesRefreshKey((k) => k + 1),
    // şube
    branches,
    selectedBranchId,
    setSelectedBranchId,
    // iletişim / not / sözleşme
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    customerEmail,
    setCustomerEmail,
    orderNote,
    setOrderNote,
    contractsAccepted,
    setContractsAccepted,
    fieldErrors,
    clearFieldError,
    // kart
    cardsEnabled,
    cardsState,
    savedCards,
    selectedCardId,
    setSelectedCardId,
    reloadCards: loadCards,
    // durum
    closedItemNames,
    checkoutBlockMessage,
    screenError,
    placing,
    isCheckoutDisabled,
    payState,
    draftOrder,
    retryAllowed,
    isPaymentConfigured,
    isPaynkolay,
    placeOrder,
    refreshPaymentOutcome,
  };
}

export type EkCheckoutController = ReturnType<typeof useEkCheckout>;
