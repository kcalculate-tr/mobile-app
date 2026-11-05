/**
 * G13-S2 md.9 — KABUL: eski ve yeni arayüz aynı sepette aynı tutarı, aynı
 * ödeme fonksiyonu çağrısını üretir.
 *
 * (1) GERÇEK cartStore (addItem/getSubtotal/getDiscountAmount) ile kurulan
 *     sepet → eski CartScreen.tsx:250-255 ve CheckoutScreen.tsx:599-722
 *     formülleri = v2 computeCartTotal / computeCheckoutTotals.
 * (2) v2 denetleyicisi (useEkCheckout) "Siparişi ver" → MEVCUT
 *     createOrderDraftForPayment'i, bugünkü handleCreateOrder'ın geçtiği
 *     AYNI argümanla çağırır; PaymentScreen parametreleri aynı; aynı sepetle
 *     ikinci basışta YENİ taslak açılmaz (mükerrer koruma: imza → aynı taslak),
 *     sepet değişince eski taslak iptal edilip yenisi açılır (CheckoutScreen ile aynı).
 * (3) PaymentScreen'den dönüşte sonuç MEVCUT fetchPendingPaymentOrderById ile
 *     okunur → payment_failed = "Ödeme alınamadı" durumu.
 */
import { act, renderHook } from '@testing-library/react-native';
import { useCartStore } from '../../../../store/cartStore';
import type { Product } from '../../../../types';
import { resolveShippingFee, type DeliveryGlobals } from '../../../../lib/deliveryRules';
import { buildCartSignatureLines, computeCartSignature } from '../../../../lib/cartSignature';
import { computeCartTotal, computeCheckoutTotals } from '../model/checkoutModel';

// ── Ortak sahte veriler ────────────────────────────────────────────────────
const ADDRESS_ID = '3f6c1a2e-1111-4222-8333-444455556666';
const ADDRESS_ROW = {
  id: ADDRESS_ID,
  user_id: 'u1',
  title: 'Ev',
  contact_name: 'Adres Kişi',
  contact_phone: '05550000000',
  contact_email: 'adres@ornek.com',
  full_address: 'Kıbrıs Şehitleri Cd. 1',
  city: 'İzmir',
  district: 'Konak',
  neighbourhood: 'Alsancak',
  is_default: true,
  latitude: 38.43,
  longitude: 27.14,
};
const ZONE_ROW = { district: 'Konak', neighbourhood: 'Alsancak', allow_immediate: true, allow_scheduled: true, delivery_fee_immediate: 39.9, free_shipping_above_immediate: 1000 };
const GLOBALS: DeliveryGlobals = {
  immediate: { min_order: 200, shipping_fee: 49.9, free_shipping_above: 750 },
  scheduled: { min_order: 300, shipping_fee: 0, free_shipping_above: 0 },
} as DeliveryGlobals;

// Tabloya göre cevap veren zincir (yalnız okuma; update/insert → hata yok).
const mockTables: Record<string, unknown> = {
  settings: { min_cart_amount: 0 },
  addresses: [ADDRESS_ROW],
  delivery_zones: [ZONE_ROW],
  profiles: { full_name: 'Ad Soyad', first_name: 'Ad', last_name: 'Soyad', phone: '0555 111 22 33' },
};
jest.mock('../../../../core/supabase', () => {
  const zincir = (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'update', 'eq', 'in', 'or', 'order', 'limit', 'range']) q[m] = () => q;
    q.maybeSingle = () => Promise.resolve({ data: mockTables[table] ?? null, error: null });
    q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: mockTables[table] ?? [], error: null }).then(res);
    return q;
  };
  const client = {
    from: zincir,
    rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: jest.fn(() => Promise.resolve({ data: null, error: null })) },
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  };
  return { supabase: client, getSupabaseClient: () => client };
});

