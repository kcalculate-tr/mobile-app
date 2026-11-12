// G32-S1 md.2 — Mağaza sayfası yapışkan kategori çubuğu: güvenli alanın altından
// başlar, opak tema zemini, geri düğmesi başlığa dahil.
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render as rtlRender, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (ui: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({ params: { brandKey: 'kcal' } }),
}));
jest.mock('../nav', () => ({ useEkNav: () => ({ navigate: jest.fn(), goBack: mockGoBack }) }));
jest.mock('../../../../core/supabase', () => {
  const client = { rpc: jest.fn(), from: jest.fn(), auth: { getSession: () => Promise.resolve({ data: { session: null } }) } };
  return { supabase: client, getSupabaseClient: () => client };
});
jest.mock('../../../../lib/brands', () => ({ fetchBrand: jest.fn(async () => ({ name: 'KCAL Bornova', tagline: null, hero_image_url: null })) }));
jest.mock('../../../../lib/categories', () => ({
  fetchCategories: jest.fn(async () => [{ id: 1, name: 'Salata' }, { id: 2, name: 'Bowl' }, { id: 3, name: 'Tatlı' }]),
  fetchProductsByBrand: jest.fn(async () => [
    { id: 1, name: 'Ton Salata', price: 285, category: 'Salata' },
    { id: 2, name: 'Tavuk Bowl', price: 320, category: 'Bowl' },
    { id: 3, name: 'Fit Brownie', price: 120, category: 'Tatlı' },
  ]),
}));
jest.mock('../../../../lib/restaurantRating', () => ({ fetchRestaurantRating: jest.fn(async () => null) }));
jest.mock('../../../../lib/socialProof', () => ({ vitrinYorumlariniGetir: jest.fn(async () => []) }));
jest.mock('../ui/home/useDeliveryChip', () => ({ useDeliveryChip: () => ({ chip: null }) }));
jest.mock('../ui/home/CartBar', () => ({
  CART_BAR_H: 56,
  CART_BAR_GAP: 12,
  cartBarBottom: () => 40,
  useCartSummary: () => ({ count: 0, total: 0 }),
  EkCartBar: () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EkStoreScreen = require('../screens/EkStoreScreen').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { storePinAt, STORE_BAR_ROW } = require('../ui/store/StoreHeader');

const scrollTo = (r: ReturnType<typeof render>, y: number) =>
  act(() => {
    fireEvent.scroll(r.getByTestId('ek-store-scroll'), {
      nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 393, height: 3000 }, layoutMeasurement: { width: 393, height: 852 } },
    });
  });

test('eşik: çipler güvenli alan + [geri · ad] satırının altına geldiği an', () => {
  expect(storePinAt(400, 59)).toBe(400 - 59 - STORE_BAR_ROW);
  expect(storePinAt(10, 59)).toBe(0);
});

test('kaydırınca yapışan başlık: safe area altından, opak tema zemini, geri dahil; yüzen geri kalkar', async () => {
  const r = render(<EkStoreScreen />);
  await waitFor(() => expect(r.getByTestId('ek-store-chips-inline')).toBeTruthy());
  act(() => {
    fireEvent(r.getByTestId('ek-store-chips-inline'), 'layout', { nativeEvent: { layout: { x: 0, y: 400, width: 393, height: 60 } } });
  });
  // Başta: yapışan başlık yok, kapak üstü geri safe area'nın altında.
  expect(r.queryByTestId('ek-store-pinned')).toBeNull();
  const floating = r.getByTestId('ek-store-back-floating');
  expect(floating).toBeTruthy();

  scrollTo(r, storePinAt(400, 59) - 1);
  expect(r.queryByTestId('ek-store-pinned')).toBeNull();

  scrollTo(r, storePinAt(400, 59) + 20);
  const pinned = r.getByTestId('ek-store-pinned');
  const st = StyleSheet.flatten(pinned.props.style) as Record<string, unknown>;
  expect(st.paddingTop).toBe(59); // durum çubuğu / Dynamic Island altından başlar
  expect(st.top).toBe(0);
  expect(typeof st.backgroundColor).toBe('string');
  expect(String(st.backgroundColor)).not.toMatch(/rgba\(.*,\s*0(\.\d+)?\)$/); // opak
  expect(r.queryByTestId('ek-store-back-floating')).toBeNull();
  expect(r.getByTestId('ek-store-pinned-chips')).toBeTruthy();
  expect(r.getAllByText('KCAL Bornova').length).toBeGreaterThan(1); // başlıkta küçük ad

  fireEvent.press(r.getByTestId('ek-store-pinned-back'));
  expect(mockGoBack).toHaveBeenCalledTimes(1);

  // Yapışık çipten kategori seçimi ürünleri süzer.
  fireEvent.press(r.getAllByText('Bowl')[1]);
  expect(r.queryByText('Ton Salata')).toBeNull();
  expect(r.getByText('Tavuk Bowl')).toBeTruthy();

  scrollTo(r, 0);
  expect(r.queryByTestId('ek-store-pinned')).toBeNull();
});
