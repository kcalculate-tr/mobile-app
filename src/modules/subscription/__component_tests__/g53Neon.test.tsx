// G53-S1 md.4 — Paywall seçili plan kartı: kenarda dolaşan neon. Yalnız seçili kartta; seçim değişince yeni
// karta geçer; azaltılmış harekette dolaşma YOK (sabit 2 pt lime + hafif glow); paywall görünmezken (arka plan)
// kare döngüsü durur.
import React from 'react';
import { act, fireEvent, render, type RenderAPI } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { buildPlanCards, type StoreProductLike } from '../../../lib/subscription/plans';
import { limitsFromSettings } from '../../../lib/subscription/limits';
import { useSubscriptionStore } from '../../../lib/subscription/purchases';

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), setOptions: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: undefined }) }));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  return { useSafeAreaInsets: () => insets };
});
// Kare geri çağrısı (UI thread döngüsü) — etkin/durdurma çağrıları sayılır.
const mockSetActive = jest.fn();
const mockFrameCb = jest.fn();
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
    useFrameCallback: (cb: unknown, autostart?: boolean) => {
      mockFrameCb(cb, autostart);
      return { setActive: mockSetActive, isActive: false, callbackId: 1 };
    },
  };
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
const layout = (tree: RenderAPI, key: string) =>
  fireEvent(tree.getByTestId(new RegExp(`^sub-card-${key}-neon-`), H), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 386, height: 96 } } });

test('yalnız seçili kartta dolaşır; döngü UI thread kare geri çağrısında başlar', () => {
  const tree = render(<PaywallScreen />);
  expect(modeOf(tree, 'fresh_yearly')).toBe('run');
  expect(modeOf(tree, 'fresh_monthly')).toBe('off');
  expect(mockFrameCb).toHaveBeenCalled();
  expect(mockFrameCb.mock.calls[0][1]).toBe(false); // kendiliğinden başlamaz; görünürlüğe bağlı
  expect(mockSetActive).toHaveBeenLastCalledWith(true);
  // seçili kartın kenarı saydam (sabit lime çizgi yok); içerik aynı
  layout(tree, 'fresh_yearly');
  expect(tree.queryByTestId('sub-card-fresh_yearly-neon-solid', H)).toBeNull();
  expect(tree.getByTestId('sub-save-fresh_yearly')).toBeTruthy();
});

test('seçim değişince ışık yeni karta geçer (G54: 250 ms opaklık)', async () => {
  const tree = render(<PaywallScreen />);
  await act(async () => {
    fireEvent.press(tree.getByTestId('sub-card-fresh_monthly'));
  });
  expect(modeOf(tree, 'fresh_monthly')).toBe('run');
  expect(modeOf(tree, 'fresh_yearly')).toBe('off');
  // ortak saat: döngü kesilmedi
  expect(mockSetActive).not.toHaveBeenCalledWith(false);
});

test('azaltılmış hareket: dolaşma yok, döngü hiç başlamaz; sabit ince (G54: 1,5 pt) lime kenar + yumuşak hale', () => {
  const tree = render(
    <ThemeProvider forceScheme="dark">
      <ReducedMotionProvider value>
        <PaywallScreen />
      </ReducedMotionProvider>
    </ThemeProvider>,
  );
  expect(modeOf(tree, 'fresh_yearly')).toBe('static');
  expect(mockSetActive).not.toHaveBeenCalledWith(true);
  layout(tree, 'fresh_yearly');
  const solid = tree.getByTestId('sub-card-fresh_yearly-neon-solid', H);
  expect(solid.props.strokeWidth).toBe(1.5);
  // 14 Kas: marka lime (#B9EF14) — react-native-svg rengi işler.
  expect(solid.props.stroke.payload).toBe(0xffb9ef14);
});

test('paywall görünmezken (uygulama arka planda) döngü durur; geri gelince sürer', () => {
  const tree = render(<PaywallScreen />);
  expect(mockSetActive).toHaveBeenLastCalledWith(true);
  act(() => appHandlers.forEach((h) => h('background')));
  expect(mockSetActive).toHaveBeenLastCalledWith(false);
  expect(modeOf(tree, 'fresh_yearly')).toBe('static');
  act(() => appHandlers.forEach((h) => h('active')));
  expect(mockSetActive).toHaveBeenLastCalledWith(true);
  expect(modeOf(tree, 'fresh_yearly')).toBe('run');
});

// ─── G54-S1 md.7: hizalama, tek yol, rozetler üstte ──────────────────────────
describe('G54 md.7 neon hizalama', () => {
  test.each([
    [375, 'dark'],
    [430, 'light'],
  ] as const)('%i pt (%s): SVG kart kutusuna (kenarlık kutusu) birebir + taşma payı; temel kenar ve ışık aynı yol', (w, scheme) => {
    const tree = render(
      <ThemeProvider forceScheme={scheme}>
        <PaywallScreen />
      </ThemeProvider>,
    );
    const cardW = w - 32;
    fireEvent(tree.getByTestId(/^sub-card-fresh_yearly-neon-/, H), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: cardW, height: 104 } } });
    const layer = tree.getByTestId('sub-card-fresh_yearly-neon-run', H);
    // Katman kartın kenarlık kutusunu kaplar (kart borderWidth 2 → −2), negatif taşma payı YOK (ölçü = kart).
    const st = require('react-native').StyleSheet.flatten(layer.props.style);
    expect(st).toMatchObject({ position: 'absolute', left: -2, top: -2, right: -2, bottom: -2 });
    const svg = tree.getByTestId('sub-card-fresh_yearly-neon-svg', H);
    expect(svg.props.width).toBe(cardW + 20);
    expect(svg.props.height).toBe(104 + 20);
    const base = tree.getByTestId('sub-card-fresh_yearly-neon-base', H);
    // Yol: x = taşma 10 + yarı çizgi 0,75; köşe yayı yarıçapı 20 − 0,75.
    expect(base.props.d.startsWith('M30 10.75')).toBe(true);
    expect(base.props.d).toContain('A19.25 19.25 0 0 1');
    expect(base.props.strokeWidth).toBe(1.5);
    expect(base.props.strokeOpacity).toBe(0.5);
    // Rozetler ışığın ÜSTÜNDE (kartta neon katmanından sonra çizilir) ve ölçüye girmez (mutlak konum).
    const card = tree.getByTestId('sub-card-fresh_yearly');
    const kids = card.findAll((n: { props: { testID?: string } }) => typeof n.props.testID === 'string' && /neon-run|sub-save-fresh_yearly/.test(n.props.testID)).map((n: { props: { testID?: string } }) => n.props.testID);
    expect(kids.indexOf('sub-save-fresh_yearly')).toBeGreaterThan(kids.findIndex((k: string) => /neon-run/.test(k)));
  });
});
