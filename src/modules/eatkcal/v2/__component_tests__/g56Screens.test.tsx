// G56-S1 — Filtrelenmiş liste + Davet ekranı (davet / davetBos / davetKopya) + sepet davet kodu satırı.
import React from 'react';
import { act, fireEvent, render as rtlRender, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (ui: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

const mockNavigate = jest.fn();
const mockTrack = jest.fn();
const mockAddItem = jest.fn();
const mockSetString = jest.fn(async () => true);
let mockParams: Record<string, unknown> = {};
let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } };
let mockFlags: Record<string, boolean> = { davet: true };
const mockMyReferral = jest.fn();
const mockApply = jest.fn();
const mockCanApply = jest.fn(async () => true);

jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useRoute: () => ({ params: mockParams }) }));
jest.mock('../nav', () => ({ useEkNav: () => ({ navigate: mockNavigate, goBack: jest.fn() }) }));
jest.mock('../../../../core/supabase', () => {
  const client = { rpc: jest.fn(), from: jest.fn(), auth: { getSession: () => Promise.resolve({ data: { session: null } }) } };
  return { supabase: client, getSupabaseClient: () => client };
});
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => ({ session: mockSession, user: mockSession?.user ?? null }) }));
jest.mock('../../../../core/flags', () => ({ useFeature: (k: string) => !!mockFlags[k] }));
jest.mock('../../../../lib/analytics', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: (...a: unknown[]) => mockSetString(...(a as [])) }));
jest.mock('../../../../store/cartStore', () => ({ useCartStore: (sel: (s: unknown) => unknown) => sel({ addItem: mockAddItem }) }));
jest.mock('../../../../lib/products', () => ({
  fetchProducts: jest.fn(async () => [
    { id: 1, name: 'Tavuk kinoa kase', price: 285, category: "Bowl's", calories: 540, protein: 42, carbs: 48, fats: 16 },
    { id: 2, name: 'Izgara somon', price: 390, category: 'Yüksek Protein', calories: 480, protein: 38, carbs: 12, fats: 28 },
    { id: 3, name: 'Yeşil detoks', price: 120, category: 'Detoks & Shake', calories: 160, protein: 2, carbs: 30, fats: 1 },
  ]),
  fetchProductOptionGroups: jest.fn(async () => []),
}));
jest.mock('../growth/growthApi', () => ({
  fetchMyReferral: () => mockMyReferral(),
  applyReferralCode: (c: string) => mockApply(c),
  fetchCanApplyReferral: () => mockCanApply(),
  fetchReferralSettings: jest.fn(async () => ({ rewardTl: 100, minOrderTl: 300 })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EkListScreen = require('../screens/EkListScreen').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EkInviteScreen = require('../screens/EkInviteScreen').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CartInviteCodeRow } = require('../ui/growth/entries');

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockSession = { user: { id: 'u1' } };
  mockFlags = { davet: true };
});

test('Filtrelenmiş liste: yüksek protein (≥ 30 g) → 2 ürün, çip değişince yeniden süzülür; "+" sepete ekler + bildirim', async () => {
  mockParams = { filter: 'high_protein' };
  const r = render(<EkListScreen />);
  await waitFor(() => expect(r.getByTestId('ek56-list-rows')).toBeTruthy());
  expect(r.getAllByText('Yüksek protein').length).toBeGreaterThan(0);
  expect(r.getByText('2 ürün')).toBeTruthy();
  expect(r.queryByText('Yeşil detoks')).toBeNull();
  fireEvent.press(r.getByTestId('ek56-chip-drinks'));
  expect(r.getByText('Yeşil detoks')).toBeTruthy();
  expect(r.getByText('1 ürün')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getAllByTestId('ek56-list-add')[0]);
  });
  await waitFor(() => expect(mockAddItem).toHaveBeenCalledTimes(1));
  expect(r.getByText('1 ürün sepete eklendi')).toBeTruthy();
});

