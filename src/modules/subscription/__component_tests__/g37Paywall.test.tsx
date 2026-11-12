// G37-S1 (İlter 12 Kas TestFlight) — Paywall:
// md.1 zemin STATİK, tam ekran (safe area dahil taşar), dikdörtgen/kenar yok; Light/Dark.
// md.2 karusel 3 kaydırmada üst ikonun süzülmesi yeniden başlamıyor (tek bileşen, paylaşılan değer
//      sürekliliği), yalnız görünen görsel değişiyor; azaltılmış harekette süzülme yok.
// md.3 fiyat biçimi TRY ve USD (mağaza para birimi).
import React from 'react';
import { act, fireEvent, render, type RenderAPI } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';

import { buildPlanCards, type StoreProductLike } from '../../../lib/subscription/plans';
import { limitsFromSettings } from '../../../lib/subscription/limits';
import { useSubscriptionStore } from '../../../lib/subscription/purchases';

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), setOptions: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: undefined }) }));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  return { useSafeAreaInsets: () => insets };
});
// Reanimated taklidi + gerçek davranış: useSharedValue render'lar arasında AYNI nesne (gerçek kitaplıktaki
// gibi; resmi taklit her render'da yenisini üretir). withRepeat / cancelAnimation sayılır → süzülme
// döngüsünün yeniden kurulup kurulmadığı ölçülür.
const mockWithRepeat = jest.fn();
const mockCancel = jest.fn();
jest.mock('react-native-reanimated', () => {
  const R = jest.requireActual('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('react-native-reanimated/mock');
  return {
    ...m,
    useSharedValue: (init: unknown) => {
      const ref = R.useRef<unknown>(null);
      if (ref.current === null) ref.current = m.useSharedValue(init);
      return ref.current;
    },
    withRepeat: (a: unknown, ...rest: unknown[]) => {
      mockWithRepeat(a, ...rest);
      return a;
    },
    cancelAnimation: (v: unknown) => mockCancel(v),
  };
});

const trial = { price: 0, periodNumberOfUnits: 7, periodUnit: 'DAY' };
const mk = (cur: string, prices: [number, number, number, number]): StoreProductLike[] => [
  { identifier: 'kcalai_fresh_monthly', price: prices[0], priceString: String(prices[0]), currencyCode: cur },
  { identifier: 'kcalai_fresh_yearly', price: prices[1], priceString: String(prices[1]), currencyCode: cur, introPrice: trial },
  { identifier: 'kcalai_balance_monthly', price: prices[2], priceString: String(prices[2]), currencyCode: cur },
  { identifier: 'kcalai_balance_yearly', price: prices[3], priceString: String(prices[3]), currencyCode: cur, introPrice: trial },
];
const TRY_CARDS = buildPlanCards(mk('TRY', [199.99, 999.99, 499.99, 2999.99]));
const USD_CARDS = buildPlanCards(mk('USD', [5.99, 29.99, 12.99, 59.99]), 'en-US');
let mockCards: typeof TRY_CARDS = TRY_CARDS;
jest.mock('../../../lib/subscription/usePlanCards', () => ({
  usePlanCards: () => ({ cards: mockCards, loading: false, failed: !mockCards, reload: jest.fn() }),
  monthlyPriceOf: () => null,
  setPlanCardsMemo: () => {},
}));
jest.mock('../../../lib/subscription/purchases', () => {
  const actual = jest.requireActual('../../../lib/subscription/purchases');
  return { ...actual, purchasePlan: jest.fn(), restorePurchases: jest.fn(), refreshEntitlement: () => Promise.resolve() };
});

// eslint-disable-next-line import/first
import PaywallScreen, { GLOW_BLEED } from '../screens/PaywallScreen';
// eslint-disable-next-line import/first
import { PAYWALL_MOTION, ReducedMotionProvider, ThemeProvider } from '../../../core/design';

const H = { includeHiddenElements: true } as const;
const LIMITS = limitsFromSettings([
  { key: 'ai_daily_free', value: 2 },
  { key: 'ai_daily_fresh', value: 10 },
  { key: 'ai_daily_balance', value: 50 },
]);

beforeEach(() => {
  jest.clearAllMocks();
  mockCards = TRY_CARDS;
  useSubscriptionStore.setState({ available: true, rc: null, server: null, limits: LIMITS, ai: null, barcode: null });
});

const opacityOf = (tree: RenderAPI, k: string) => StyleSheet.flatten(tree.getByTestId(`sub-feature-icon-${k}`, H).props.style).opacity;
const visibleIcon = (tree: RenderAPI) => ['ai', 'voice', 'barcode', 'manual', 'coach'].filter((k) => opacityOf(tree, k) === 1);

test('md.2 karusel 3 kaydırma: üst ikon aynı örnek, süzülme döngüsü bir kez kuruldu (yeniden başlamadı), yalnız görsel değişti', async () => {
  const W = Dimensions.get('window').width;
  // Her rerender'da YENİ öğe (aynı öğe React'te bail-out olur, taklit stiller tazelenmez).
  const tree = render(<PaywallScreen />);
  const icon = tree.getByTestId('sub-feature-icon', H);
  expect(mockWithRepeat).toHaveBeenCalledTimes(1);
  expect(visibleIcon(tree)).toEqual(['voice']);

  const strip = tree.getByTestId('sub-strip');
  const order = ['ai', 'barcode', 'manual'];
  for (let i = 1; i <= 3; i++) {
    await act(async () => {
      fireEvent(strip, 'scrollBeginDrag');
      fireEvent(strip, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: W * i, y: 0 } } });
    });
    tree.rerender(<PaywallScreen />);
    // Aynı bileşen örneği (yeniden mount YOK) + döngü yeniden kurulmadı / iptal edilmedi.
    expect(tree.getByTestId('sub-feature-icon', H)).toBe(icon);
    expect(mockWithRepeat).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
    expect(visibleIcon(tree)).toEqual([order[i - 1]]);
  }
  // Otomatik geçiş (3 sn) de döngüyü bozmaz.
  await act(async () => {
    jest.advanceTimersByTime(9500);
  });
  expect(tree.getByTestId('sub-feature-icon', H)).toBe(icon);
  expect(mockWithRepeat).toHaveBeenCalledTimes(1);

  // Kademe değişimi (Balance'a yükselt) şeridi yeniden kurar ama ikon/süzülme aynı kalır.
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-upgrade-balance'));
  });
  tree.rerender(<PaywallScreen />);
  expect(tree.getByTestId('sub-title').props.children).toBe('Balance');
  expect(tree.getByTestId('sub-feature-icon', H)).toBe(icon);
  expect(mockWithRepeat).toHaveBeenCalledTimes(1);
  expect(visibleIcon(tree)).toHaveLength(1);
});

