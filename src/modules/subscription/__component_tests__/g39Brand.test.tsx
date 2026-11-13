// G39-S1 md.8 — BrandLogo (üç ad × iki tema), "kcalAI" işareti ve paywall üst başlığı (Light/Dark), paywall'da
// koç öğelerinde kase yerine maskot.
import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

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
const mockCARDS = buildPlanCards([
  P('kcalai_fresh_monthly', D.fresh_monthly),
  P('kcalai_fresh_yearly', D.fresh_yearly, trial),
  P('kcalai_balance_monthly', D.balance_monthly),
  P('kcalai_balance_yearly', D.balance_yearly, trial),
]);
jest.mock('../../../lib/subscription/usePlanCards', () => ({
  usePlanCards: () => ({ cards: mockCARDS, loading: false, failed: false, reload: jest.fn() }),
  monthlyPriceOf: (cards: { tier: string; yearly: boolean; priceText: string }[] | null, tier: string) =>
    cards?.find((c) => c.tier === tier && !c.yearly)?.priceText ?? null,
  setPlanCardsMemo: () => {},
}));
let mockKoc = true;
jest.mock('../../coach/access', () => ({ useCoachEnabled: () => mockKoc }));

// eslint-disable-next-line import/first
import { ThemeProvider, palette } from '../../../core/design';
// eslint-disable-next-line import/first
import { BrandLogo, brandAspect, brandLogoSvgMarkup, brandLogoWidth } from '../../../core/design/components/BrandLogo';
// eslint-disable-next-line import/first
import { KcalAiMark, kcalAiMetrics } from '../ui/KcalAiMark';
// eslint-disable-next-line import/first
import PaywallScreen from '../screens/PaywallScreen';

const LIMITS = limitsFromSettings([
  { key: 'ai_daily_free', value: 2 },
  { key: 'ai_daily_fresh', value: 10 },
  { key: 'ai_daily_balance', value: 50 },
  { key: 'barcode_daily_free', value: 5 },
]);

beforeEach(() => {
  mockParams = undefined;
  mockKoc = true;
  useSubscriptionStore.setState({ available: true, rc: null, server: null, limits: LIMITS, ai: null, barcode: null });
});

const INK = { light: palette.lightInk, dark: palette.darkInk } as const;
const SCHEMES = ['light', 'dark'] as const;
const NAMES = [
  ['kcal', 2.81, 'kcal.'],
  ['eatkcal', 4.57, 'eatkcal'],
  ['kcalculate', 6.43, 'kcalculate'],
] as const;

const src = (img: { props: { source: unknown } }) => JSON.stringify(img.props.source);

