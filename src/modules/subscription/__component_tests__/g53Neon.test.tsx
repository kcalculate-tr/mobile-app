// G53/G54 → 15 Kas — Paywall seçili plan kartı neon kenarı: yalnız seçili kartta; seçim değişince yeni karta geçer;
// azaltılmış harekette / arka planda nefes yok (sabit). Sağ üstte aylık fiyat; yıllıkta faturalanan tutar altta.
import React from 'react';
import { act, fireEvent, render, type RenderAPI } from '@testing-library/react-native';
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';

import { buildPlanCards, type StoreProductLike } from '../../../lib/subscription/plans';
import { limitsFromSettings } from '../../../lib/subscription/limits';
import { useSubscriptionStore } from '../../../lib/subscription/purchases';

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), setOptions: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: undefined }) }));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  return { useSafeAreaInsets: () => insets };
});

const trial = { price: 0, periodNumberOfUnits: 7, periodUnit: 'DAY' };
const PRODUCTS: StoreProductLike[] = [
  { identifier: 'kcalai_fresh_monthly', price: 199.99, priceString: '199.99', currencyCode: 'TRY' },
  { identifier: 'kcalai_fresh_yearly', price: 999.99, priceString: '999.99', currencyCode: 'TRY', introPrice: trial },
  { identifier: 'kcalai_balance_monthly', price: 499.99, priceString: '499.99', currencyCode: 'TRY' },
  { identifier: 'kcalai_balance_yearly', price: 2999.99, priceString: '2999.99', currencyCode: 'TRY', introPrice: trial },
];
const mockCards = buildPlanCards(PRODUCTS);
jest.mock('../../../lib/subscription/usePlanCards', () => ({
  usePlanCards: () => ({ cards: mockCards, loading: false, failed: false, reload: jest.fn() }),
  monthlyPriceOf: () => null,
  setPlanCardsMemo: () => {},
}));
jest.mock('../../../lib/subscription/purchases', () => {
  const actual = jest.requireActual('../../../lib/subscription/purchases');
  return { ...actual, purchasePlan: jest.fn(), restorePurchases: jest.fn(), refreshEntitlement: () => Promise.resolve() };
});

// eslint-disable-next-line import/first
import PaywallScreen from '../screens/PaywallScreen';
// eslint-disable-next-line import/first
import { ReducedMotionProvider, ThemeProvider } from '../../../core/design';

const H = { includeHiddenElements: true } as const;
const LIMITS = limitsFromSettings([
  { key: 'ai_daily_free', value: 2 },
  { key: 'ai_daily_fresh', value: 10 },
  { key: 'ai_daily_balance', value: 50 },
]);

let appHandlers: Array<(s: AppStateStatus) => void> = [];
beforeEach(() => {
  jest.clearAllMocks();
  appHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_e: string, h: (s: AppStateStatus) => void) => {
    appHandlers.push(h);
    return { remove: () => {} };
  }) as never);
  useSubscriptionStore.setState({ available: true, rc: null, server: null, limits: LIMITS, ai: null, barcode: null });
});
afterEach(() => jest.restoreAllMocks());

const modeOf = (tree: RenderAPI, key: string) => {
  for (const m of ['run', 'static', 'off']) if (tree.queryByTestId(`sub-card-${key}-neon-${m}`, H)) return m;
  return null;
};

test('yalnız seçili kartta nefes alır; kenar kart kutusunda (−2), marka lime, boxShadow hale', () => {
  const tree = render(<PaywallScreen />);
  expect(modeOf(tree, 'fresh_yearly')).toBe('run');
  expect(modeOf(tree, 'fresh_monthly')).toBe('off');
  const layer = StyleSheet.flatten(tree.getByTestId('sub-card-fresh_yearly-neon-run', H).props.style);
  expect(layer).toMatchObject({ position: 'absolute', left: -2, top: -2, right: -2, bottom: -2, borderRadius: 20 });
  const line = StyleSheet.flatten(tree.getByTestId('sub-card-fresh_yearly-neon-line', H).props.style);
  expect(line).toMatchObject({ borderWidth: 2, borderColor: '#B9EF14', borderRadius: 20 });
  const glow = StyleSheet.flatten(tree.getByTestId('sub-card-fresh_yearly-neon-glow', H).props.style);
  expect(String(glow.boxShadow)).toContain('rgba(185,239,20,');
});

test('seçim değişince neon yeni karta geçer', async () => {
  const tree = render(<PaywallScreen />);
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-card-fresh_monthly'));
  });
  expect(modeOf(tree, 'fresh_monthly')).toBe('run');
  expect(modeOf(tree, 'fresh_yearly')).toBe('off');
});

test('azaltılmış hareket: nefes yok (sabit)', () => {
  const tree = render(
    <ThemeProvider forceScheme="dark">
      <ReducedMotionProvider value>
        <PaywallScreen />
      </ReducedMotionProvider>
    </ThemeProvider>,
  );
  expect(modeOf(tree, 'fresh_yearly')).toBe('static');
});

test('uygulama arka planda → sabit; geri gelince nefes', () => {
  const tree = render(<PaywallScreen />);
  act(() => appHandlers.forEach((h) => h('background')));
  expect(modeOf(tree, 'fresh_yearly')).toBe('static');
  act(() => appHandlers.forEach((h) => h('active')));
  expect(modeOf(tree, 'fresh_yearly')).toBe('run');
});

test('fiyat: sağ üstte aylık (yıllıkta aylık karşılık), yıllık tutar ve tasarruf altında küçük', () => {
  const tree = render(<PaywallScreen />);
  const yp = tree.getByTestId('sub-price-fresh_yearly');
  const mp = tree.getByTestId('sub-price-fresh_monthly');
  expect(String(yp.props.children)).toMatch(/\/ay$/);
  expect(String(mp.props.children)).toMatch(/\/ay$/);
  expect(String(tree.getByTestId('sub-billed-fresh_yearly').props.children)).toMatch(/\/yıl$/);
  expect(tree.getByTestId('sub-save-fresh_yearly')).toBeTruthy();
  expect(tree.queryByTestId('sub-billed-fresh_monthly')).toBeNull();
  const big = StyleSheet.flatten(yp.props.style).fontSize;
  const small = StyleSheet.flatten(tree.getByTestId('sub-billed-fresh_yearly').props.style).fontSize;
  expect(big).toBeGreaterThan(small);
});
