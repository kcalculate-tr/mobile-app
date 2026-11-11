// G22-S1 md.4 — abonelik ekranları: FinSubPaywall (4 kart, yerel fiyat, deneme CTA, zorunlu
// yenileme metni, VoiceOver tek ayarlanabilir öğe, fiyat yoksa FinSubError, satın alma sonuçları),
// FinSubLimitAI/Barcode (karolar sunucu limitleriyle; abonelik kapalıyken plan yok), FinSubPill,
// Profil › Abonelik (Ücretsiz/Deneme).
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking, Platform, StyleSheet } from 'react-native';

import { buildPlanCards, type StoreProductLike } from '../../../lib/subscription/plans';
import { DEMO_PRICES_TRY as D } from '../../../lib/subscription/demoPrices';
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
  // G27-S1: mağaza fiyatları tek kaynaktan (Fresh aylık 199).
  P('kcalai_fresh_monthly', D.fresh_monthly),
  P('kcalai_fresh_yearly', D.fresh_yearly, trial),
  P('kcalai_balance_monthly', D.balance_monthly),
  P('kcalai_balance_yearly', D.balance_yearly, trial),
]);
let mockCards: typeof CARDS = CARDS;
let mockLoading = false;
const mockReload = jest.fn();
jest.mock('../../../lib/subscription/usePlanCards', () => ({
  usePlanCards: () => ({ cards: mockCards, loading: mockLoading, failed: !mockLoading && !mockCards, reload: mockReload }),
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
  mockLoading = false;
  mockParams = undefined;
  useSubscriptionStore.setState({ available: true, rc: null, server: null, limits: LIMITS, ai: null, barcode: null });
});

// G33-S1 md.2 (Tur 26n): paywall kademe başına iki dikey kart (Yıllık / Aylık, radyo grubu) + "Balance'a yükselt" /
// "Fresh'e dön"; büyük başlık yalnız "Fresh"/"Balance", "kcalAI" küçük etiket. Önceki 4'lü yatay dizi testleri
// bu düzene taşındı (aynı amaçlar: yerel fiyat, deneme CTA, zorunlu yenileme, VoiceOver, koçlu varyant).
test('Paywall: Fresh varsayılan — büyük başlık "Fresh", kcalAI küçük etiket, Yıllık "%58 tasarruf" + "7 gün ücretsiz" + "ayda 83 TL", deneme CTA', () => {
  const tree = render(<PaywallScreen />);
  expect(tree.getByTestId('sub-title').props.children).toBe('Fresh');
  expect(tree.getByTestId('sub-brand').props.children).toBe('kcalAI');
  expect(tree.getByTestId('sub-card-fresh_yearly')).toBeTruthy();
  expect(tree.getByTestId('sub-card-fresh_monthly')).toBeTruthy();
  expect(tree.queryByTestId('sub-card-balance_yearly')).toBeNull();
  expect(tree.getByText('999,99 TL/yıl')).toBeTruthy();
  expect(tree.getByText('199,99 TL/ay')).toBeTruthy();
  expect(tree.getByText('ayda 83 TL')).toBeTruthy();
  expect(tree.getByText('%58 tasarruf')).toBeTruthy();
  expect(tree.queryByText('%44 tasarruf')).toBeNull();
  expect(tree.getAllByText('7 gün ücretsiz').length).toBeGreaterThan(0);
  expect(tree.queryByText(/₺/, H)).toBeNull();
  expect(tree.getByText('7 gün ücretsiz başla')).toBeTruthy();
  expect(tree.getByTestId('sub-summary').props.children).toBe('7 gün ücretsiz, sonra 999,99 TL/yıl. Ücret deneme bitince alınır.');
  expect(tree.getByText(/otomatik yenilenir/)).toBeTruthy();
  expect(tree.getByText('Satın alımları geri yükle')).toBeTruthy();
  expect(tree.getByText('Kullanım Koşulları (EULA)')).toBeTruthy();
  expect(tree.getByText('Gizlilik Politikası')).toBeTruthy();
  expect(tree.getByTestId('sub-upgrade-balance')).toBeTruthy();
  expect(tree.getByText('Balance’a yükselt')).toBeTruthy();
  expect(tree.getByText('Sesle ekle')).toBeTruthy();
  expect(tree.queryByText(/Sınırsız AI/i)).toBeNull();
  expect(tree.queryByText(/fitness/i)).toBeNull();
  expect(tree.getByTestId('sub-glow', H)).toBeTruthy();
});

test('Paywall: Balance’a yükselt → başlık "Balance", %50 tasarruf, ayda 250 TL, "Fresh’e dön"; Aylık seçilince "Devam et"', async () => {
  const tree = render(<PaywallScreen />);
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-upgrade-balance'));
  });
  expect(tree.getByTestId('sub-title').props.children).toBe('Balance');
  expect(tree.getByText('2999,99 TL/yıl')).toBeTruthy();
  expect(tree.getByText('%50 tasarruf')).toBeTruthy();
  expect(tree.getByText('ayda 250 TL')).toBeTruthy();
  expect(tree.getByText('Günde 50 AI tarama')).toBeTruthy();
  expect(tree.getByText('Barkod sınırsız')).toBeTruthy();
  expect(tree.getByText('Elle giriş sınırsız')).toBeTruthy();
  // Radyo grubu: yıllık seçili.
  expect(tree.getByTestId('sub-cards').props.accessibilityRole).toBe('radiogroup');
  expect(tree.getByTestId('sub-card-balance_yearly').props.accessibilityState).toMatchObject({ checked: true });
  expect(tree.getByTestId('sub-card-balance_yearly').props.accessibilityLabel).toBe('Yıllık, 2999,99 TL/yıl, 7 gün ücretsiz, %50 tasarruf');
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-card-balance_monthly'));
  });
  expect(tree.getByTestId('sub-card-balance_monthly').props.accessibilityState).toMatchObject({ checked: true });
  expect(tree.getByText('Devam et')).toBeTruthy();
  expect(tree.getByTestId('sub-summary').props.children).toBe('499,99 TL/ay, her ay otomatik yenilenir.');
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-back-fresh'));
  });
  expect(tree.getByTestId('sub-title').props.children).toBe('Fresh');
  mockPurchase.mockResolvedValue('cancelled');
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-cta'));
  });
  expect(mockPurchase).toHaveBeenCalledWith('fresh_monthly');
});

