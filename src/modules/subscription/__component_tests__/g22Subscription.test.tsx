// G22-S1 md.4 — abonelik ekranları: FinSubPaywall (4 kart, yerel fiyat, deneme CTA, zorunlu
// yenileme metni, VoiceOver tek ayarlanabilir öğe, fiyat yoksa FinSubError, satın alma sonuçları),
// FinSubLimitAI/Barcode (karolar sunucu limitleriyle; abonelik kapalıyken plan yok), FinSubPill,
// Profil › Abonelik (Ücretsiz/Deneme).
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { buildPlanCards, type StoreProductLike } from '../../../lib/subscription/plans';
import { limitsFromSettings } from '../../../lib/subscription/limits';
import { useSubscriptionStore } from '../../../lib/subscription/purchases';

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), setOptions: jest.fn() };
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) }));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets };
});
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

const trial = { price: 0, periodNumberOfUnits: 7, periodUnit: 'DAY' };
const P = (identifier: string, price: number, intro?: StoreProductLike['introPrice']): StoreProductLike => ({
  identifier,
  price,
  priceString: `₺${price}`,
  currencyCode: 'TRY',
  introPrice: intro ?? null,
});
const CARDS = buildPlanCards([
  P('kcalai_fresh_monthly', 149),
  P('kcalai_fresh_yearly', 999, trial),
  P('kcalai_balance_monthly', 499),
  P('kcalai_balance_yearly', 2999, trial),
]);
let mockCards: typeof CARDS = CARDS;
const mockReload = jest.fn();
jest.mock('../../../lib/subscription/usePlanCards', () => ({
  usePlanCards: () => ({ cards: mockCards, loading: false, failed: !mockCards, reload: mockReload }),
  monthlyPriceOf: (cards: { tier: string; yearly: boolean; priceText: string }[] | null, tier: string) =>
    cards?.find((c) => c.tier === tier && !c.yearly)?.priceText ?? null,
  setPlanCardsMemo: () => {},
}));
const mockPurchase = jest.fn();
const mockRestore = jest.fn();
jest.mock('../../../lib/subscription/purchases', () => {
  const actual = jest.requireActual('../../../lib/subscription/purchases');
  return {
    ...actual,
    purchasePlan: (k: string) => mockPurchase(k),
    restorePurchases: () => mockRestore(),
    refreshEntitlement: () => Promise.resolve(),
    manageSubscription: () => Promise.resolve(),
  };
});

// eslint-disable-next-line import/first
import PaywallScreen from '../screens/PaywallScreen';
// eslint-disable-next-line import/first
import SubLimitSheet from '../ui/SubLimitSheet';
// eslint-disable-next-line import/first
import SubPill from '../ui/SubPill';
// eslint-disable-next-line import/first
import SubProfileScreen, { trialDaysLeft } from '../screens/SubProfileScreen';

// Kartlar tek ayarlanabilir öğenin içinde (VoiceOver'da ayrı odak yok) → sorguda gizli öğeler dahil.
const H = { includeHiddenElements: true } as const;

const LIMITS = limitsFromSettings([
  { key: 'ai_daily_free', value: 2 },
  { key: 'ai_daily_fresh', value: 10 },
  { key: 'ai_daily_balance', value: 50 },
  { key: 'barcode_daily_free', value: 5 },
]);

beforeEach(() => {
  jest.clearAllMocks();
  mockCards = CARDS;
  mockParams = undefined;
  useSubscriptionStore.setState({ available: true, rc: null, server: null, limits: LIMITS, ai: null, barcode: null });
});

