// G22-S2 md.6 — Profil › Ayarlar › Dil: bayraklı liste, Telefon dili en üstte
// (varsayılan), seçince uygulama anında o dile geçer ve tercih kalıcı.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: any) => children };
});
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'tr' }] }));

import { I18nProvider } from '../../../core/i18n';
import SettingsLanguageScreen from '../ui/screens/SettingsLanguageScreen';

const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => {});
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

function renderScreen() {
  return render(
    <I18nProvider>
      <SettingsLanguageScreen onBack={() => {}} />
    </I18nProvider>,
  );
}

test('liste: Telefon dili (seçili, varsayılan) + Türkçe + English, bayrak ve alt satır', async () => {
  const ui = renderScreen();
  await flush();
  expect(ui.getByText('Telefon dili')).toBeTruthy();
  // Türkçe: dil satırı + Telefon dili alt satırı (cihaz dili tr).
  expect(ui.getAllByText('Türkçe')).toHaveLength(2);
  expect(ui.getByText('English')).toBeTruthy();
  expect(ui.getByText('Turkish')).toBeTruthy();
  expect(ui.getByText('İngilizce')).toBeTruthy();
  expect(ui.getByTestId('lang-system').props.accessibilityState).toEqual({ selected: true });
  expect(ui.getByTestId('lang-en').props.accessibilityState).toEqual({ selected: false });
});

test('English seçilince uygulama anında İngilizceye geçer ve tercih saklanır', async () => {
  const ui = renderScreen();
  await flush();
  fireEvent.press(ui.getByTestId('lang-en'));
  await flush();
  expect(ui.getByText('Phone language')).toBeTruthy();
  expect(ui.getByText('Language')).toBeTruthy();
  expect(ui.getByTestId('lang-en').props.accessibilityState).toEqual({ selected: true });
  expect(await AsyncStorage.getItem('i18n-lang-pref')).toBe('en');

  // Telefon dili'ne dönünce cihaz dili (tr) geri gelir.
  fireEvent.press(ui.getByTestId('lang-system'));
  await flush();
  expect(ui.getByText('Telefon dili')).toBeTruthy();
  expect(await AsyncStorage.getItem('i18n-lang-pref')).toBe('system');
});

test('kayıtlı tercih açılışta yüklenir', async () => {
  await AsyncStorage.setItem('i18n-lang-pref', 'en');
  const ui = renderScreen();
  await flush();
  expect(ui.getByText('App language')).toBeTruthy();
  expect(ui.getByTestId('lang-en').props.accessibilityState).toEqual({ selected: true });
});

test('satırlar ≥ 44 pt ve VoiceOver etiketi dil adını metin olarak taşır', async () => {
  const ui = renderScreen();
  await flush();
  const row = ui.getByTestId('lang-tr');
  expect(row.props.accessibilityLabel).toBe('Türkçe, Turkish');
  const style = typeof row.props.style === 'function' ? row.props.style({ pressed: false }) : row.props.style;
  const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
  expect(flat.minHeight).toBeGreaterThanOrEqual(44);
});