test('G24-S1 Paywall koçlu varyant: Balance Yıllık seçili, şeritte "kcalAI Koç", Balance kartlarında "kcalAI Koç dahil"', () => {
  mockParams = { coach: true, from: 'coach', plan: 'fresh', yearly: false };
  const tree = render(<PaywallScreen />);
  expect(tree.getByTestId('sub-title').props.children).toBe('Balance');
  expect(tree.getByTestId('sub-card-balance_yearly').props.accessibilityState).toMatchObject({ checked: true });
  expect(tree.getByTestId('sub-card-balance_yearly').props.accessibilityLabel).toBe('Yıllık, 2999,99 TL/yıl, 7 gün ücretsiz, %50 tasarruf, kcalAI Koç dahil');
  expect(tree.getByText('kcalAI Koç')).toBeTruthy();
  expect(tree.getByText(/günde 30 mesaj\. Tıbbi tavsiye vermez\./)).toBeTruthy();
  expect(tree.getByTestId('sub-card-coach-balance_yearly')).toBeTruthy();
  expect(tree.getByTestId('sub-card-coach-balance_monthly')).toBeTruthy();
});

test('G24-S1 Paywall koçsuz (koc kapalı, diğer girişler): Balance’ta bile koç sayfası/satırı YOK', async () => {
  mockParams = { plan: 'balance' };
  const tree = render(<PaywallScreen />);
  expect(tree.getByTestId('sub-title').props.children).toBe('Balance');
  expect(tree.queryByText('kcalAI Koç')).toBeNull();
  expect(tree.queryByText(/kcalAI Koç dahil/, H)).toBeNull();
});

test('G25 md.5: fiyat gelmezse aynı ekranda hata kartı + Tekrar dene (yedek fiyat YOK, geri yükle ve bağlantılar yerinde)', () => {
  mockCards = null;
  const tree = render(<PaywallScreen />);
  expect(tree.getByTestId('sub-load-error')).toBeTruthy();
  expect(tree.getByText('Planlar yüklenemedi')).toBeTruthy();
  expect(tree.queryByText('Satın alma tamamlanamadı')).toBeNull();
  expect(tree.queryByText(/TL/)).toBeNull();
  expect(tree.queryByTestId('sub-cta')).toBeNull();
  expect(tree.getByTestId('sub-restore')).toBeTruthy();
  expect(tree.getByTestId('sub-eula')).toBeTruthy();
  expect(StyleSheet.flatten(tree.getByTestId('sub-load-retry').props.style).minHeight).toBeGreaterThanOrEqual(44);
  fireEvent.press(tree.getByTestId('sub-load-retry'));
  expect(mockReload).toHaveBeenCalled();
});