test('Paywall: 4 kart yerel fiyatla (₺ yok), varsayılan Balance Yıllık, deneme CTA + zorunlu yenileme metni', () => {
  const tree = render(<PaywallScreen />);
  for (const k of ['fresh_monthly', 'fresh_yearly', 'balance_monthly', 'balance_yearly']) expect(tree.getByTestId(`sub-card-${k}`, H)).toBeTruthy();
  expect(tree.getAllByText('2999 TL', H).length).toBeGreaterThan(0);
  expect(tree.queryByText(/₺/, H)).toBeNull();
  expect(tree.getByText('7 gün ücretsiz başla')).toBeTruthy();
  expect(tree.getByTestId('sub-summary').props.children).toBe('7 gün ücretsiz, sonra 2999 TL/yıl. Ücret deneme bitince alınır.');
  expect(tree.getByText(/otomatik yenilenir/)).toBeTruthy();
  expect(tree.getByText('Satın alımları geri yükle')).toBeTruthy();
  expect(tree.getByText('Kullanım Koşulları')).toBeTruthy();
  expect(tree.getByText('Gizlilik Politikası')).toBeTruthy();
  expect(tree.getByText('En çok seçilen', H)).toBeTruthy();
  expect(tree.getByText('-%50', H)).toBeTruthy();
  // Balance şeridi (yalnız çalışan özellikler; AI koç / fitness YOK). G23-S1: günde 50, "Sınırsız AI" YOK.
  expect(tree.getByText('Günde 50 AI tarama')).toBeTruthy();
  expect(tree.queryByText(/Sınırsız AI/i)).toBeNull();
  expect(tree.queryByText(/AI koç|fitness/i)).toBeNull();
});

test('Paywall: VoiceOver kart dizisi TEK ayarlanabilir öğe; artır/azalt planı değiştirir, CTA Aylık "Devam et"', async () => {
  const tree = render(<PaywallScreen />);
  const cards = tree.getByTestId('sub-cards');
  expect(cards.props.accessibilityRole).toBe('adjustable');
  expect(cards.props.accessibilityValue.text).toBe('Balance Yıllık, 2999 TL, 7 gün ücretsiz, 4/4');
  await act(async () => {
    fireEvent(cards, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  });
  // Azaltılmış hareket yok → kaydırma bitince seçilir; testte doğrudan kart dokunuşu.
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-card-balance_monthly', H));
  });
  await act(async () => {
    fireEvent(tree.UNSAFE_getByProps({ snapToInterval: 261 }), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 2 * 261 } } });
  });
  expect(tree.getByTestId('sub-cards').props.accessibilityValue.text).toBe('Balance Aylık, 499 TL, 3/4');
  expect(tree.getByText('Devam et')).toBeTruthy();
  expect(tree.getByTestId('sub-summary').props.children).toBe('499 TL/ay, her ay otomatik yenilenir.');
  expect(tree.getByText('Sesle ekle')).toBeTruthy();
  // G24-S1 (Tur 26k): şerit 3 "Barkod sınırsız" · 4 "Elle giriş sınırsız".
  expect(tree.getByText('Barkod sınırsız')).toBeTruthy();
  expect(tree.getByText('Elle giriş sınırsız')).toBeTruthy();
  expect(tree.queryByText('Barkodla ekle')).toBeNull();
  expect(tree.queryByText('Barkod ve elle giriş sınırsız')).toBeNull();
});

test('G24-S1 Paywall koçlu varyant: Balance Yıllık seçili, şeritte 5. sayfa "kcalAI Koç", Balance kartlarında "kcalAI Koç dahil"', () => {
  mockParams = { coach: true, from: 'coach', plan: 'fresh', yearly: false };
  const tree = render(<PaywallScreen />);
  expect(tree.getByTestId('sub-cards').props.accessibilityValue.text).toBe('Balance Yıllık, 2999 TL, 7 gün ücretsiz, kcalAI Koç dahil, 4/4');
  expect(tree.getByText('kcalAI Koç')).toBeTruthy();
  expect(tree.getByText(/günde 30 mesaj\. Tıbbi tavsiye vermez\./)).toBeTruthy();
  expect(tree.getByTestId('sub-card-coach-balance_yearly', H)).toBeTruthy();
  expect(tree.getByTestId('sub-card-coach-balance_monthly', H)).toBeTruthy();
  expect(tree.queryByTestId('sub-card-coach-fresh_yearly', H)).toBeNull();
});

test('G24-S1 Paywall koçsuz (diğer girişler): 4 sayfa, koç satırı YOK', () => {
  const tree = render(<PaywallScreen />);
  expect(tree.queryByText('kcalAI Koç')).toBeNull();
  expect(tree.queryByText(/kcalAI Koç dahil/, H)).toBeNull();
});