// Gerçek AuthContext gibi SABİT nesne (her render'da yeni nesne sonsuz yeniden yükleme yapar).
jest.mock('../../../../core/AuthContext', () => {
  const auth = { user: { id: 'u1', email: 'kullanici@ornek.com' }, session: {}, authLoading: false };
  return { useAuth: () => auth };
});
jest.mock('../../../../core/design', () => ({ haptic: jest.fn() }));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
  getLastKnownPositionAsync: () => Promise.resolve(null),
}));
jest.mock('../../../../config/payment', () => ({ PAYMENT_PROVIDER: 'paynkolay' }));
jest.mock('../../../../lib/payment', () => ({
  getPaymentConfigStatus: () => ({ isPaymentEnabled: true, isConfigured: true }),
  mapPaymentErrorToMessage: () => 'Ödeme tamamlanamadı.',
}));
jest.mock('../../../../lib/analytics', () => ({ logEvent: new Proxy({}, { get: () => () => {} }), track: () => {} }));
jest.mock('../../../../lib/delivery', () => ({
  ...jest.requireActual('../../../../lib/deliveryRules'),
  fetchGlobalDeliverySettings: () => Promise.resolve(GLOBALS),
}));
jest.mock('../../../../lib/businessHours', () => ({
  ...jest.requireActual('../../../../lib/businessHours'),
  fetchBusinessHours: () => Promise.resolve({}),
  isShopOpenNow: () => true,
  getAvailableScheduledDates: () => [],
}));
jest.mock('../../../../lib/branches', () => ({ fetchBranches: () => Promise.resolve([]) }));
jest.mock('../../../../lib/branchAvailability', () => ({
  ...jest.requireActual('../../../../lib/branchAvailability'),
  fetchBranchAvailability: () => Promise.resolve({ closedProductIds: [], branchId: null, branchName: null }),
}));
jest.mock('../../../../lib/cards', () => ({
  getCardsFeatureStatus: () => Promise.resolve({ enabled: false }),
  syncSavedCards: () => Promise.resolve({ cards: [] }),
}));
jest.mock('../../../../lib/macros', () => ({
  ...jest.requireActual('../../../../lib/macros'),
  fetchMacroProfile: () => Promise.resolve(null),
  fetchMacroSettings: () => Promise.resolve(jest.requireActual('../../../../lib/macros').DEFAULT_MACRO_SETTINGS),
}));

// MEVCUT sipariş fonksiyonları — çağrı kaydı için sarılır; imza gerçek formülle
// (orders.ts:579-586 ile aynı) üretilir ki mükerrer koruma gerçekten sınansın.
const mockDraft = jest.fn();
const mockUpdateStatus = jest.fn((_a: unknown) => Promise.resolve());
const mockCancelStale = jest.fn((_a: unknown) => Promise.resolve());
const mockFetchPending = jest.fn();
jest.mock('../../../../lib/orders', () => {
  const actual = jest.requireActual('../../../../lib/orders');
  return {
    ...actual,
    createOrderDraftForPayment: (args: unknown) => mockDraft(args),
    updateOrderPaymentStatus: (args: unknown) => mockUpdateStatus(args),
    cancelStaleOrderDraft: (args: unknown) => mockCancelStale(args),
    fetchPendingPaymentOrderById: (args: unknown) => mockFetchPending(args),
  };
});

const product = (id: number, price: number, extra: Partial<Product> = {}): Product =>
  ({ id, name: `Ürün ${id}`, price, brand: 'kcalculate', category: 'test', calories: 400, protein: 30, carbs: 40, fats: 10, ...extra }) as unknown as Product;

function seedCart() {
  useCartStore.setState({ items: [], appliedCoupon: null });
  const s = useCartStore.getState();
  s.addItem(product(11, 289.9), {}, 2);
  s.addItem(product(12, 150, { discount_type: 'percent', discount_value: 20 } as Partial<Product>), {}, 1);
  s.addItem(product(13, 95.5), { extraPrice: 30, labels: ['Ekstra tavuk'], byGroup: { g1: ['v1'] } }, 1);
}

beforeEach(() => {
  // Sahte zamanlayıcılar (jest config) async zinciri bekletiyor; bu dosya gerçek zamanlı.
  jest.useRealTimers();
  mockDraft.mockReset();
  mockUpdateStatus.mockClear();
  mockCancelStale.mockClear();
  mockFetchPending.mockReset();
  mockDraft.mockImplementation((a: Record<string, any>) => {
    const { resolveAddressId } = jest.requireActual('../../../../lib/orders');
    return Promise.resolve({
      orderId: 'ord-1',
      orderCode: 'KCAL-0001',
      totalAmount: Number(Math.max(0, a.subtotal + a.deliveryFee - a.discountAmount).toFixed(2)),
      warnings: [],
      cartSignature: computeCartSignature(buildCartSignatureLines(a.cartItems), {
        couponCode: a.couponCode,
        addressId: resolveAddressId(a.address, a.deliveryMethod),
        deliveryMethod: a.deliveryMethod,
        deliveryType: a.deliveryType,
        scheduledDate: a.scheduledDate,
        scheduledTime: a.scheduledTime,
      }),
    });
  });
});