test('G25 md.5: fiyat yüklenirken kart iskeleti + "Planlar yükleniyor", CTA meşgul, boş alan yok', () => {
  mockCards = null;
  mockLoading = true;
  const tree = render(<PaywallScreen />);
  const sk = tree.getByTestId('sub-cards-loading');
  expect(sk.props.accessibilityLabel).toBe('Planlar yükleniyor');
  expect(sk.props.accessibilityState).toEqual({ busy: true });
  expect(tree.queryByTestId('sub-load-error')).toBeNull();
  expect(tree.queryByTestId('sub-cards')).toBeNull();
  const cta = tree.getByTestId('sub-cta');
  expect(cta.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  expect(tree.getAllByText('Planlar yükleniyor').length).toBeGreaterThanOrEqual(2);
});

test('G25 md.5: Geri yükle sürerken meşgul (çift dokunma yok), bitince sonuç metni', async () => {
  let done: (v: string) => void = () => {};
  mockRestore.mockImplementationOnce(() => new Promise((r) => (done = r)));
  const tree = render(<PaywallScreen />);
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-restore'));
  });
  expect(tree.getByText('Geri yükleniyor…')).toBeTruthy();
  expect(tree.getByTestId('sub-restore').props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  fireEvent.press(tree.getByTestId('sub-restore'));
  expect(mockRestore).toHaveBeenCalledTimes(1);
  await act(async () => {
    done('none');
  });
  expect(tree.getByText('Geri yüklenecek satın alım bulunamadı.')).toBeTruthy();
  expect(tree.getByText('Satın alımları geri yükle')).toBeTruthy();
});

test('G25 md.2 + G28 md.7: Paywall + Profil › Abonelik — "Kullanım Koşulları (EULA)" (iOS Apple EULA) yanında Gizlilik (legal.eatkcal.com)', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
  const web = jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue({ type: 'opened' } as never);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  for (const el of [<PaywallScreen key="p" />, <SubProfileScreen key="s" />]) {
    const tree = render(el);
    expect(tree.getByText('Kullanım Koşulları (EULA)')).toBeTruthy();
    expect(tree.getByText('Gizlilik Politikası')).toBeTruthy();
    expect(tree.getByTestId('sub-eula').props.accessibilityRole).toBe('link');
    await act(async () => {
      fireEvent.press(tree.getByTestId('sub-eula'));
    });
    await act(async () => {
      fireEvent.press(tree.getByTestId('sub-privacy'));
    });
    tree.unmount();
  }
  expect(open).toHaveBeenCalledWith('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
  expect(open).toHaveBeenCalledTimes(2);
  expect(web).toHaveBeenCalledWith('https://legal.eatkcal.com/gizlilik-politikasi');
  expect(web).toHaveBeenCalledTimes(2);
  expect(mockNav.navigate).not.toHaveBeenCalledWith('ProfileContracts', { slug: 'gizlilik-politikasi' });
  open.mockRestore();
  web.mockRestore();
});

test('G28 md.7: web sayfası açılamazsa uygulama içi Gizlilik metni', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
  const web = jest.spyOn(WebBrowser, 'openBrowserAsync').mockRejectedValue(new Error('no'));
  const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no'));
  const tree = render(<PaywallScreen />);
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-privacy'));
  });
  expect(mockNav.navigate).toHaveBeenCalledWith('ProfileContracts', { slug: 'gizlilik-politikasi' });
  open.mockRestore();
  web.mockRestore();
});

test('G25 md.2 + G28 md.7: Android — EULA bağlantısı legal.eatkcal.com Kullanım Koşulları', async () => {
  const prev = Platform.OS;
  Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
    const web = jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue({ type: 'opened' } as never);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const tree = render(<PaywallScreen />);
    await act(async () => {
      fireEvent.press(tree.getByTestId('sub-eula'));
    });
    expect(open).not.toHaveBeenCalled();
    expect(web).toHaveBeenCalledWith('https://legal.eatkcal.com/kullanim-kosullari');
    open.mockRestore();
    web.mockRestore();
  } finally {
    Object.defineProperty(Platform, 'OS', { get: () => prev, configurable: true });
  }
});