test('md.2 ikon karuselin DIŞINDA: şerit sayfalarında cam görsel yok, ikon tek; çapraz geçiş fast 220', () => {
  const tree = render(<PaywallScreen />);
  expect(tree.getAllByTestId('sub-feature-icon', H)).toHaveLength(1);
  const strip = tree.getByTestId('sub-strip');
  expect(() => strip.findByProps({ testID: 'sub-feature-icon' })).toThrow();
  expect(PAYWALL_MOTION.iconFade).toBe(220);
  // Tüm katmanlar üst üste monte (görsel değişimi = yalnız opaklık).
  for (const k of ['ai', 'voice', 'barcode', 'manual', 'coach']) {
    expect(StyleSheet.flatten(tree.getByTestId(`sub-feature-icon-${k}`, H).props.style).position).toBe('absolute');
  }
});

test('md.2 azaltılmış hareket: süzülme döngüsü kurulmaz, ikon yine görünür', () => {
  const tree = render(
    <ReducedMotionProvider value>
      <PaywallScreen />
    </ReducedMotionProvider>,
  );
  expect(mockWithRepeat).not.toHaveBeenCalled();
  expect(visibleIcon(tree)).toEqual(['voice']);
  expect(tree.queryByTestId('sub-strip-pause')).toBeNull();
});

test.each(['light', 'dark'] as const)('md.1 zemin (%s): tam ekran, taşar, hareketsiz — dikdörtgen/kenar yok', (scheme) => {
  const tree = render(
    <ThemeProvider forceScheme={scheme}>
      <PaywallScreen />
    </ThemeProvider>,
  );
  const glow = tree.getByTestId('sub-glow', H);
  const gs = StyleSheet.flatten(glow.props.style);
  // Kökü tam kaplar (safe area dahil: ScrollView dolgusundan bağımsız, kökün mutlak dolgusu).
  expect(gs).toMatchObject({ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 });
  expect(glow.props.pointerEvents).toBe('none');
  // Kökün ilk çocuğu zemin; ScrollView'ın içinde değil.
  const root = tree.getByTestId('sub-paywall', H);
  expect(root.findAllByProps({ testID: 'sub-glow' }).length).toBeGreaterThan(0);

  // Gerçek ölçüyle (modal/pencere farkı) her kenardan taşar.
  act(() => {
    fireEvent(glow, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
  });
  const svg = tree.getByTestId('sub-glow-svg', H);
  expect(svg.props.width).toBe(390 + GLOW_BLEED * 2);
  expect(svg.props.height).toBe(844 + GLOW_BLEED * 2);
  const ss = StyleSheet.flatten(svg.props.style);
  expect(ss).toMatchObject({ position: 'absolute', left: -GLOW_BLEED, top: -GLOW_BLEED });

  // Zemin ağacında hiçbir yerde transform (kayma) yok → kenar görünmez.
  const all = [glow, ...glow.findAll(() => true)];
  for (const n of all) {
    const st = StyleSheet.flatten(n.props?.style ?? {}) as { transform?: unknown };
    expect(st?.transform).toBeUndefined();
  }
  // Işıklar daire ve dışta 0 opaklık (yumuşak radyal geçiş).
  const grads = glow.findAll((n: { props?: Record<string, unknown> }) => n.props?.gradientUnits === 'userSpaceOnUse' && n.props?.rx != null);
  expect(grads.length).toBeGreaterThanOrEqual(2);
  for (const g of grads) expect(g.props.rx).toBe(g.props.ry);
});

test('md.3 fiyat biçimi: TRY → "999,99 TL" / "ayda 83 TL"; USD → "$29.99" / "ayda $2.50" (mağaza para birimi)', () => {
  let tree = render(<PaywallScreen />);
  expect(tree.getByText('999,99 TL/yıl')).toBeTruthy();
  expect(tree.getByText('ayda 83 TL')).toBeTruthy();
  expect(tree.getByText('%58 tasarruf')).toBeTruthy();
  expect(tree.queryByText(/\$/, H)).toBeNull();
  tree.unmount();

  mockCards = USD_CARDS;
  tree = render(<PaywallScreen />);
  expect(tree.getByText('$29.99/yıl')).toBeTruthy();
  expect(tree.getByText('$5.99/ay')).toBeTruthy();
  expect(tree.getByText('ayda $2.50')).toBeTruthy();
  expect(tree.getByText(`%${Math.round((1 - 29.99 / (5.99 * 12)) * 100)} tasarruf`)).toBeTruthy();
  expect(tree.queryByText(/ TL/, H)).toBeNull();
});
