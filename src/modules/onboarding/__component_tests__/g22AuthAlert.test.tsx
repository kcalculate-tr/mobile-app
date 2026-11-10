// G22-S2 md.5 (Tur 26j, FinOnbAccountError) — Apple/Google satır içi uyarısı:
// ağ → "Bağlanamadık", hesap → sağlayıcıya göre başlık; "Tekrar dene" aynı
// sağlayıcıyı yeniden dener; VoiceOver için role=alert. İptal hiç çizilmez
// (sınıflandırıcı testleri: __tests__/socialAuthError.test.ts).
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AuthAlert } from '../components/AuthAlert';

test('ağ hatası: Bağlanamadık + İnternet bağlantını… + Tekrar dene', () => {
  const onRetry = jest.fn();
  const r = render(<AuthAlert kind="network" provider="apple" onRetry={onRetry} />);
  expect(r.getByText('Bağlanamadık')).toBeTruthy();
  expect(r.getByText('İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
  expect(r.getByTestId('onb-auth-alert').props.accessibilityRole).toBe('alert');
  fireEvent.press(r.getByTestId('onb-auth-retry'));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test('hesap hatası: Apple / Google başlığı + e-posta alternatifi metni', () => {
  const a = render(<AuthAlert kind="account" provider="apple" onRetry={() => {}} />);
  expect(a.getByText('Apple ile giriş tamamlanamadı')).toBeTruthy();
  expect(a.getByText('Hesabın doğrulanamadı. Tekrar dene ya da e-posta ile devam et.')).toBeTruthy();
  const g = render(<AuthAlert kind="account" provider="google" onRetry={() => {}} />);
  expect(g.getByText('Google ile giriş tamamlanamadı')).toBeTruthy();
});

test('yeniden denerken düğme pasif ve "Bağlanıyor…"', () => {
  const onRetry = jest.fn();
  const r = render(<AuthAlert kind="network" provider="google" busy onRetry={onRetry} />);
  expect(r.getByText('Bağlanıyor…')).toBeTruthy();
  fireEvent.press(r.getByTestId('onb-auth-retry'));
  expect(onRetry).not.toHaveBeenCalled();
});
