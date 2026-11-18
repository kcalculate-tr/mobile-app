// G62-S1 — sipariş değerlendirme v2 (FinEkRateSheet + giriş kartı): boş / dolu / gönderildi, gönderim,
// düşük puan yolu, hata, istem görünürlüğü (Ana sayfa / sipariş detayı), bayrak kapalı = bugünkü davranış.
import React from 'react';
import { act, fireEvent, render as rtlRender, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (ui: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

const mockNavigate = jest.fn();
const mockTrack = jest.fn();
let mockFlags: Record<string, boolean> = {};
let mockUser: { id: string } | null = { id: 'u1' };
const mockFetchHome = jest.fn();
const mockFetchOrder = jest.fn();
const mockDismiss = jest.fn(async (_id: number) => {});

jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(cb, [cb]),
  };
});
jest.mock('../../../../core/supabase', () => {
  const client = { rpc: jest.fn(), from: jest.fn(), functions: { invoke: jest.fn(async () => ({})) }, auth: { getSession: () => Promise.resolve({ data: { session: null } }) } };
  return { supabase: client, getSupabaseClient: () => client };
});
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => ({ user: mockUser, session: mockUser ? { user: mockUser } : null }) }));
jest.mock('../../../../core/flags', () => ({ useFeature: (k: string) => !!mockFlags[k] }));
jest.mock('../../../../lib/analytics', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));
jest.mock('../../../../lib/products', () => ({ fetchProducts: jest.fn(async () => []) }));
jest.mock('../model/orderRateData', () => ({
  ...jest.requireActual('../model/orderRateData'),
  fetchHomeRatePrompt: (...a: unknown[]) => mockFetchHome(...a),
  fetchOrderRatePrompt: (...a: unknown[]) => mockFetchOrder(...a),
  dismissPrompt: (id: number) => mockDismiss(id),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { OrderRateSheet } = require('../ui/rate/OrderRateSheet');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { HomeOrderRatePrompt, OrderRateEntry } = require('../ui/rate/OrderRateEntry');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resetPromptTracking } = require('../model/orderRate');

const ORDER = {
  id: 42,
  orderCode: 'KCAL-1234',
  deliveredAt: '2026-11-18T09:00:00.000Z',
  items: [
    { productId: 3, name: 'Tavuk kinoa kase' },
    { productId: 5, name: 'Yeşil detoks' },
  ],
  firstProductId: '3',
};

function makeDeps(over: Partial<{ submit: jest.Mock; upload: jest.Mock; pickPhoto: jest.Mock }> = {}) {
  return {
    submit: over.submit ?? jest.fn(async (input: { orderId: number; dims: Record<string, number>; comment: string; votes: Record<number, unknown> }) => ({
      ok: true,
      rating: 5,
      args: {
        p_order_id: input.orderId, p_delivery: input.dims.delivery, p_calorie_fit: input.dims.calorie_fit, p_taste: input.dims.taste,
        p_comment: input.comment.trim() || null, p_photo_path: null, p_items: Object.keys(input.votes).map((k) => ({ product_id: Number(k), liked: true, tags: [] })),
      },
    })),
    upload: over.upload ?? jest.fn(async () => 'u1/reviews/42-1.jpg'),
    pickPhoto: over.pickPhoto ?? jest.fn(async () => 'file:///tmp/p.jpg'),
  };
}

function sheet(props: Record<string, unknown> = {}) {
  const onSent = jest.fn();
  const onSupport = jest.fn();
  const onClose = jest.fn();
  const deps = (props.deps as ReturnType<typeof makeDeps>) ?? makeDeps();
  const r = render(
    <OrderRateSheet visible order={ORDER} dateLabel="18 Kasım 2026" onClose={onClose} onSent={onSent} onSupport={onSupport} deps={deps} {...props} />,
  );
  return { ...r, onSent, onSupport, onClose, deps };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFlags = {};
  mockUser = { id: 'u1' };
  resetPromptTracking();
});

test('boş hâl: başlık + alt başlık, üç başlık "Puanlanmadı", Gönder pasif + ipucu; gönderim yapılmaz', async () => {
  const { getByText, getByTestId, deps } = sheet();
  expect(getByText('Siparişini değerlendir')).toBeTruthy();
  expect(getByTestId('order-rate-sub').props.children).toBe('kcalculate, 18 Kasım 2026');
  for (const d of ['Teslimat', 'Kalori uyumu', 'Lezzet']) expect(getByText(d)).toBeTruthy();
  expect(getByTestId('order-rate-dim-delivery').props.accessibilityRole).toBe('radiogroup');
  expect(getByTestId('order-rate-delivery-3').props.accessibilityRole).toBe('radio');
  expect(getByTestId('order-rate-send').props.accessibilityState).toMatchObject({ disabled: true });
  expect(getByTestId('order-rate-hint').props.children).toBe('Göndermek için üç başlığı da puanla.');
  await act(async () => {
    fireEvent.press(getByTestId('order-rate-send'));
  });
  expect(deps.submit).not.toHaveBeenCalled();
});

test('dolu → gönder: puanlar, ürün oyu + etiket, yorum ≤ 500, fotoğraf yüklenir; teşekkür + özet', async () => {
  const { getByTestId, queryByTestId, getByText, getAllByText, deps, onSent } = sheet();
  fireEvent.press(getByTestId('order-rate-delivery-5'));
  fireEvent.press(getByTestId('order-rate-calorie_fit-4'));
  expect(getByTestId('order-rate-send').props.accessibilityState).toMatchObject({ disabled: true });
  fireEvent.press(getByTestId('order-rate-taste-5'));
  expect(getAllByText('Harika')).toHaveLength(2);
  expect(getByTestId('order-rate-taste-5').props.accessibilityState).toMatchObject({ checked: true });
  expect(getByTestId('order-rate-send').props.accessibilityState).toMatchObject({ disabled: false });
  // Ürün oyu + etiket
  fireEvent.press(getByTestId('order-rate-like-3'));
  fireEvent.press(getByTestId('order-rate-tag-3-lezzetli'));
  expect(queryByTestId('order-rate-tag-3-soguk')).toBeNull();
  // Yorum (500 sınırı)
  fireEvent.changeText(getByTestId('order-rate-comment'), 'x'.repeat(600));
  expect(getByTestId('order-rate-comment').props.value).toHaveLength(500);
  // Fotoğraf
  await act(async () => {
    fireEvent.press(getByTestId('order-rate-photo-add'));
  });
  expect(getByTestId('order-rate-photo')).toBeTruthy();
  expect(getByText('Fotoğrafı değiştir')).toBeTruthy();
  await act(async () => {
    fireEvent.press(getByTestId('order-rate-send'));
  });
  expect(deps.upload).toHaveBeenCalledWith('file:///tmp/p.jpg', 42);
  expect(deps.submit).toHaveBeenCalledWith({
    orderId: 42,
    dims: { delivery: 5, calorie_fit: 4, taste: 5 },
    comment: 'x'.repeat(500),
    photoPath: 'u1/reviews/42-1.jpg',
    votes: { 3: { liked: true, tags: ['lezzetli'] } },
  });
  expect(onSent).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(getByTestId('order-rate-sent')).toBeTruthy());
  expect(getByText('Teşekkürler')).toBeTruthy();
  expect(getByText('Değerlendirmen mağaza puanına eklendi. Puan, son 3 ayın ortalamasıdır.')).toBeTruthy();
  expect(getByText('4 / 5')).toBeTruthy();
  expect(queryByTestId('order-rate-low')).toBeNull();
});

