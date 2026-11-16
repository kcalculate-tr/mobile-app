// G56-S1 — eatkcal ana sayfa sipariş artırma bölümleri: görünürlük kuralları, tekrar sipariş (oos +
// yalnız kalanlar sepete + bildirim), kalan kalori hâlleri, plan, top < 3 gizli, davet + banner koşulu.
import React from 'react';
import { act, fireEvent, render as rtlRender, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (ui: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

const mockNavigate = jest.fn();
const mockAddItem = jest.fn();
const mockTrack = jest.fn();
let mockSession: { user: { id: string } } | null = null;
let mockFlags: Record<string, boolean> = {};
let mockNutrition: { summary: { targetKcal: number; consumedKcal: number } | null; loading: boolean } = { summary: null, loading: false };

const CATALOG = [
  { id: 1, name: 'Tavuk kinoa kase', price: 285, category: "Bowl's", calories: 540, protein: 42, carbs: 48, fats: 16, is_available: true },
  { id: 2, name: 'Izgara somon', price: 390, category: 'Yüksek Protein', calories: 480, protein: 38, carbs: 12, fats: 28, is_available: true },
  { id: 3, name: 'Mercimek çorbası', price: 140, category: 'Dengeli ve Sağlıklı', calories: 220, protein: 12, carbs: 30, fats: 5, is_available: true },
  { id: 4, name: 'Omlet kutusu', price: 190, category: 'Omlette Box', calories: 320, protein: 18, carbs: 10, fats: 22, is_available: true },
  { id: 5, name: 'Basmati tavuk', price: 450, category: "Wrap's", calories: 820, protein: 62, carbs: 78, fats: 22, is_available: true },
];

const mockApi = {
  fetchDeliveredOrders: jest.fn(async () => [] as unknown[]),
  fetchTopProductsWeek: jest.fn(async () => [] as unknown[]),
  fetchTodayPlanItems: jest.fn(async () => [] as unknown[]),
  fetchReferralSettings: jest.fn(async () => null as null | { rewardTl: number | null; minOrderTl: number | null }),
  fetchOptionInfo: jest.fn(async () => new Map()),
};

jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useRoute: () => ({ params: {} }),
    useFocusEffect: (cb: () => void) => R.useEffect(() => cb(), [cb]),
  };
});
jest.mock('../nav', () => ({ useEkNav: () => ({ navigate: mockNavigate, goBack: jest.fn() }) }));
jest.mock('../../../../core/supabase', () => {
  const client = { rpc: jest.fn(), from: jest.fn(), auth: { getSession: () => Promise.resolve({ data: { session: null } }) } };
  return { supabase: client, getSupabaseClient: () => client };
});
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => ({ session: mockSession, user: mockSession?.user ?? null }) }));
jest.mock('../../../../core/flags', () => ({ useFeature: (k: string) => !!mockFlags[k] }));
jest.mock('../../../../lib/analytics', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));
jest.mock('../../../../lib/products', () => ({
  fetchProducts: jest.fn(async () => CATALOG),
  fetchProductOptionGroups: jest.fn(async () => []),
  getGroupSelectionLimits: (g: { minSelection: number; maxSelection: number }) => ({ min: g.minSelection, max: Math.max(g.minSelection, g.maxSelection) }),
}));
jest.mock('../../../../lib/banners', () => ({
  fetchBannerRows: jest.fn(async () => ({
    hero: [
      {
        cells: [
          { id: 'b1', image_url: 'https://x/1.png', title: 'Koliye özel', navigate_to: 'CategoryProducts:Koliye Özel Fırsatlar', link: null, audience: null },
          { id: 'b2', image_url: 'https://x/2.png', title: 'İlk siparişine özel', navigate_to: 'Campaign:abc', link: null, audience: 'no_orders' },
          { id: 'b3', image_url: 'https://x/3.png', title: 'Arkadaşını davet et', navigate_to: 'Invite', link: null, audience: null },
        ],
      },
    ],
    promo: [],
  })),
}));
jest.mock('../../../../lib/businessHours', () => ({ fetchBusinessHours: jest.fn(async () => null) }));
jest.mock('../../../../lib/socialProof', () => ({ vitrinYorumlariniGetir: jest.fn(async () => []) }));
jest.mock('../../../../lib/activeOrder', () => ({ fetchActiveOrder: jest.fn(async () => null), subscribeToOrder: () => () => {}, isDeliveredExpired: () => false }));
jest.mock('../../../../lib/macros', () => ({ fetchMacroProfile: jest.fn(async () => null), fetchMacroSettings: jest.fn(async () => ({})), DEFAULT_MACRO_SETTINGS: {} }));
jest.mock('../../../../lib/brands', () => ({ fetchBrand: jest.fn(async () => null) }));
jest.mock('../../../../lib/restaurantRating', () => ({ fetchRestaurantRating: jest.fn(async () => null) }));
jest.mock('../../../../hooks/useNutritionSummary', () => ({ useNutritionSummary: () => ({ ...mockNutrition, error: null, refetch: jest.fn(async () => {}) }) }));
jest.mock('../../../../store/cartStore', () => ({ useCartStore: (sel: (s: unknown) => unknown) => sel({ addItem: mockAddItem }) }));
jest.mock('../../../plan/actions', () => ({ addPlanMealsToCart: jest.fn(async () => ({ added: 2, choice: [], missing: 0 })) }));
jest.mock('../../gate/eatGate', () => ({ useEatGate: () => ({ state: 'pass', recheck: jest.fn(), setState: jest.fn() }), readEatGatePassed: jest.fn(async () => true) }));
jest.mock('../growth/growthApi', () => ({
  fetchDeliveredOrders: (...a: unknown[]) => mockApi.fetchDeliveredOrders(...(a as [])),
  fetchTopProductsWeek: () => mockApi.fetchTopProductsWeek(),
  fetchTodayPlanItems: (...a: unknown[]) => mockApi.fetchTodayPlanItems(...(a as [])),
  fetchReferralSettings: () => mockApi.fetchReferralSettings(),
  fetchOptionInfo: (...a: unknown[]) => mockApi.fetchOptionInfo(...(a as [])),
}));
jest.mock('../ui/home/useDeliveryChip', () => ({ useDeliveryChip: () => ({ chip: null }) }));
jest.mock('../ui/home/CartBar', () => ({ CART_BAR_H: 48, CART_BAR_GAP: 12, cartBarBottom: () => 40, useCartSummary: () => ({ count: 0, total: 0 }), EkCartBar: () => null }));
jest.mock('../../../shell', () => ({ useInR3Shell: () => false, tabBarContentInset: () => 100 }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EkHomeScreen = require('../screens/EkHomeScreen').default;

const today = new Date().toISOString();
const ORDER = {
  id: 77,
  orderCode: 'KCAL-77',
  createdAt: today,
  totalAmount: 590,
  totalCalories: 1000,
  items: [
    { id: '1', name: 'Tavuk kinoa kase', quantity: 1, options: {}, calories: 540, imageUrl: null },
    { id: '3', name: 'Mercimek çorbası', quantity: 2, options: {}, calories: 220, imageUrl: null },
    { id: '99', name: 'Kaldırılmış ürün', quantity: 1, options: {}, calories: 300, imageUrl: null },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = null;
  mockFlags = { davet: false };
  mockNutrition = { summary: null, loading: false };
  mockApi.fetchDeliveredOrders.mockResolvedValue([]);
  mockApi.fetchTopProductsWeek.mockResolvedValue([]);
  mockApi.fetchTodayPlanItems.mockResolvedValue([]);
  mockApi.fetchReferralSettings.mockResolvedValue(null);
});

test('misafir / yeni kullanıcı: tekrar sipariş, plan, davet gizli; kalan kalori boş hâl; davet banner gizli, "ilk sipariş" görünür; top < 3 gizli', async () => {
  mockApi.fetchTopProductsWeek.mockResolvedValue([
    { product_id: 1, rank: 1, order_count: 5 },
    { product_id: 2, rank: 2, order_count: 3 },
  ]);
  const r = render(<EkHomeScreen />);
  await waitFor(() => expect(r.getByTestId('ek56-chips')).toBeTruthy());
  expect(r.queryByTestId('ek56-reorder')).toBeNull();
  expect(r.queryByTestId('ek56-plan')).toBeNull();
  expect(r.queryByTestId('ek56-invite')).toBeNull();
  expect(r.getByTestId('ek56-kcal-empty')).toBeTruthy();
  expect(r.getByText('Hedefimi belirle')).toBeTruthy();
  await waitFor(() => expect(r.queryByTestId('ek56-skel-top')).toBeNull());
  expect(r.queryByTestId('ek56-top')).toBeNull();
  // Banner koşulları
  expect(r.getByLabelText('Kampanya: Koliye özel')).toBeTruthy();
  expect(r.getByLabelText('Kampanya: İlk siparişine özel')).toBeTruthy();
  expect(r.queryByLabelText('Kampanya: Arkadaşını davet et')).toBeNull();
  // Çipler: vegan / tatlı verisi yok → gizli
  expect(r.getByText('Yüksek protein')).toBeTruthy();
  expect(r.queryByText('Vegan')).toBeNull();
  expect(r.queryByText('Tatlı')).toBeNull();
  fireEvent.press(r.getByTestId('ek56-chip-high_protein'));
  expect(mockNavigate).toHaveBeenCalledWith('EkList', { filter: 'high_protein' });
  expect(mockTrack).toHaveBeenCalledWith('eatkcal_sec_tap', { sec: 'chips', action: 'high_protein' });
  fireEvent.press(r.getByText('Hedefimi belirle'));
  expect(mockNavigate).toHaveBeenCalledWith('NutritionProfile');
});

test('siparişli + takipli kullanıcı: oos uyarısı, yalnız kalanlar sepete, bildirim; kalan kalori; plan; top; davet', async () => {
  mockSession = { user: { id: 'u1' } };
  mockFlags = { davet: true };
  mockNutrition = { summary: { targetKcal: 2000, consumedKcal: 1240 }, loading: false };
  mockApi.fetchDeliveredOrders.mockResolvedValue([ORDER]);
  mockApi.fetchTopProductsWeek.mockResolvedValue([
    { product_id: 5, rank: 1, order_count: 9 },
    { product_id: 1, rank: 2, order_count: 7 },
    { product_id: 2, rank: 3, order_count: 4 },
  ]);
  const d = new Date();
  const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  mockApi.fetchTodayPlanItems.mockResolvedValue([
    { id: 'p1', date: todayKey, slot: 'breakfast', source: 'recipe', refId: null, name: 'Yulaf', kcal: 300 },
    { id: 'p2', date: todayKey, slot: 'snack', source: 'recipe', refId: null, name: 'Kuruyemiş', kcal: 90 },
  ]);
  mockApi.fetchReferralSettings.mockResolvedValue({ rewardTl: 100, minOrderTl: 300 });

  const r = render(<EkHomeScreen />);
  await waitFor(() => expect(r.getByTestId('ek56-reorder')).toBeTruthy());
  expect(r.getByText('1 ürün stokta yok; kalan 2 ürün eklenir.')).toBeTruthy();
  // Siparişi olan kullanıcıda "ilk siparişe özel" banner gizli; davet banner görünür.
  expect(r.queryByLabelText('Kampanya: İlk siparişine özel')).toBeNull();
  expect(r.getByLabelText('Kampanya: Arkadaşını davet et')).toBeTruthy();

  await act(async () => {
    fireEvent.press(r.getByTestId('ek56-reorder-btn'));
  });
  await waitFor(() => expect(mockAddItem).toHaveBeenCalledTimes(2));
  expect(mockAddItem.mock.calls.map((c) => [c[0].id, c[2]])).toEqual([[1, 1], [3, 2]]);
  expect(r.getByText('2 ürün sepete eklendi')).toBeTruthy();
  fireEvent.press(r.getByText('Sepete git'));
  expect(mockNavigate).toHaveBeenCalledWith('EkCart');

  // Kalan kalori: 760, kalanı aşan ürün (820 kcal) yok, proteine göre sıralı.
  expect(r.getByText('Bugün 760 kcal kaldı')).toBeTruthy();
  const kcal = r.getByTestId('ek56-kcal-full');
  expect(kcal).toBeTruthy();
  expect(r.getAllByText('Gününe uyar').length).toBe(4);

  // Plan: kahvaltı 300 → Omlet kutusu 320 (±%10); ara öğün 90 → eşleşme yok → satır yok.
  expect(r.getAllByTestId('ek56-plan-row').length).toBe(1);
  expect(r.getByText('Kahvaltı')).toBeTruthy();

  // Top: sıra + gerçek adet.
  expect(r.getByTestId('ek56-top')).toBeTruthy();
  expect(r.queryByText('Bu hafta 9 sipariş')).toBeNull();

  // Davet kartı: ödül tutarıyla.
  expect(r.getByTestId('ek56-invite')).toBeTruthy();
  expect(r.getAllByText('İkinize de 100 TL kupon').length).toBeGreaterThan(0);
  expect(mockTrack).toHaveBeenCalledWith('eatkcal_sec_view', { sec: 'reorder', st: 'oos' });
  expect(mockTrack).toHaveBeenCalledWith('eatkcal_sec_view', { sec: 'kcal', st: 'full' });
});

test('hedef dolduysa "Hafif bir şey?" (≤ 400 kcal); davet bayrağı kapalıyken hiçbir davet girişi yok', async () => {
  mockSession = { user: { id: 'u1' } };
  mockFlags = { davet: false };
  mockNutrition = { summary: { targetKcal: 1800, consumedKcal: 1900 }, loading: false };
  mockApi.fetchReferralSettings.mockResolvedValue({ rewardTl: 100, minOrderTl: null });
  const r = render(<EkHomeScreen />);
  await waitFor(() => expect(r.getByText('Hafif bir şey?')).toBeTruthy());
  expect(r.getByText('Bugünkü hedefin doldu')).toBeTruthy();
  expect(r.getAllByText('Hafif').length).toBe(2); // 220 + 320 kcal
  expect(r.queryByTestId('ek56-invite')).toBeNull();
  expect(r.queryByLabelText('Kampanya: Arkadaşını davet et')).toBeNull();
  expect(mockApi.fetchReferralSettings).not.toHaveBeenCalled();
  // Siparişi yok → tekrar sipariş gizli
  expect(r.queryByTestId('ek56-reorder')).toBeNull();
});