test('Paywall: fiyat gelmezse FinSubError (yedek fiyat YOK) + Tekrar dene', () => {
  mockCards = null;
  const tree = render(<PaywallScreen />);
  expect(tree.getByTestId('sub-result-error')).toBeTruthy();
  expect(tree.getByText('Satın alma tamamlanamadı')).toBeTruthy();
  expect(tree.queryByText(/TL/)).toBeNull();
  fireEvent.press(tree.getByTestId('sub-result-primary'));
  expect(mockReload).toHaveBeenCalled();
});

test('Paywall: satın alma sonuçları — iptal / bekliyor / başarı', async () => {
  mockPurchase.mockResolvedValueOnce('cancelled');
  let tree = render(<PaywallScreen />);
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-cta'));
  });
  expect(mockPurchase).toHaveBeenCalledWith('balance_yearly');
  expect(tree.getByText('Satın alma iptal edildi')).toBeTruthy();
  fireEvent.press(tree.getByText('Planlara dön'));
  expect(tree.getByTestId('sub-paywall')).toBeTruthy();
  tree.unmount();

  mockPurchase.mockResolvedValueOnce('pending');
  tree = render(<PaywallScreen />);
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-cta'));
  });
  expect(tree.getByText('Onay bekleniyor')).toBeTruthy();
  expect(tree.getByText('✓ Bu sırada Ücretsiz planla devam ediyorsun')).toBeTruthy();
  tree.unmount();

  mockPurchase.mockResolvedValueOnce('success');
  useSubscriptionStore.setState({ rc: { tier: 'balance', productId: 'kcalai_balance_yearly', expiresAt: '2026-11-17T10:00:00Z', willRenew: true, trial: true, store: 'APP_STORE', managementURL: null } });
  tree = render(<PaywallScreen />);
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-cta'));
  });
  await waitFor(() => expect(tree.getByTestId('sub-result-success')).toBeTruthy());
  expect(tree.getByText('etkin')).toBeTruthy();
  expect(tree.getByText('Günde 50')).toBeTruthy();
  expect(tree.queryByText(/adil kullanım/)).toBeNull();
  expect(tree.getByText(/7 günlük ücretsiz denemen başladı/)).toBeTruthy();
});

test('Hak sheet AI (G23-S1): karolar 2 · 10 · 50 + aylık yerel fiyat; Planları gör / Elle ekle', () => {
  const onPlans = jest.fn();
  const onManual = jest.fn();
  const tree = render(
    <SubLimitSheet visible kind="ai" limits={LIMITS} tier="free" cap={2} prices={{ fresh: '149 TL', balance: '499 TL' }} plansEnabled onPlans={onPlans} onManual={onManual} onClose={() => {}} />,
  );
  expect(tree.getByText('Bugünkü 2 AI taramanı kullandın')).toBeTruthy();
  expect(tree.getByText(/Fresh ile günde 10, Balance ile günde 50 AI tarama/)).toBeTruthy();
  expect(tree.getByText('Günde 2')).toBeTruthy();
  expect(tree.getByText('Günde 10')).toBeTruthy();
  expect(tree.getByText('Günde 50')).toBeTruthy();
  expect(tree.queryByText('Sınırsız')).toBeNull();
  expect(tree.getByText('499 TL/ay')).toBeTruthy();
  expect(tree.getByText('Şu anki plan')).toBeTruthy();
  expect(tree.getByText('149 TL/ay')).toBeTruthy();
  expect(tree.getByText('Barkod ve elle giriş açık')).toBeTruthy();
  fireEvent.press(tree.getByTestId('sub-limit-plans'));
  fireEvent.press(tree.getByTestId('sub-limit-manual'));
  expect(onPlans).toHaveBeenCalled();
  expect(onManual).toHaveBeenCalled();
});

test('Hak sheet Barkod: 5 · Sınırsız · Sınırsız; abonelik kapalıyken plan/karo YOK', () => {
  let tree = render(
    <SubLimitSheet visible kind="barcode" limits={LIMITS} tier="free" cap={5} prices={{ fresh: '149 TL', balance: '499 TL' }} plansEnabled onPlans={() => {}} onManual={() => {}} onClose={() => {}} />,
  );
  expect(tree.getByText('Bugünkü 5 barkod taramanı kullandın')).toBeTruthy();
  expect(tree.getByText('Günde 5')).toBeTruthy();
  expect(tree.getAllByText('Sınırsız').length).toBe(2);
  expect(tree.getByText('Elle giriş her planda sınırsız')).toBeTruthy();
  tree.unmount();
  tree = render(
    <SubLimitSheet visible kind="barcode" limits={LIMITS} tier="free" cap={5} plansEnabled={false} onPlans={() => {}} onManual={() => {}} onClose={() => {}} />,
  );
  expect(tree.queryByTestId('sub-limit-plans')).toBeNull();
  expect(tree.queryByText('Günde 5')).toBeNull();
  expect(tree.getByText('Hakkın gece 00:00’da yenilenir. Bu arada ürünü elle ekleyebilirsin.')).toBeTruthy();
});