describe('KABUL (1) — aynı sepet, aynı toplam (gerçek cartStore)', () => {
  it('eski Sepet ve eski Özet formülü = v2', () => {
    seedCart();
    const st = useCartStore.getState();
    st.setCoupon({ code: 'K10', campaignId: '7', discountType: 'fixed', discountValue: 60, discountAmount: 60, title: 'K' });

    const subtotal = useCartStore.getState().getSubtotal();
    const discount = useCartStore.getState().appliedCoupon ? useCartStore.getState().getDiscountAmount(subtotal) : 0;
    // Eski CartScreen.tsx:250-255
    const legacyCart = Math.max(0, subtotal - useCartStore.getState().getDiscountAmount(subtotal));
    expect(computeCartTotal(subtotal, useCartStore.getState().getDiscountAmount(subtotal))).toBe(legacyCart);

    for (const deliveryMethod of ['home_delivery', 'pickup'] as const) {
      for (const deliveryTimeType of ['immediate', 'scheduled'] as const) {
        // Eski CheckoutScreen.tsx:713-722
        const fee = deliveryMethod === 'pickup' ? 0 : resolveShippingFee(ZONE_ROW as never, GLOBALS, deliveryTimeType, subtotal);
        const legacyTotal = Math.max(0, subtotal + fee - discount - 0);
        const v2 = computeCheckoutTotals({
          subtotal,
          discountAmount: discount,
          deliveryMethod,
          deliveryTimeType,
          zoneRow: ZONE_ROW as never,
          globals: GLOBALS,
          settingsMinCartAmount: 0,
        });
        expect(v2.deliveryFee).toBe(fee);
        expect(v2.totalAmount).toBe(legacyTotal);
      }
    }
    // Sepetin kendisi gerçekten cartStore'dan: 289.9×2 + 120 (indirimli) + (95.5+30)
    expect(subtotal).toBe(Number((289.9 * 2 + 120 + 125.5).toFixed(2)));
  });
});