test('düşük puan (≤ 2): gönderildi hâlinde "Bir sorun mu vardı?" → destek', async () => {
  const { getByTestId, getByText, onSupport } = sheet();
  fireEvent.press(getByTestId('order-rate-delivery-1'));
  fireEvent.press(getByTestId('order-rate-calorie_fit-2'));
  fireEvent.press(getByTestId('order-rate-taste-2'));
  await act(async () => {
    fireEvent.press(getByTestId('order-rate-send'));
  });
  expect(getByTestId('order-rate-low')).toBeTruthy();
  expect(getByText('Bir sorun mu vardı?')).toBeTruthy();
  fireEvent.press(getByTestId('order-rate-support'));
  expect(onSupport).toHaveBeenCalledTimes(1);
});

test('hata: zaten değerlendirildi → form kalır, mesaj görünür', async () => {
  const submit = jest.fn(async () => ({ ok: false, error: 'already_rated' }));
  const { getByTestId, queryByTestId } = sheet({ deps: makeDeps({ submit }) });
  for (const d of ['delivery', 'calorie_fit', 'taste']) fireEvent.press(getByTestId(`order-rate-${d}-4`));
  await act(async () => {
    fireEvent.press(getByTestId('order-rate-send'));
  });
  expect(queryByTestId('order-rate-sent')).toBeNull();
  expect(getByTestId('order-rate-hint').props.children).toBe('Bu siparişi zaten değerlendirdin.');
});

test('hata: fotoğraf yüklenemedi → gönderim yapılmaz, mesaj görünür', async () => {
  const upload = jest.fn(async () => null);
  const submit2 = jest.fn();
  const r2 = sheet({ deps: makeDeps({ upload, submit: submit2 }) });
  for (const d of ['delivery', 'calorie_fit', 'taste']) fireEvent.press(r2.getByTestId(`order-rate-${d}-4`));
  await act(async () => {
    fireEvent.press(r2.getByTestId('order-rate-photo-add'));
  });
  await act(async () => {
    fireEvent.press(r2.getByTestId('order-rate-send'));
  });
  expect(submit2).not.toHaveBeenCalled();
  expect(r2.getByTestId('order-rate-hint').props.children).toBe('Fotoğraf yüklenemedi. Değerlendirmeni fotoğrafsız gönderebilirsin.');
});

