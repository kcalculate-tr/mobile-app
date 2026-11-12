// G32-S1 md.3 — Ürün sayfası güvenli alan: üstte safe area kadar düz, boş, opak bant;
// görsel onun altından başlar; geri düğmesi görselin üst-solunda (bandla çakışmaz).
import React from 'react';
import { StyleSheet } from 'react-native';
import { render as rtlRender, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (ui: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({ params: { productId: '7' } }),
}));
jest.mock('../nav', () => ({ useEkNav: () => ({ navigate: jest.fn(), goBack: jest.fn() }) }));
jest.mock('../../../../core/supabase', () => {
  const row = { id: 7, name: 'Ton Salata', price: 285, calories: 420, img: null, brand: 'KCAL', is_available: true };
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: null }) };
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

test('üst bant = safe area yüksekliği, opak tema zemini; ScrollView bandın altından; geri görselin içinde', async () => {
  const r = render(<EkProductScreen />);
  await waitFor(() => expect(r.getByTestId('ek-product')).toBeTruthy());
  const root = r.getByTestId('ek-product');
  const band = r.getByTestId('ek-product-safe-top');
  const bandSt = StyleSheet.flatten(band.props.style) as Record<string, unknown>;
  const rootSt = StyleSheet.flatten(root.props.style) as Record<string, unknown>;
  expect(bandSt.height).toBe(59);
  expect(bandSt.backgroundColor).toBe(rootSt.backgroundColor); // tema zemini, opak
  expect(band.props.children).toBeUndefined(); // boş
  // Bant kökün ilk çocuğu, kaydırma alanı ondan sonra → kaydırınca bant yerinde kalır.
  const kids = React.Children.toArray(root.props.children) as React.ReactElement<{ testID?: string }>[];
  expect(kids[0].props.testID).toBe('ek-product-safe-top');
  // Geri düğmesi: görselin üst-solunda; insets.top'a bağlı değil (görsel zaten bandın altında).
  expect(r.getByTestId('ek-product-back')).toBeTruthy();
  const barSt = StyleSheet.flatten(r.getByTestId('ek-product-herobar').props.style) as Record<string, number>;
  expect(barSt.top).toBe(8);
});