test('Davet ekranı: kod, ödül, boş geçmiş; kopyala → panoya + "Kod kopyalandı" + referral_share', async () => {
  mockMyReferral.mockResolvedValue({ code: 'AB3K7MQ', rewardTl: 100, minOrderTl: 300, history: [] });
  const r = render(<EkInviteScreen />);
  await waitFor(() => expect(r.getByTestId('ek56-invite-code')).toBeTruthy());
  expect(r.getByText('AB3K7MQ')).toBeTruthy();
  expect(r.getByText('İkinize de 100 TL kupon')).toBeTruthy();
  expect(r.getByText('İkinize de 100 TL kupon tanımlanır')).toBeTruthy();
  expect(r.getByTestId('ek56-invite-empty')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByTestId('ek56-invite-copy'));
  });
  expect(mockSetString).toHaveBeenCalledWith('AB3K7MQ');
  expect(mockTrack).toHaveBeenCalledWith('referral_share', { method: 'copy' });
  expect(r.getByText('Kod kopyalandı')).toBeTruthy();
});

test('Davet ekranı: geçmiş — kazanıldı / bekliyor hapları, geçersiz (void) satır gösterilmez', async () => {
  mockMyReferral.mockResolvedValue({
    code: 'AB3K7MQ',
    rewardTl: 100,
    minOrderTl: null,
    history: [
      { id: 'r1', name: 'Ayşe K.', status: 'earned', createdAt: '2026-11-10T10:00:00Z', earnedAt: '2026-11-12T10:00:00Z' },
      { id: 'r2', name: null, status: 'pending', createdAt: '2026-11-11T10:00:00Z', earnedAt: null },
      { id: 'r3', name: 'Gizli', status: 'void', createdAt: '2026-11-11T10:00:00Z', earnedAt: null },
    ],
  });
  const r = render(<EkInviteScreen />);
  await waitFor(() => expect(r.getByTestId('ek56-invite-history')).toBeTruthy());
  expect(r.getByText('Ayşe K.')).toBeTruthy();
  expect(r.getByText('Kazanıldı')).toBeTruthy();
  expect(r.getByText('Arkadaşın')).toBeTruthy();
  expect(r.getByText('Bekliyor')).toBeTruthy();
  expect(r.queryByText('Gizli')).toBeNull();
});

test('Davet bayrağı kapalı: ekran veri çekmez', async () => {
  mockFlags = { davet: false };
  const r = render(<EkInviteScreen />);
  await waitFor(() => expect(r.getByText('Davet bilgisi yüklenemedi')).toBeTruthy());
  expect(mockMyReferral).not.toHaveBeenCalled();
});

test('Sepet "Davet kodun var mı?": kod girişi, sunucu hatası metni, başarı; bayrak kapalı / siparişi olan → yok', async () => {
  const msg = jest.fn();
  mockApply.mockResolvedValueOnce({ ok: false, error: 'own_code' }).mockResolvedValueOnce({ ok: true });
  const r = render(<CartInviteCodeRow onMessage={msg} />);
  await waitFor(() => expect(r.getByTestId('ek56-cart-invite')).toBeTruthy());
  fireEvent.press(r.getByText('Davet kodun var mı?'));
  fireEvent.changeText(r.getByTestId('ek56-cart-invite-input'), 'ab1');
  await act(async () => {
    fireEvent.press(r.getByTestId('ek56-cart-invite-apply'));
  });
  expect(msg).toHaveBeenLastCalledWith('Bu davet kodu geçerli değil.');
  expect(mockApply).not.toHaveBeenCalled();
  fireEvent.changeText(r.getByTestId('ek56-cart-invite-input'), 'ab3k7mq');
  await act(async () => {
    fireEvent.press(r.getByTestId('ek56-cart-invite-apply'));
  });
  expect(mockApply).toHaveBeenCalledWith('AB3K7MQ');
  expect(msg).toHaveBeenLastCalledWith('Kendi davet kodunu kullanamazsın.');
  expect(mockTrack).toHaveBeenCalledWith('referral_apply', { result: 'own_code', where: 'cart' });
  await act(async () => {
    fireEvent.press(r.getByTestId('ek56-cart-invite-apply'));
  });
  expect(r.getByTestId('ek56-cart-invite-done')).toBeTruthy();
  expect(mockTrack).toHaveBeenCalledWith('referral_apply', { result: 'ok', where: 'cart' });

  mockCanApply.mockResolvedValueOnce(false);
  const r2 = render(<CartInviteCodeRow onMessage={msg} />);
  await waitFor(() => expect(mockCanApply).toHaveBeenCalled());
  expect(r2.queryByTestId('ek56-cart-invite')).toBeNull();

  mockFlags = { davet: false };
  const r3 = render(<CartInviteCodeRow onMessage={msg} />);
  expect(r3.queryByTestId('ek56-cart-invite')).toBeNull();
});
