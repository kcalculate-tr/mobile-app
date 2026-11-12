// G32-S1 md.6 — Light + Dark + EN kanıtı (Playwright/web ekran görüntüsü yerine bileşen testi):
// yeni yüzeyler tema zemini/rolleriyle boyanır, EN metinleri eksiksiz.
import React from 'react';
import { StyleSheet } from 'react-native';
import { render as rtlRender } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../../core/design/ThemeProvider';
import { themes } from '../../../../core/design/theme';
import { I18nProvider, translate } from '../../../../core/i18n';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
type Scheme = 'light' | 'dark';
const render = (ui: React.ReactElement, scheme: Scheme, lang: 'tr' | 'en') =>
  rtlRender(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider forceScheme={scheme}>
        <I18nProvider forceLang={lang}>{ui}</I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
const bg = (el: { props: { style?: unknown } }) => (StyleSheet.flatten(el.props.style as never) as Record<string, unknown>).backgroundColor;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StorePinnedHeader } = require('../ui/store/StoreHeader');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BranchCards } = require('../ui/checkout/BranchCards');

const ROWS = [
  { branch: { id: 'b1', name: 'Bayraklı (Mansuroğlu)', slug: 'mansuroglu', address: 'Mansuroğlu Mah. 271. Sk. No:6A Bayraklı İzmir', latitude: 1, longitude: 1 }, km: 2.44 },
  { branch: { id: 'b2', name: 'Yeni Şube', slug: 'yok', address: 'Alsancak Mah. 1453 Sk. Konak İzmir', latitude: 1, longitude: 1 }, km: 7.1 },
];

describe.each(['light', 'dark'] as Scheme[])('%s tema', (scheme) => {
  const c = themes[scheme].color;

  test('mağaza yapışkan başlığı opak tema zemini (içerik altından görünmez)', () => {
    const r = render(<StorePinnedHeader name="KCAL" onBack={jest.fn()} chips={['Salata']} selected={null} onSelect={jest.fn()} />, scheme, 'tr');
    expect(bg(r.getByTestId('ek-store-pinned'))).toBe(c.bg);
    expect(c.bg).toMatch(/^#[0-9A-Fa-f]{6}$/); // tam opak renk
  });

  test('şube kartları: yüzey rengi, seçili lime çerçeve; görseli olmayan şubede cam kase', () => {
    const r = render(<BranchCards rows={ROWS} selectedId="b1" open nearestId="b1" onSelect={jest.fn()} />, scheme, 'tr');
    const sel = StyleSheet.flatten(r.getByTestId('ek-branch-card-b1').props.style) as Record<string, unknown>;
    const other = StyleSheet.flatten(r.getByTestId('ek-branch-card-b2').props.style) as Record<string, unknown>;
    expect(sel.backgroundColor).toBe(c.surface);
    expect(sel.borderColor).toBe(c.accent);
    expect(other.borderColor).toBe(c.line);
    expect(r.getByTestId('ek-branch-card-placeholder')).toBeTruthy();
    expect(r.getByText('2,4 km')).toBeTruthy();
    expect(r.getAllByText('Açık')).toHaveLength(2);
  });
});

test('EN metinler: şube kartı + "Choose a branch" + saat "Full"', () => {
  const r = render(<BranchCards rows={ROWS} selectedId={null} open={false} nearestId="b1" onSelect={jest.fn()} />, 'dark', 'en');
  expect(r.getAllByText('Closed')).toHaveLength(2);
  expect(r.getByText('Nearest')).toBeTruthy();
  expect(r.getByText('2.4 km')).toBeTruthy();
  expect(translate('en', 'eatkcal.v2.checkout.branch_pick')).toBe('Choose a branch');
  expect(translate('en', 'eatkcal.v2.checkout.branch_open')).toBe('Open');
  expect(translate('en', 'eatkcal.v2.checkout.slot_full')).toBe('Full');
  expect(translate('tr', 'eatkcal.v2.checkout.branch_pick')).toBe('Şube seç');
});
