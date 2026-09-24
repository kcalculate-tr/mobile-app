import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ReorderCard, { reorderSummary } from '../ReorderCard';
import type { PastOrder } from '../../lib/reorder';

const kalem = (id: string, name: string, quantity = 1, imageUrl: string | null = null) => ({
  id, name, quantity, options: {}, imageUrl,
});

const siparis = (items: PastOrder['items']): PastOrder => ({
  id: 1,
  orderCode: 'KCAL-A123',
  createdAt: '2026-09-12T10:00:00.000Z',
  totalAmount: 585,
  items,
});

test('başlık, özet ve tarih/adet satırı gösterilir', () => {
  const { getByText } = render(
    <ReorderCard
      order={siparis([kalem('1', 'Tavuklu Bowl', 2), kalem('2', 'Somonlu Salata')])}
      onPress={() => {}}
    />,
  );
  expect(getByText('Yine aynısı?')).toBeTruthy();
  expect(getByText('2× Tavuklu Bowl, Somonlu Salata')).toBeTruthy();
  // 2 + 1 = 3 ürün; tarih Türkçe biçimde
  expect(getByText('12 Eylül · 3 ürün')).toBeTruthy();
});

test('tek adetli ürünün başına "1×" YAZILMAZ', () => {
  expect(reorderSummary(siparis([kalem('1', 'Tavuklu Bowl')]))).toBe('Tavuklu Bowl');
  expect(reorderSummary(siparis([kalem('1', 'Tavuklu Bowl', 3)]))).toBe('3× Tavuklu Bowl');
});

test('4+ ürünlü siparişte en fazla 3 görsel, kalanı "+N" ile özetlenir', () => {
  const { getByText, queryByText } = render(
    <ReorderCard
      order={siparis([
        kalem('1', 'A'), kalem('2', 'B'), kalem('3', 'C'), kalem('4', 'D'), kalem('5', 'E'),
      ])}
      onPress={() => {}}
    />,
  );
  expect(getByText('+2')).toBeTruthy();
  expect(queryByText('+3')).toBeNull();
});

test('tam 3 ürünlü siparişte "+N" rozeti ÇIKMAZ', () => {
  const { queryByText } = render(
    <ReorderCard
      order={siparis([kalem('1', 'A'), kalem('2', 'B'), kalem('3', 'C')])}
      onPress={() => {}}
    />,
  );
  expect(queryByText(/^\+\d+$/)).toBeNull();
});

test('adet rozeti yalnız 1 adetten fazlasında görünür', () => {
  const { queryByText, rerender } = render(
    <ReorderCard order={siparis([kalem('1', 'A')])} onPress={() => {}} />,
  );
  expect(queryByText('1')).toBeNull();

  rerender(<ReorderCard order={siparis([kalem('1', 'A', 4)])} onPress={() => {}} />);
  expect(queryByText('4')).toBeTruthy();
});

test('butona basınca onPress bir kez çağrılır', () => {
  const tiklamalar: number[] = [];
  const { getByText } = render(
    <ReorderCard order={siparis([kalem('1', 'A')])} onPress={() => tiklamalar.push(1)} />,
  );
  fireEvent.press(getByText('Sepete Ekle'));
  expect(tiklamalar.length).toBe(1);
});

test('busy iken buton etiketi gizlenir ve onPress ÇAĞRILMAZ', () => {
  // İki kez sepete eklemeyi engelleyen tek koruma bu; kırılırsa müşteri
  // siparişi çift ekleyebilir.
  const tiklamalar: number[] = [];
  const { queryByText, getByLabelText } = render(
    <ReorderCard order={siparis([kalem('1', 'A')])} busy onPress={() => tiklamalar.push(1)} />,
  );
  expect(queryByText('Sepete Ekle')).toBeNull();
  fireEvent.press(getByLabelText('Son siparişi sepete ekle'));
  expect(tiklamalar.length).toBe(0);
});
