// G15-S3 — FinActivityCard: "Ben de yaptım" kartı + süre sayfası.
// Kart: hap basılınca onDidIt; eklendiyse "Yaptın" (pasif). Sayfa: −/+ süreyi 5'er
// dk değiştirir, kcal tahmini güncellenir, Ekle seçilen süreyle onAdd çağırır.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityCard } from '../ActivityCard';
import { DidItSheet } from '../DidItSheet';
import { estimateActivityKcal } from '../../activity';

const metrics = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

const RUN = { type: 'kosu' as const, minutes: 45, distance_km: 8.2, kcal_est: 430, note: null };

test('kart: Ben de yaptım → onDidIt; eklendiyse Yaptın ve pasif', () => {
  const onDidIt = jest.fn();
  const { getByLabelText, rerender, queryByLabelText } = render(
    <ActivityCard activity={RUN} didItCount={12} onDidIt={onDidIt} />,
  );
  fireEvent.press(getByLabelText('Ben de yaptım'));
  expect(onDidIt).toHaveBeenCalledTimes(1);
  rerender(<ActivityCard activity={RUN} didItCount={13} onDidIt={onDidIt} done />);
  expect(queryByLabelText('Ben de yaptım')).toBeNull();
  fireEvent.press(getByLabelText('Yaptın'));
  expect(onDidIt).toHaveBeenCalledTimes(1);
});

test('sayfa: süre adımları + kcal tahmini + Ekle seçilen süreyle', () => {
  const onAdd = jest.fn();
  const { getByLabelText, getByText } = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <DidItSheet visible activity={RUN} authorName="Ayşe" initialMinutes={30} onClose={jest.fn()} onAdd={onAdd} />
    </SafeAreaProvider>,
  );
  getByText('Ayşe ile aynı etkinlik');
  getByText(new RegExp(`~${estimateActivityKcal('kosu', 30)} kcal tahmini`));
  fireEvent.press(getByLabelText('Süreyi artır'));
  fireEvent.press(getByLabelText('Süreyi artır'));
  fireEvent.press(getByLabelText('Süreyi azalt'));
  getByText(new RegExp(`~${estimateActivityKcal('kosu', 35)} kcal tahmini`));
  fireEvent.press(getByLabelText('Ekle'));
  expect(onAdd).toHaveBeenCalledWith(35);
});
