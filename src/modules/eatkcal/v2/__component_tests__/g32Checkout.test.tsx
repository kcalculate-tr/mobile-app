// G32-S1 md.4–5 — Sipariş özeti: Gel-Al şube kartları + randevulu saat çipleri.
// useEkCheckout sahte (durumlu) denetleyiciyle değiştirildi; yalnız görünüm katmanı sınanır.
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, fireEvent, render as rtlRender, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (ui: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

jest.mock('@react-navigation/native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useRoute: () => ({ params: {} }),
    useFocusEffect: (cb: () => void) => R.useEffect(cb, []),
  };
});
jest.mock('../nav', () => ({
  useEkNav: () => ({ navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), isFocused: () => true }),
}));
jest.mock('../../../../core/supabase', () => {
  const client = { rpc: jest.fn(), from: jest.fn(), auth: { getSession: () => Promise.resolve({ data: { session: null } }) } };
  return { supabase: client, getSupabaseClient: () => client };
});

const BRANCHES = [
  { id: 'b1', name: 'Bayraklı (Mansuroğlu)', slug: 'mansuroglu', address: 'Mansuroğlu Mah. 271. Sk. No:6A Bayraklı İzmir', latitude: 38.45, longitude: 27.18 },
  { id: 'b2', name: 'Karabağlar (Basın Sitesi)', slug: 'basinsitesi', address: 'Basın Sitesi Mah. 177/3. Sk. No:3A Karabağlar İzmir', latitude: 38.39, longitude: 27.12 },
];

