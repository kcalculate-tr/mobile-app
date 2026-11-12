// G25-S1 md.8 (A11) — TbPace "—" tarih satırı veri yokken GİZLİ.
// G25-S1 md.9 (A12) — Takibe başla kaydı `ok:false` → hata toast'ı + Tekrar dene; kutlama yalnız başarıda.
// G25-S1 md.10 (A13) — Toast düğmeleri i18n (TR "Geri al/Gör", EN "Undo/View").
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('../../../../core/flags', () => ({ __esModule: true, useFeature: () => false }));
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));
const mockSave = jest.fn();
jest.mock('../save', () => ({ saveTakibeProfile: (...a: unknown[]) => mockSave(...a) }));

import { __tbScreensForTest } from '../TakibeNavigator';
import { useTbDraft } from '../draft';
import { useOnbFirst } from '../../first/store';
import { Toast } from '../../../../core/design/components/Toast';
import { I18nProvider } from '../../../../core/i18n';

const { PaceScreen, ResultScreen, FirstScreen } = __tbScreensForTest;
const root = { navigate: jest.fn(), goBack: jest.fn() };
const nav = { goBack: jest.fn(), navigate: jest.fn(), getParent: () => root } as never;

const flush = async () => {
  for (let i = 0; i < 3; i++) await act(async () => {});
};

function fillDraft() {
  const d = useTbDraft.getState();
  d.reset();
  d.setGoal('lose' as never);
  d.setGender('female' as never);
  d.setBirthYear(1995);
  d.setHeightCm(168);
  d.setWeightKg(70);
  d.setActivity('light' as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  fillDraft();
});

test('A11: TbPace — tarih satırı (projeksiyon) veri yokken çizilmez; "—" yok', () => {
  const r = render(<PaceScreen navigation={nav} route={{ key: 'p', name: 'TbPace' } as never} />);
  expect(r.queryByText('—')).toBeNull();
});

test('A12: Sonuç — kayıt başarısız → hata toast\'ı + Tekrar dene, kutlama/geçiş yok; tekrar başarılı → kutlama', async () => {
  const celebrate = jest.spyOn(useOnbFirst.getState(), 'queueCelebrate');
  mockSave.mockResolvedValueOnce({ ok: false, error: 'net' });
  const r = render(<ResultScreen navigation={nav} route={{ key: 'r', name: 'TbResult' } as never} />);
  await act(async () => {
    fireEvent.press(r.getByText('Devam et'));
  });
  await flush();
  expect(r.getByTestId('tb-save-error')).toBeTruthy();
  expect(r.getByText('Profilin kaydedilemedi. Bağlantını kontrol edip tekrar dene.')).toBeTruthy();
  expect(root.navigate).not.toHaveBeenCalled();
  expect(celebrate).not.toHaveBeenCalled();
  expect(useTbDraft.getState().weightKg).toBe(70); // taslak korunur

  mockSave.mockResolvedValueOnce({ ok: true });
  await act(async () => {
    fireEvent.press(r.getByTestId('tb-save-error-retry'));
  });
  await flush();
  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(root.navigate).toHaveBeenCalledWith('Tabs', { screen: 'Tracker' });
  expect(celebrate).toHaveBeenCalledTimes(1);
  celebrate.mockRestore();
});

test('A12: İlk adım — kayıt başarısızsa Tara\'ya geçmez; Tekrar dene aynı hedefe gider', async () => {
  mockSave.mockResolvedValueOnce({ ok: false });
  const r = render(<FirstScreen navigation={nav} route={{ key: 'f', name: 'TbFirst' } as never} />);
  await act(async () => {
    fireEvent.press(r.getByText('Tara'));
  });
  await flush();
  expect(r.getByTestId('tb-save-error')).toBeTruthy();
  expect(root.navigate).not.toHaveBeenCalled();
  mockSave.mockResolvedValueOnce({ ok: true });
  await act(async () => {
    fireEvent.press(r.getByTestId('tb-save-error-retry'));
  });
  await flush();
  expect(root.navigate).toHaveBeenCalledWith('AiScan');
});

test('A13: Toast düğmeleri i18n — TR "Geri al/Gör", EN "Undo/View"', () => {
  const tr = render(<Toast visible message="x" onUndo={jest.fn()} onView={jest.fn()} />);
  expect(tr.getByLabelText('Geri al')).toBeTruthy();
  expect(tr.getByLabelText('Gör')).toBeTruthy();
  tr.unmount();
  const en = render(
    <I18nProvider forceLang="en">
      <Toast visible message="x" onUndo={jest.fn()} onView={jest.fn()} onRetry={jest.fn()} />
    </I18nProvider>,
  );
  expect(en.getByText('Undo')).toBeTruthy();
  expect(en.getByText('View')).toBeTruthy();
  expect(en.getByText('Retry')).toBeTruthy();
  expect(en.queryByText('Geri al')).toBeNull();
});