test('Hak hapı: metin + VoiceOver etiketi', () => {
  const tree = render(<SubPill label="Bugün 1/2" a11y="Bugün 2 AI taramadan 1 hakkın kaldı" />);
  expect(tree.getByText('Bugün 1/2')).toBeTruthy();
  expect(tree.getByLabelText('Bugün 2 AI taramadan 1 hakkın kaldı')).toBeTruthy();
});

test('Profil › Abonelik: Ücretsiz (2 · 5 · Sınırsız, Planları gör) ve Fresh deneme (kalan gün, deneme bitişi, yönet)', () => {
  useSubscriptionStore.setState({ ai: { kind: 'ai', tier: 'free', remaining: 1, limit: 2, unlimited: false, resetAt: null } });
  let tree = render(<SubProfileScreen />);
  expect(tree.getByTestId('sub-profile-name').props.children).toBe('Ücretsiz');
  expect(tree.getByText('Abonelik yok')).toBeTruthy();
  expect(tree.getByText('Bugün 1/2')).toBeTruthy();
  expect(tree.getByText('2')).toBeTruthy();
  expect(tree.getByText('5')).toBeTruthy();
  expect(tree.getByText('Planları gör')).toBeTruthy();
  expect(tree.queryByTestId('sub-profile-manage')).toBeNull();
  fireEvent.press(tree.getByTestId('sub-profile-plans'));
  expect(mockNav.navigate).toHaveBeenCalledWith('SubPaywall', { from: 'profile' });
  tree.unmount();

  const exp = new Date(Date.now() + 3 * 864e5 - 60_000).toISOString();
  useSubscriptionStore.setState({
    rc: { tier: 'fresh', productId: 'kcalai_fresh_yearly', expiresAt: exp, willRenew: true, trial: true, store: 'APP_STORE', managementURL: null },
    server: null,
    ai: { kind: 'ai', tier: 'fresh', remaining: 9, limit: 10, unlimited: false, resetAt: null },
  });
  tree = render(<SubProfileScreen />);
  expect(tree.getByTestId('sub-profile-name').props.children).toBe('kcalAI Fresh');
  expect(tree.getByText('Deneme sonrası 999 TL/yıl')).toBeTruthy();
  expect(tree.getByText('3 gün deneme kaldı')).toBeTruthy();
  expect(tree.getByText('Bugün 9/10')).toBeTruthy();
  expect(tree.getByText('Deneme bitişi')).toBeTruthy();
  expect(tree.getByText('10')).toBeTruthy();
  expect(tree.getByText('Planı değiştir')).toBeTruthy();
  expect(tree.getByTestId('sub-profile-manage')).toBeTruthy();
  expect(trialDaysLeft(null)).toBeNull();
  tree.unmount();

  // G23-S1: Balance → hap "Bugün N/50" (Sınırsız hâli kalktı), AI satırı 50; Google ürün kimliği.
  useSubscriptionStore.setState({
    rc: { tier: 'balance', productId: 'kcalai_balance:monthly', expiresAt: exp, willRenew: true, trial: false, store: 'PLAY_STORE', managementURL: null },
    server: null,
    ai: { kind: 'ai', tier: 'balance', remaining: 48, limit: 50, unlimited: false, resetAt: null },
  });
  tree = render(<SubProfileScreen />);
  expect(tree.getByTestId('sub-profile-name').props.children).toBe('kcalAI Balance');
  expect(tree.getByText('Bugün 48/50')).toBeTruthy();
  expect(tree.getByText('50')).toBeTruthy();
  expect(tree.getByText('499 TL/ay')).toBeTruthy();
  expect(tree.queryByText(/adil kullanım/)).toBeNull();
});