describe('BrandLogo — üç ad × iki tema', () => {
  for (const [name, ratio, label] of NAMES) {
    for (const scheme of SCHEMES) {
      test(`${name} · ${scheme}: en-boy viewBox'tan, renk tema metni, etiket marka adı`, () => {
        const r = render(
          <ThemeProvider forceScheme={scheme}>
            <BrandLogo name={name} height={20} />
          </ThemeProvider>,
        );
        const box = r.getByTestId(`brand-logo-${name}`);
        const st = StyleSheet.flatten(box.props.style);
        expect(st.height).toBe(20);
        expect(Math.abs(st.width / 20 - ratio)).toBeLessThan(0.01);
        expect(box.props.accessibilityLabel).toBe(label);
        expect(box.props.accessibilityRole).toBe('image');
        const svg = r.getByTestId(`brand-logo-${name}-svg`);
        expect(svg.props.fill ?? svg.props.color).toBeTruthy();
        // Bütün yollar tema metin rengiyle (Light siyah · Dark beyaz).
        const paths = r.UNSAFE_root.findAll((n) => typeof n.props?.d === 'string' && typeof n.props?.fill === 'string');
        expect(paths.length).toBeGreaterThan(3);
        for (const p of paths) expect(p.props.fill).toBe(INK[scheme]);
      });
    }
  }

  test('color ve accessibilityLabel/role verilebilir; decorative VoiceOver’da gizli', () => {
    const r = render(
      <>
        <BrandLogo name="kcal" height={26} color="#123456" accessibilityRole="header" accessibilityLabel="Keşfet" testID="k" />
        <BrandLogo name="eatkcal" height={13} decorative testID="d" />
      </>,
    );
    expect(r.getByTestId('k').props.accessibilityLabel).toBe('Keşfet');
    expect(r.getByTestId('k').props.accessibilityRole).toBe('header');
    expect(r.getByTestId('d', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  });

  test('saf yardımcılar: oran, genişlik, PDF satır içi svg', () => {
    expect(brandAspect('kcal')).toBeCloseTo(1632 / 580, 5);
    expect(brandLogoWidth('kcalculate', 22)).toBeCloseTo(22 * (3733 / 580), 1);
    const svg = brandLogoSvgMarkup('kcalculate', { height: 22, className: 'logo-img' });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="133 1710 3733 580"');
    expect(svg).toContain('class="logo-img"');
    expect(svg).not.toContain('data:image/png');
  });
});

describe('kcalAI işareti', () => {
  test('"AI" büyük harf yüksekliği = logo yüksekliği (Bricolage cap 0,66), küçük boşluk, Bricolage Bold', () => {
    const m = kcalAiMetrics(16);
    expect(m.fontSize * 0.66).toBeCloseTo(16, 0);
    expect(m.gap).toBe(4);
    const r = render(<KcalAiMark height={16} />);
    const ai = r.getByTestId('kcalai-mark-ai', { includeHiddenElements: true });
    const st = StyleSheet.flatten(ai.props.style);
    expect(st.fontFamily).toBe('BricolageGrotesque_700Bold');
    expect(st.fontSize).toBe(m.fontSize);
    expect(ai.props.allowFontScaling).toBe(false);
    expect(r.getByTestId('kcalai-mark').props.accessibilityLabel).toBe('kcalAI');
  });
});

describe('Paywall üst başlık (Light/Dark) + maskot', () => {
  for (const scheme of SCHEMES) {
    test(`${scheme}: "kcalAI" yazısı yok → kcalculate logosu + "AI", ikisi de tema metin renginde`, () => {
      const r = render(
        <ThemeProvider forceScheme={scheme}>
          <PaywallScreen />
        </ThemeProvider>,
      );
      expect(r.queryByText('kcalAI')).toBeNull();
      const brand = r.getByTestId('sub-brand');
      expect(brand.props.accessibilityLabel).toBe('kcalAI');
      const ai = r.getByTestId('sub-brand-ai', { includeHiddenElements: true });
      expect(StyleSheet.flatten(ai.props.style).color).toBe(INK[scheme]);
      const logoPaths = r.getByTestId('sub-brand-logo', { includeHiddenElements: true }).findAll((n) => typeof n.props?.d === 'string' && typeof n.props?.fill === 'string');
      expect(logoPaths.length).toBeGreaterThan(3);
      for (const p of logoPaths) expect(p.props.fill).toBe(INK[scheme]);
      // Logo ve "AI" ayrı düğümler; başlık yalnız plan adı.
      expect(r.getByTestId('sub-title').props.children).toBe('Fresh');
    });
  }

  test('Fresh: "Balance’a yükselt" satırında kase değil maskot', () => {
    const r = render(<PaywallScreen />);
    const up = r.getByTestId('sub-upgrade-balance');
    const imgs = up.findAll((n) => n.props?.source != null && typeof n.type === 'string' ? false : n.props?.source != null);
    expect(imgs.length).toBeGreaterThan(0);
    expect(src(imgs[0])).toContain('koc-acik');
    expect(src(imgs[0])).not.toContain('bowl');
  });

  test('Balance (koçtan): kartlardaki "kcalAI Koç dahil" satırı ve koç slaytı ikonu maskot', () => {
    mockParams = { coach: true };
    const r = render(<PaywallScreen />);
    const row = r.getByTestId('sub-card-coach-balance_yearly', { includeHiddenElements: true });
    const imgs = row.findAll((n) => n.props?.source != null);
    expect(src(imgs[0])).toContain('koc-acik');
    // Hiçbir yerde kase görseli yok (Fresh kamerası ve diğer cam ikonlar duruyor).
    const all = r.UNSAFE_root.findAll((n) => n.props?.source != null && typeof n.type !== 'string').map(src);
    expect(all.some((s) => s.includes('bowl'))).toBe(false);
    expect(all.some((s) => s.includes('camera'))).toBe(true);
  });
});
