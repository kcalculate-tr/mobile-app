// G18-S3 — eatkcal Tur 26d/26e görünüm katmanları: ürün sayfası tek alt katmanı,
// yüzen lime sepet çubuğu ve "Çok yakında" form sheet'i. Mantık çağrısı yok; yalnız
// görünüm durumları (Final metinleri, TL biçimi, pasif/aktif düğme).
import React from 'react';
import { act, fireEvent, render as rtlRender } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProductBottomBar } from '../ui/product/ProductBottomBar';
import { EkCartBar } from '../ui/home/CartBar';
import { useCartStore } from '../../../../store/cartStore';
import type { Product } from '../../../../types';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>;
function render(ui: React.ReactElement) {
  const r = rtlRender(wrap(ui));
  return { ...r, rerender: (next: React.ReactElement) => r.rerender(wrap(next)) };
}

jest.mock('../ui/gate/waitlistSend', () => ({
  submitWaitlist: jest.fn(async () => {}),
  flushWaitlistQueue: jest.fn(async () => {}),
}));

const base = {
  quantity: 1,
  onQuantity: jest.fn(),
  price: 285,
  ready: true,
  missing: false,
  open: true,
  added: false,
  infoAmount: '150 g',
  infoName: 'Izgara Tavuk Bonfile',
  macros: { kcal: 540, protein: 42, carbs: 48, fats: 18 },
  onAdd: jest.fn(),
  onGoCart: jest.fn(),
};

test('tek alt katman: "Sepete ekle (285 TL)", makro satırı aynı katmanda, ₺ yok', () => {
  const { getByTestId, getByText, queryByTestId } = render(<ProductBottomBar {...base} />);
  expect(getByTestId('ek-product-bar')).toBeTruthy();
  expect(getByTestId('ek-product-layer-macros')).toBeTruthy();
  expect(getByText('285 TL')).toBeTruthy();
  expect(getByText('540 kcal')).toBeTruthy();
  expect(getByText('P 42')).toBeTruthy();
  expect(queryByTestId('ek-product-live-strip')).toBeNull(); // ayrı makro şeridi YOK
  fireEvent.press(getByTestId('ek-product-add'));
  expect(base.onAdd).toHaveBeenCalledTimes(1);
});

test('eklendi → aynı düğme "Sepete git" (sepete gider); eksik seçimde uyarı satırı', () => {
  const r = render(<ProductBottomBar {...base} added />);
  expect(r.getByText('Sepete git')).toBeTruthy();
  fireEvent.press(r.getByTestId('ek-product-go-cart'));
  expect(base.onGoCart).toHaveBeenCalledTimes(1);
  r.rerender(<ProductBottomBar {...base} ready={false} missing />);
  expect(r.getByText('Zorunlu seçimleri tamamla')).toBeTruthy();
  expect(r.queryByText('Sepete git')).toBeNull();
});

test('kuruşlu tutar virgülle: 285,50 TL', () => {
  const { getByText } = render(<ProductBottomBar {...base} price={285.5} />);
  expect(getByText('285,50 TL')).toBeTruthy();
});

test('yüzen sepet çubuğu: sepet boşken yok, ürün varken "Sepet (N)" · toplam · "Sepete git"', () => {
  useCartStore.getState().clearCart();
  const onPress = jest.fn();
  const r = render(<EkCartBar bottom={98} onPress={onPress} />);
  expect(r.queryByTestId('ek-cart-bar')).toBeNull();
  const p = { id: 7, name: 'Tavuk Kinoa', price: 285, is_available: true } as unknown as Product;
  act(() => {
    useCartStore.getState().addItem(p, {}, 2);
  });
  expect(r.getByTestId('ek-cart-bar')).toBeTruthy();
  expect(r.getByText('Sepet (2)')).toBeTruthy();
  expect(r.getByText('570 TL')).toBeTruthy();
  expect(r.getByText('Sepete git')).toBeTruthy();
  fireEvent.press(r.getByRole('link'));
  expect(onPress).toHaveBeenCalledTimes(1);
  act(() => {
    useCartStore.getState().clearCart();
  });
});

test('Restoranını ekle: zorunlular dolana dek "Zorunlu alanları doldur", sonra gönderilir ve hata göstermez', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WaitlistFormSheet } = require('../ui/gate/WaitlistFormSheet');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { submitWaitlist } = require('../ui/gate/waitlistSend');
  const r = render(
    <WaitlistFormSheet kind="restaurant_add" visible city="Ankara" country="TR" onClose={jest.fn()} onPrivacy={jest.fn()} />,
  );
  expect(r.getByTestId('ek-waitlist-help')).toBeTruthy();
  fireEvent.changeText(r.getByTestId('ek-waitlist-restaurant_name'), 'Yeşil Tabak');
  fireEvent.changeText(r.getByTestId('ek-waitlist-contact_name'), 'Ad Soyad');
  fireEvent.changeText(r.getByTestId('ek-waitlist-phone'), '+90 555 000 00 00');
  fireEvent.press(r.getByTestId('ek-waitlist-send'));
  expect(submitWaitlist).not.toHaveBeenCalled(); // e-posta eksik
  fireEvent.changeText(r.getByTestId('ek-waitlist-email'), 'a@b.co');
  expect(r.queryByTestId('ek-waitlist-help')).toBeNull();
  await act(async () => {
    fireEvent.press(r.getByTestId('ek-waitlist-send'));
  });
  expect(submitWaitlist).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'restaurant_add', city: 'Ankara', restaurant_name: 'Yeşil Tabak', email: 'a@b.co' }),
  );
  expect(r.getByTestId('ek-waitlist-done')).toBeTruthy();
  expect(r.getByText('Başvurunu aldık')).toBeTruthy();
});