test('giriş kartı: istem analitiği bir kez, "Değerlendir" sayfayı açar, gönderim analitiği metinsiz; kart kalkar', async () => {
  const onRated = jest.fn();
  const deps = makeDeps();
  const { getByTestId, queryByTestId, getByText, rerender } = render(<OrderRateEntry prompt={ORDER} surface="order_detail" onRated={onRated} deps={deps} />);
  expect(getByText('Siparişin nasıldı?')).toBeTruthy();
  expect(getByText('KCAL-1234, 7 gün içinde değerlendirebilirsin.')).toBeTruthy();
  expect(queryByTestId('order-rate-card-order_detail-dismiss')).toBeNull(); // detayda kapatma yok
  expect(mockTrack).toHaveBeenCalledWith('order_rate_prompt', { order_id: '42', surface: 'order_detail' });
  rerender(<SafeAreaProvider initialMetrics={METRICS}><OrderRateEntry prompt={ORDER} surface="order_detail" onRated={onRated} deps={deps} /></SafeAreaProvider>);
  expect(mockTrack.mock.calls.filter((c) => c[0] === 'order_rate_prompt')).toHaveLength(1);
  fireEvent.press(getByTestId('order-rate-card-order_detail-cta'));
  for (const d of ['delivery', 'calorie_fit', 'taste']) fireEvent.press(getByTestId(`order-rate-${d}-5`));
  fireEvent.changeText(getByTestId('order-rate-comment'), 'Çok iyiydi');
  await act(async () => {
    fireEvent.press(getByTestId('order-rate-send'));
  });
  const submitCall = mockTrack.mock.calls.find((c) => c[0] === 'order_rate_submit');
  expect(submitCall?.[1]).toMatchObject({ order_id: '42', rating: 5, has_comment: true, has_photo: false, item_count: 0, surface: 'order_detail' });
  expect(JSON.stringify(submitCall)).not.toContain('Çok iyiydi');
  expect(queryByTestId('order-rate-card-order_detail')).toBeNull();
  fireEvent.press(getByTestId('order-rate-done'));
  expect(onRated).toHaveBeenCalledTimes(1);
});

test('Ana sayfa: bayrak KAPALI → hiçbir şey çizilmez, sorgu yok', async () => {
  mockFlags = {};
  const { queryByTestId } = render(<HomeOrderRatePrompt />);
  await act(async () => {});
  expect(queryByTestId('home-order-rate')).toBeNull();
  expect(mockFetchHome).not.toHaveBeenCalled();
});

test('Ana sayfa: bayrak açık + oturumsuz → yok; istem yoksa (değerlendirildi / 7 gün geçti) kart yok', async () => {
  mockFlags = { siparis_degerlendirme: true };
  mockUser = null;
  const a = render(<HomeOrderRatePrompt />);
  await act(async () => {});
  expect(a.queryByTestId('home-order-rate')).toBeNull();
  expect(mockFetchHome).not.toHaveBeenCalled();
  mockUser = { id: 'u1' };
  mockFetchHome.mockResolvedValueOnce(null);
  const b = render(<HomeOrderRatePrompt />);
  await act(async () => {});
  expect(mockFetchHome).toHaveBeenCalledWith('u1', expect.anything());
  expect(b.queryByTestId('home-order-rate')).toBeNull();
});

test('Ana sayfa: istem varsa kart; "Şimdi değil" bu siparişi cihazda kapatır', async () => {
  mockFlags = { siparis_degerlendirme: true };
  mockFetchHome.mockResolvedValueOnce(ORDER);
  const { findByTestId, getByTestId, queryByTestId } = render(<HomeOrderRatePrompt deps={makeDeps()} />);
  await findByTestId('home-order-rate');
  expect(mockTrack).toHaveBeenCalledWith('order_rate_prompt', { order_id: '42', surface: 'home' });
  fireEvent.press(getByTestId('order-rate-card-home-dismiss'));
  expect(mockDismiss).toHaveBeenCalledWith(42);
  expect(queryByTestId('home-order-rate')).toBeNull();
});

test('EN: sayfa ve kart metinleri İngilizce', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { translate } = require('../../../../core/i18n/core');
  expect(translate('en', 'order_rate.title')).toBe('Rate your order');
  expect(translate('en', 'order_rate.need_all')).toBe('Rate all three to send.');
  expect(translate('en', 'order_rate.low_title')).toBe('Was something wrong?');
  expect(translate('en', 'order_rate.card_cta')).toBe('Rate');
  expect(translate('tr', 'order_rate.star_other', { n: 3 })).toBe('3 yıldız');
  expect(translate('en', 'order_rate.star_one', { n: 1 })).toBe('1 star');
});