async function flush() {
  for (let i = 0; i < 8; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('KABUL (2) — aynı ödeme fonksiyonu çağrısı', () => {
  it('Siparişi ver → createOrderDraftForPayment (eski argüman) → PaymentScreen parametreleri; ikinci basış yeni taslak AÇMAZ', async () => {
    seedCart();
    const { useEkCheckout } = require('../checkout/useEkCheckout');
    const { result } = renderHook(() => useEkCheckout({}));
    await flush();

    expect(result.current.selectedAddress?.id).toBe(ADDRESS_ID);
    expect(result.current.ruleStatus.status).toBe('ok');
    expect(result.current.customerName).toBe('Ad Soyad');

    act(() => result.current.setContractsAccepted(true));
    await flush();
    expect(result.current.checkoutBlockMessage).toBe('');

    let r: any;
    await act(async () => {
      r = await result.current.placeOrder();
    });

    const subtotal = useCartStore.getState().getSubtotal();
    const fee = resolveShippingFee(ZONE_ROW as never, GLOBALS, 'immediate', subtotal);
    expect(mockDraft).toHaveBeenCalledTimes(1);
    const arg = mockDraft.mock.calls[0][0];
    // Eski handleCreateOrder'ın geçtiği nesne (CheckoutScreen.tsx:1746-1770) — supabase hariç alan alan:
    const { supabase: _s, ...rest } = arg;
    expect(_s).toBeTruthy();
    expect(rest).toEqual({
      userId: 'u1',
      address: expect.objectContaining({ id: ADDRESS_ID, district: 'Konak', neighbourhood: 'Alsancak', full_address: ADDRESS_ROW.full_address }),
      cartItems: useCartStore.getState().items,
      customerName: 'Ad Soyad',
      customerEmail: 'kullanici@ornek.com',
      customerPhone: '0555 111 22 33',
      subtotal,
      deliveryFee: fee,
      discountAmount: 0,
      couponCode: null,
      couponId: null,
      deliveryMethod: 'delivery',
      orderNote: null,
      deliveryType: 'immediate',
      scheduledDate: null,
      scheduledTime: null,
      paymentMethod: 'new_card',
    });
    // PaymentScreen — eski navigate('PaymentScreen', {...}) (CheckoutScreen.tsx:1835-1840), kart özelliği kapalı → ek alan yok.
    expect(r).toEqual({
      kind: 'payment',
      params: { orderId: 'ord-1', amount: Number((subtotal + fee).toFixed(2)), orderCode: 'KCAL-0001' },
    });

    // PaymentScreen açıkken (wait) ikinci bir ödeme başlatılamaz.
    expect(result.current.payState).toBe('wait');
    expect(result.current.retryAllowed).toBe(false);
    await act(async () => {
      r = await result.current.placeOrder();
    });
    expect(r.kind).toBe('blocked');
    expect(mockDraft).toHaveBeenCalledTimes(1);

    // Kullanıcı ödeme ekranından vazgeçip döndü → sipariş hâlâ pending_payment
    // (mevcut fetchPendingPaymentOrderById) → "belirsiz" + tekrar denenebilir.
    const pending = {
      id: 'ord-1',
      orderCode: 'KCAL-0001',
      totalAmount: Number((subtotal + fee).toFixed(2)),
      status: 'pending_payment',
      paymentStatus: 'pending',
      updatedAt: '',
      cartSignature: (await mockDraft.mock.results[0].value).cartSignature,
    };
    mockFetchPending.mockResolvedValue(pending);
    await act(async () => {
      await result.current.refreshPaymentOutcome();
    });
    expect(result.current.payState).toBe('unknown');
    expect(result.current.retryAllowed).toBe(true);

    // Aynı sepetle tekrar → imza aynı → taslak yeniden kullanılır (yeni sipariş YOK).
    await act(async () => {
      r = await result.current.placeOrder();
    });
    expect(mockDraft).toHaveBeenCalledTimes(1);
    expect(mockCancelStale).not.toHaveBeenCalled();
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'ord-1', status: 'pending_payment', paymentStatus: 'pending' }),
    );
    expect(r.kind).toBe('payment');
    expect(r.params.orderId).toBe('ord-1');

    // Sepet değişti → eski taslak iptal, YENİ taslak (CheckoutScreen.tsx:1700-1717 ile aynı).
    await act(async () => {
      await result.current.refreshPaymentOutcome();
    });
    act(() => {
      useCartStore.getState().addItem(product(14, 60), {}, 1);
    });
    await flush();
    await act(async () => {
      r = await result.current.placeOrder();
    });
    expect(mockCancelStale).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ord-1', userId: 'u1' }));
    expect(mockDraft).toHaveBeenCalledTimes(2);
  });

  it('PaymentScreen dönüşü: mevcut fetchPendingPaymentOrderById → payment_failed = "Ödeme alınamadı"', async () => {
    seedCart();
    const { useEkCheckout } = require('../checkout/useEkCheckout');
    const { result } = renderHook(() => useEkCheckout({}));
    await flush();
    act(() => result.current.setContractsAccepted(true));
    await flush();
    await act(async () => {
      await result.current.placeOrder();
    });
    mockFetchPending.mockResolvedValue({
      id: 'ord-1',
      orderCode: 'KCAL-0001',
      totalAmount: 1,
      status: 'payment_failed',
      paymentStatus: 'failed',
      updatedAt: '',
      cartSignature: 'x',
    });
    await act(async () => {
      await result.current.refreshPaymentOutcome();
    });
    expect(mockFetchPending).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', orderId: 'ord-1' }));
    expect(result.current.payState).toBe('fail');
    expect(result.current.retryAllowed).toBe(true);
  });

  it('sözleşme onayı yoksa sipariş/ödeme fonksiyonu HİÇ çağrılmaz', async () => {
    seedCart();
    const { useEkCheckout } = require('../checkout/useEkCheckout');
    const { result } = renderHook(() => useEkCheckout({}));
    await flush();
    let r: any;
    await act(async () => {
      r = await result.current.placeOrder();
    });
    expect(r.kind).toBe('blocked');
    expect(result.current.fieldErrors.sozlesme).toBe('Devam etmek için sözleşmeleri onaylayın.');
    expect(mockDraft).not.toHaveBeenCalled();
  });
});
