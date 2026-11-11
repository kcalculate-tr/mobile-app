// G32-S1 (12 Kas, TestFlight ekran görüntüleri) — eatkcal arayüz düzeltmeleri bileşen testleri.
import React from 'react';
import { StyleSheet } from 'react-native';
import { render as rtlRender } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (ui: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);
const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, number>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StoreCard, STORE_CARD } = require('../ui/home/cards');

describe('md.1 Mağaza kartı oranı', () => {
  test('görsel ~%75, alt bant ~%25 (ad 1 satır; puan + süre aynı satır)', () => {
    const r = render(
      <StoreCard
        name="KCAL Bornova"
        subtitle="Randevulu, 30–45 dk"
        rating={{ average: 4.5, count: 23, isNew: false }}
        onPress={jest.fn()}
      />,
    );
    const photo = flat(r.getByTestId('ek-store-card-photo'));
    const body = flat(r.getByTestId('ek-store-card-body'));
    expect(photo.height).toBe(STORE_CARD.photo);
    // Alt bant: üst/alt boşluk + ad satırı (20) + aralık + meta satırı (17).
    const bodyH = (body.paddingTop ?? 0) + (body.paddingBottom ?? 0) + (body.gap ?? 0) + 20 + 17;
    const ratio = photo.height / (photo.height + bodyH);
    expect(ratio).toBeGreaterThanOrEqual(0.72);
    expect(ratio).toBeLessThanOrEqual(0.78);
    expect(r.getByText('KCAL Bornova').props.numberOfLines).toBe(1);
    expect(r.getByText('Randevulu, 30–45 dk')).toBeTruthy();
    expect(r.getByTestId('ek-store-card-rating')).toBeTruthy();
  });
});
