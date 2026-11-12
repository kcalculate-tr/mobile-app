// G38 EK md.7 (TestFlight geri bildirimi) — Ürün sayfası üst güvenli alan bandı, ürün görseli
// alanının zemini: Light #FFFFFF, Dark görsel alanının koyu zemini (tema surface #1C1C1E); gri sayfa
// zemini (bg) DEĞİL. Yüklü sayfa, iskelet ve hata hâllerinin üçünde de aynı bant.
import React from 'react';
import { StyleSheet } from 'react-native';
import { render as rtlRender, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../../core/design/ThemeProvider';
import { themes } from '../../../../core/design/theme';
import { I18nProvider } from '../../../../core/i18n';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
type Scheme = 'light' | 'dark';
const flat = (s: unknown) => StyleSheet.flatten(s as never) as Record<string, unknown>;

let mockMode: 'ok' | 'loading' | 'error' = 'ok';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({ params: { productId: '7' } }),
}));
jest.mock('../nav', () => ({ useEkNav: () => ({ navigate: jest.fn(), goBack: jest.fn() }) }));
jest.mock('../../../../core/supabase', () => {
  const row = { id: 7, name: 'Ton Salata', price: 285, calories: 420, img: null, brand: 'kcalculate', is_available: true };
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: () =>
      mockMode === 'loading'
        ? new Promise(() => {})
        : Promise.resolve(mockMode === 'error' ? { data: null, error: null } : { data: row, error: null }),
  };
  const client = { rpc: jest.fn(), from: () => q, auth: { getSession: () => Promise.resolve({ data: { session: null } }) } };
  return { supabase: client, getSupabaseClient: () => client };
});
jest.mock('../../../../lib/products', () => ({
  ...jest.requireActual('../../../../lib/products'),
  fetchProductOptionGroups: jest.fn(async () => []),
  fetchProductImagesByName: jest.fn(async () => ({})),
}));
jest.mock('../../../../lib/productOptions', () => ({ fetchProductOptionLinks: jest.fn(async () => []) }));
jest.mock('../../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../../../lib/restaurantRating', () => ({ fetchRestaurantRating: jest.fn(async () => null) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EkProductScreen = require('../screens/EkProductScreen').default;

const render = (scheme: Scheme) =>
  rtlRender(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider forceScheme={scheme}>
        <I18nProvider forceLang="tr">
          <EkProductScreen />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );

const EXPECTED: Record<Scheme, string> = { light: '#FFFFFF', dark: '#1C1C1E' };

describe.each(['light', 'dark'] as Scheme[])('%s', (scheme) => {
  const c = themes[scheme].color;

  test('yüklü sayfa: bant = görsel alanı zemini (gri bg değil), safe area yüksekliğinde, boş', async () => {
    mockMode = 'ok';
    const r = render(scheme);
    await waitFor(() => expect(r.getByTestId('ek-product')).toBeTruthy());
    const band = flat(r.getByTestId('ek-product-safe-top').props.style);
    const hero = flat(r.getByTestId('ek-product-hero-area').props.style);
    expect(band.height).toBe(59);
    expect(band.backgroundColor).toBe(EXPECTED[scheme]);
    expect(band.backgroundColor).toBe(c.surface);
    expect(hero.backgroundColor).toBe(band.backgroundColor);
    expect(band.backgroundColor).not.toBe(c.bg);
    expect(r.getByTestId('ek-product-safe-top').props.children).toBeUndefined();
  });

  test('iskelet hâli: aynı bant + görsel alanı aynı zemin', () => {
    mockMode = 'loading';
    const r = render(scheme);
    expect(r.getByTestId('ek-product-skeleton')).toBeTruthy();
    const band = flat(r.getByTestId('ek-product-safe-top').props.style);
    expect(band.height).toBe(59);
    expect(band.backgroundColor).toBe(EXPECTED[scheme]);
    expect(flat(r.getByTestId('ek-product-hero-area').props.style).backgroundColor).toBe(EXPECTED[scheme]);
    // Kökte paddingTop yok: üst boşluğu bant dolduruyor (gri şerit kalmaz).
    expect(flat(r.getByTestId('ek-product-skeleton').props.style).paddingTop).toBeUndefined();
  });

  test('hata hâli: aynı bant', async () => {
    mockMode = 'error';
    const r = render(scheme);
    await waitFor(() => expect(r.getByTestId('ek-product-error')).toBeTruthy());
    const band = flat(r.getByTestId('ek-product-safe-top').props.style);
    expect(band.height).toBe(59);
    expect(band.backgroundColor).toBe(EXPECTED[scheme]);
    expect(flat(r.getByTestId('ek-product-error').props.style).paddingTop).toBeUndefined();
  });
});