jest.mock('../checkout/useEkCheckout', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EK_TIME_SLOTS } = require('../model/checkoutModel');
  return {
    useEkCheckout: () => {
      const [deliveryMethod, setDeliveryMethod] = R.useState('home_delivery');
      const [deliveryTimeType, setDeliveryTimeType] = R.useState('immediate');
      const [selectedBranchId, setSelectedBranchId] = R.useState(null);
      const [scheduledDate, setScheduledDate] = R.useState(null);
      const [timeSlot, setTimeSlot] = R.useState(null);
      const tomorrow = new Date(2026, 10, 13, 12);
      return {
        user: { id: 'u1' },
        items: [{ lineKey: 'l1', id: 1, name: 'Ton Salata', price: 285, quantity: 1, options: {} }],
        appliedCoupon: null,
        totals: { subtotal: 285, discountAmount: 0, deliveryFee: 0, totalAmount: 285, estimatedDeliveryLabel: '30–45 dk', remainingToFreeShipping: 0 },
        kazanilacakMacro: 0,
        deliveryMethod,
        setDeliveryMethod,
        deliveryTimeType,
        setDeliveryTimeType,
        canPickImmediate: true,
        canPickScheduled: true,
        deliveryRulesSettled: true,
        shopOpenNow: true,
        scheduledDates: [tomorrow],
        deliveryDays: null,
        scheduledDate,
        setScheduledDate: (d: Date | null) => {
          setScheduledDate(d);
          setTimeSlot(null);
        },
        timeSlot,
        setTimeSlot,
        addresses: [{ id: 'a1', title: 'Ev', full_address: 'Alsancak 1453 Sk.', neighbourhood: 'Alsancak', district: 'Konak' }],
        addressesLoading: false,
        addressError: '',
        selectedAddress: { id: 'a1', title: 'Ev', full_address: 'Alsancak 1453 Sk.' },
        selectAddress: jest.fn(),
        isDeliverable: true,
        ruleStatus: { status: 'ok' },
        deviceCoords: { latitude: 38.46, longitude: 27.17 },
        retryRules: jest.fn(),
        branches: [
          { id: 'b1', name: 'Bayraklı (Mansuroğlu)', slug: 'mansuroglu', address: 'Mansuroğlu Mah. 271. Sk. No:6A Bayraklı İzmir', latitude: 38.45, longitude: 27.18 },
          { id: 'b2', name: 'Karabağlar (Basın Sitesi)', slug: 'basinsitesi', address: 'Basın Sitesi Mah. 177/3. Sk. No:3A Karabağlar İzmir', latitude: 38.39, longitude: 27.12 },
        ],
        selectedBranchId,
        setSelectedBranchId,
        customerName: 'Test Kişi',
        setCustomerName: jest.fn(),
        customerPhone: '5550000000',
        setCustomerPhone: jest.fn(),
        customerEmail: 'test@example.com',
        setCustomerEmail: jest.fn(),
        orderNote: '',
        setOrderNote: jest.fn(),
        contractsAccepted: true,
        setContractsAccepted: jest.fn(),
        fieldErrors: {},
        clearFieldError: jest.fn(),
        cardsEnabled: false,
        cardsState: 'ready',
        savedCards: [],
        selectedCardId: null,
        setSelectedCardId: jest.fn(),
        reloadCards: jest.fn(),
        closedItemNames: [],
        checkoutBlockMessage: '',
        screenError: '',
        placing: false,
        isCheckoutDisabled: false,
        payState: 'idle',
        draftOrder: null,
        retryAllowed: true,
        isPaymentConfigured: true,
        isPaynkolay: true,
        placeOrder: jest.fn(async () => ({ kind: 'none' })),
        refreshPaymentOutcome: jest.fn(),
        __slots: EK_TIME_SLOTS,
      };
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EkCheckoutScreen = require('../screens/EkCheckoutScreen').default;

const payDisabled = (r: ReturnType<typeof render>) => {
  const footer = r.getByTestId('ek-checkout-footer');
  const btn = within(footer).getAllByRole('button').find((b) => /Öde/.test(String(b.props.accessibilityLabel ?? '')) || within(b).queryByText(/^Öde/));
  return !!btn?.props.accessibilityState?.disabled;
};

describe('md.4 Gel-Al → şube seçimi', () => {
  test('Gel-Al seçilince şube kartları kendiliğinden açılır; seçilmeden Öde pasif + "Şube seç"', () => {
    expect(BRANCHES).toHaveLength(2);
    const r = render(<EkCheckoutScreen />);
    expect(r.queryByTestId('ek-branch-cards')).toBeNull();
    act(() => {
      fireEvent.press(r.getByText('Gel-Al'));
    });
    const cards = r.getByTestId('ek-branch-cards');
    expect(cards).toBeTruthy();
    // İki kart yan yana (satır yönü), ikisi de eşit esneklikte.
    expect((StyleSheet.flatten(cards.props.style) as Record<string, unknown>).flexDirection).toBe('row');
    expect(r.getByTestId('ek-branch-card-b1')).toBeTruthy();
    expect(r.getByTestId('ek-branch-card-b2')).toBeTruthy();
    expect(r.getByText('Mansuroğlu, Bayraklı')).toBeTruthy();
    expect(r.getByText('Basın Sitesi, Karabağlar')).toBeTruthy();
    expect(r.getAllByText('Açık').length).toBe(2);
    expect(r.getAllByText(/km$/).length).toBe(2); // konum izni var → uzaklık
    expect(r.getByText('En yakın')).toBeTruthy();
    // Kendiliğinden seçim YOK → Öde pasif, altında "Şube seç".
    expect(r.queryByTestId('ek-branch-card-tick')).toBeNull();
    expect(r.getAllByText('Şube seç').length).toBeGreaterThan(0);
    expect(payDisabled(r)).toBe(true);

    act(() => {
      fireEvent.press(r.getByTestId('ek-branch-card-b2'));
    });
    expect(r.getByTestId('ek-branch-card-b2').props.accessibilityState).toEqual({ checked: true });
    expect(within(r.getByTestId('ek-branch-card-b2')).getByTestId('ek-branch-card-tick')).toBeTruthy();
    expect(r.queryAllByText('Şube seç')).toHaveLength(0);
    expect(payDisabled(r)).toBe(false);
  });

  test('Eve teslime dönünce adres kartı geri gelir', () => {
    const r = render(<EkCheckoutScreen />);
    act(() => {
      fireEvent.press(r.getByText('Gel-Al'));
    });
    expect(r.getByTestId('ek-branch-cards')).toBeTruthy();
    // Yöntem bölümü (akordeon) yeniden açılır, Eve teslim seçilir.
    act(() => {
      fireEvent.press(r.getByText('Yöntem ve zaman'));
    });
    act(() => {
      fireEvent.press(r.getByText('Eve teslim'));
    });
    expect(r.queryByTestId('ek-branch-cards')).toBeNull();
    expect(r.getAllByText('Adres').length).toBeGreaterThan(0);
  });
});

describe('md.5 Randevulu saat seçimi', () => {
  test('üç aralık tek satır, eşit genişlik, yatay kaydırma yok; iki satır; dolu soluk + "Dolu"', () => {
    const r = render(<EkCheckoutScreen />);
    act(() => {
      fireEvent.press(r.getByText('Eve teslim'));
    });
    act(() => {
      fireEvent.press(r.getByText('Randevulu'));
    });
    act(() => {
      fireEvent.press(r.getByLabelText(/13$/)); // yarın (13 Kas) gün çipi
    });
    const row = r.getByTestId('ek-slot-row');
    const rowSt = StyleSheet.flatten(row.props.style) as Record<string, unknown>;
    expect(rowSt.flexDirection).toBe('row');
    expect(rowSt.flexWrap).toBeUndefined(); // tek satır
    // Üst zincirde yatay ScrollView yok (gün çipleri gibi kaydırma YOK).
    let p = row.parent;
    while (p) {
      expect(p.props.horizontal).not.toBe(true);
      p = p.parent;
    }
    const ids = ['1', '2', '3'];
    for (const id of ids) {
      const st = StyleSheet.flatten(r.getByTestId(`ek-slot-${id}`).props.style) as Record<string, unknown>;
      expect(st.flex).toBe(1);
    }
    // İki satır: başlangıç / bitiş (punto ≥ 13).
    const s1 = within(r.getByTestId('ek-slot-1'));
    expect(s1.getByText('09:30')).toBeTruthy();
    expect(s1.getByText('13:30')).toBeTruthy();
    // Dolu aralık (17:30–21:30): soluk + küçük "Dolu".
    const s3 = r.getByTestId('ek-slot-3');
    expect((StyleSheet.flatten(s3.props.style) as Record<string, number>).opacity).toBeLessThan(1);
    expect(within(s3).getByText('21:30 · Dolu')).toBeTruthy();
    expect(s3.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    for (const id of ids) {
      for (const txt of within(r.getByTestId(`ek-slot-${id}`)).UNSAFE_getAllByType(Text)) {
        expect((StyleSheet.flatten(txt.props.style) as Record<string, number>).fontSize).toBeGreaterThanOrEqual(13);
      }
    }
  });
});
