// G22-S2 md.5 (Tur 26j) — FinNotificationsError (yüklenemedi + Tekrar dene) ve
// FinShareDay (önizleme · gönderim hatası satır içi + Tekrar dene · başarı).
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => ({ params: {} }),
}));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets };
});

import NotificationsScreen from '../NotificationsScreen';
import { ShareDaySheet } from '../ShareDaySheet';
import { AddToast } from '../AddToast';
import { getKesfetClient, resetKesfetClient, setKesfetClient } from '../../client';
import { useNotificationsStore } from '../../notificationsStore';
import { buildShareDayCard } from '../../../gun/shareDay';

afterEach(() => {
  resetKesfetClient();
  useNotificationsStore.getState().reset();
  jest.clearAllMocks();
});

function withNotifications(impl: () => Promise<unknown>) {
  const base = getKesfetClient();
  setKesfetClient({
    ...base,
    listSocialNotifications: impl,
    markSocialNotificationsRead: async () => {},
  } as typeof base);
}

test('FinNotificationsError: yükleme başarısız → "Bildirimler yüklenemedi" + Tekrar dene', async () => {
  withNotifications(() => Promise.reject(new Error('network')));
  const r = render(<NotificationsScreen />);
  await act(async () => {});
  expect(r.getByText('Bildirimler yüklenemedi')).toBeTruthy();
  expect(r.getByText('Bağlantını kontrol edip tekrar dene.')).toBeTruthy();
  expect(r.getByTestId('notif-error-retry')).toBeTruthy();
  // Boş durum metni hata yerine GÖSTERİLMEZ.
  expect(r.queryByText('Henüz bildirim yok.')).toBeNull();
});

test('FinNotificationsError: Tekrar dene → yeniden yükler, hata kalkar', async () => {
  const list = jest
    .fn()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue({ items: [], next_cursor: null, unread: 0 });
  withNotifications(list);
  const r = render(<NotificationsScreen />);
  await act(async () => {});
  expect(r.getByText('Bildirimler yüklenemedi')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByTestId('notif-error-retry'));
  });
  expect(list).toHaveBeenCalledTimes(2);
  expect(r.queryByText('Bildirimler yüklenemedi')).toBeNull();
});

const card = buildShareDayCard({
  meals: [
    { id: 'c1', meal_type: 'kahvalti', kcal: 400, consumed_at: '2026-11-10T08:00:00Z' },
    { id: 'c2', meal_type: 'ogle', kcal: 600, consumed_at: '2026-11-10T12:00:00Z' },
  ],
  summary: { targetKcal: 2000, consumedKcal: 1000, consumedProtein: 50, consumedCarb: 120, consumedFat: 30 },
});

test('FinShareDay: önizleme kartı (kcal / hedef, P·K·Y, öğün kutucukları) + Paylaş', async () => {
  const r = render(
    <ShareDaySheet visible onClose={() => {}} onShared={() => {}} load={async () => card} submit={async () => {}} />,
  );
  await act(async () => {});
  expect(r.getByText('Günümü Keşfet’te paylaş')).toBeTruthy();
  expect(r.getByText('1.000 / 2.000 kcal')).toBeTruthy();
  expect(r.getByText('P 50 g')).toBeTruthy();
  expect(r.getByText('K 120 g')).toBeTruthy();
  expect(r.getByText('Kahvaltı')).toBeTruthy();
  expect(r.getByText('Öğle')).toBeTruthy();
  expect(r.getByText('Paylaş')).toBeTruthy();
  // Sunucu alanı yokken seçenekler gizli.
  expect(r.queryByText('Kimler görebilir')).toBeNull();
});

test('FinShareDay: gönderim hatası → satır içi uyarı + Tekrar dene; ikinci deneme başarılı', async () => {
  const submit = jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
  const onShared = jest.fn();
  const r = render(<ShareDaySheet visible onClose={() => {}} onShared={onShared} load={async () => card} submit={submit} />);
  await act(async () => {});
  await act(async () => {
    fireEvent.press(r.getByTestId('share-day-submit'));
  });
  expect(submit).toHaveBeenCalledWith(['c1', 'c2']);
  expect(r.getByTestId('share-day-send-error')).toBeTruthy();
  expect(r.getByText('Günün paylaşılamadı. Bağlantını kontrol edip tekrar dene.')).toBeTruthy();
  expect(onShared).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.press(r.getByText('Tekrar dene'));
  });
  expect(submit).toHaveBeenCalledTimes(2);
  expect(onShared).toHaveBeenCalledWith('public');
});

test('FinShareDay: yükleme hatası → satır içi uyarı + Tekrar dene yeniden yükler', async () => {
  const load = jest.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(card);
  const r = render(<ShareDaySheet visible onClose={() => {}} onShared={() => {}} load={load} submit={async () => {}} />);
  await act(async () => {});
  expect(r.getByText('Günün özeti yüklenemedi.')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByText('Tekrar dene'));
  });
  expect(load).toHaveBeenCalledTimes(2);
  expect(r.getByTestId('share-day-preview')).toBeTruthy();
});

test('FinShareDay: bugün öğün yoksa açıklama, Paylaş pasif', async () => {
  const submit = jest.fn();
  const r = render(
    <ShareDaySheet
      visible
      onClose={() => {}}
      onShared={() => {}}
      load={async () => buildShareDayCard({ meals: [] })}
      submit={submit}
    />,
  );
  await act(async () => {});
  expect(r.getByTestId('share-day-empty')).toBeTruthy();
  fireEvent.press(r.getByTestId('share-day-submit'));
  expect(submit).not.toHaveBeenCalled();
});

test('FinShareDay (seçenekler açık): Kimler görebilir · Takipçiler seçili → onShared(followers)', async () => {
  const onShared = jest.fn();
  const r = render(
    <ShareDaySheet visible options onClose={() => {}} onShared={onShared} load={async () => card} submit={async () => {}} />,
  );
  await act(async () => {});
  expect(r.getByText('Kimler görebilir')).toBeTruthy();
  expect(r.getByText('Kalori ve makroları göster')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByTestId('share-day-submit'));
  });
  expect(onShared).toHaveBeenCalledWith('followers');
});

test('FinShareDaySuccess: başarı bildirimi metni', () => {
  const r = render(<AddToast sticky toast={{ message: 'Günün takipçilerinle paylaşıldı', success: true }} onDismiss={() => {}} />);
  expect(r.getByText('Günün takipçilerinle paylaşıldı')).toBeTruthy();
});