test('Paywall: satın alma sonuçları — iptal / bekliyor / başarı', async () => {
  mockPurchase.mockResolvedValueOnce('cancelled');
  // G33-S1: varsayılan kademe Fresh (Ücretsiz kullanıcı); Balance'a hak sheet'inden plan: 'balance' ile gelinir.
  mockParams = { plan: 'balance' };
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
  // G26-S1: başlık "Balance etkin" (kcalAI büyük başlıkta YOK), kcalAI küçük hapta.
  const title = tree.getByTestId('sub-result-title');
  const flat = (n: unknown): string =>
    typeof n === 'string' ? n : Array.isArray(n) ? n.map(flat).join('') : n && typeof n === 'object' && 'props' in (n as object) ? flat((n as { props: { children: unknown } }).props.children) : '';
  expect(flat(title.props.children)).toBe('Balance etkin');
  expect(flat(tree.getByTestId('sub-result-brand').props.children)).toContain('kcalAI');
  expect(tree.getByText('Günde 50')).toBeTruthy();
  expect(tree.queryByText(/adil kullanım/)).toBeNull();
  expect(tree.getByText(/7 günlük ücretsiz denemen başladı/)).toBeTruthy();
});

test('Hak sheet AI (G23-S1): karolar 2 · 10 · 50 + aylık yerel fiyat; Planları gör / Elle ekle', () => {
  const onPlans = jest.fn();
  const onManual = jest.fn();
  const tree = render(
    <SubLimitSheet visible kind="ai" limits={LIMITS} tier="free" cap={2} prices={{ fresh: '199,99 TL', balance: '499,99 TL' }} plansEnabled onPlans={onPlans} onManual={onManual} onClose={() => {}} />,
  );
  expect(tree.getByText('Bugünkü 2 AI taramanı kullandın')).toBeTruthy();
  expect(tree.getByText(/Fresh ile günde 10, Balance ile günde 50 AI tarama/)).toBeTruthy();
  expect(tree.getByText('Günde 2')).toBeTruthy();
  expect(tree.getByText('Günde 10')).toBeTruthy();
  expect(tree.getByText('Günde 50')).toBeTruthy();
  expect(tree.queryByText('Sınırsız')).toBeNull();
  expect(tree.getByText('499,99 TL/ay')).toBeTruthy();
  expect(tree.getByText('Şu anki plan')).toBeTruthy();
  expect(tree.getByText('199,99 TL/ay')).toBeTruthy();
  expect(tree.getByText('Barkod ve elle giriş açık')).toBeTruthy();
  fireEvent.press(tree.getByTestId('sub-limit-plans'));
  fireEvent.press(tree.getByTestId('sub-limit-manual'));
  expect(onPlans).toHaveBeenCalled();
  expect(onManual).toHaveBeenCalled();
});

test('Hak sheet Barkod: 5 · Sınırsız · Sınırsız; abonelik kapalıyken plan/karo YOK', () => {
  let tree = render(
    <SubLimitSheet visible kind="barcode" limits={LIMITS} tier="free" cap={5} prices={{ fresh: '199,99 TL', balance: '499,99 TL' }} plansEnabled onPlans={() => {}} onManual={() => {}} onClose={() => {}} />,
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
  // G26-S1: büyük ad yalnız plan adı; "kcalAI" üst satırda küçük etiket.
  expect(tree.getByTestId('sub-profile-name').props.children).toBe('Fresh');
  expect(tree.getByTestId('sub-profile-cap').props.children).toBe('Mevcut kcalAI planın');
  expect(tree.getByText('Deneme sonrası 999,99 TL/yıl')).toBeTruthy();
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
  expect(tree.getByTestId('sub-profile-name').props.children).toBe('Balance');
  expect(tree.getByText('Bugün 48/50')).toBeTruthy();
  expect(tree.getByText('50')).toBeTruthy();
  expect(tree.getByText('499,99 TL/ay')).toBeTruthy();
  expect(tree.queryByText(/adil kullanım/)).toBeNull();
});

test('G26-S1: plan adı büyük başlıklarda yalnız Fresh / Balance (TR + EN); kcalAI yalnız küçük etiket', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tr: subTr, en: subEn } = require('../../../lib/subscription/i18n');
  for (const d of [subTr, subEn]) {
    const sub = d as unknown as Record<string, Record<string, string>> & { brand: string };
    expect(sub.result.ok_title).not.toMatch(/kcalAI/);
    expect(sub.profile.paid_name).toBe('%{plan}');
    expect(sub.paywall.fresh).toBe('Fresh');
    expect(sub.paywall.balance).toBe('Balance');
    expect(sub.brand).toBe('kcalAI');
    expect(sub.profile.current_paid).toMatch(/kcalAI/);
  }
});
