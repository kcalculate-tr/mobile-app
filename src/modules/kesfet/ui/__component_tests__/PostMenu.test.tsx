// G11-S3 bileşen testi — PostMenu "Düzenle" gizleme.
// canEdit false (update_my_post RPC yok) → "Düzenle" satırı HİÇ çizilmez.
// G12-S2 — şikayet akışı: sonuca göre FinReportDone / FinReportNotice.
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PostMenu } from '../PostMenu';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderMenu(props: Partial<React.ComponentProps<typeof PostMenu>>) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PostMenu
        visible
        onClose={() => {}}
        authorName="Dyt. Elif"
        onCopyLink={() => {}}
        onReport={() => {}}
        onBlock={() => {}}
        {...props}
      />
    </SafeAreaProvider>,
  );
}

test('kendi gönderin + canEdit → "Düzenle" görünür', () => {
  const { queryByText } = renderMenu({ isMine: true, canEdit: true, onEdit: () => {}, onDelete: () => {} });
  expect(queryByText('Düzenle')).toBeTruthy();
  expect(queryByText('Sil')).toBeTruthy();
});

test('canEdit false (RPC yok) → "Düzenle" gizli, Sil durur', () => {
  const { queryByText } = renderMenu({ isMine: true, canEdit: false, onEdit: () => {}, onDelete: () => {} });
  expect(queryByText('Düzenle')).toBeNull();
  expect(queryByText('Sil')).toBeTruthy();
});

test('başkasının gönderisi → Düzenle/Sil yok, Şikayet/Engelle var', () => {
  const { queryByText } = renderMenu({ isMine: false, canEdit: true });
  expect(queryByText('Düzenle')).toBeNull();
  expect(queryByText('Sil')).toBeNull();
  expect(queryByText('Şikayet et')).toBeTruthy();
  expect(queryByText('Engelle')).toBeTruthy();
});

test('şikayet başarılı → "Şikayetin alındı" (FinReportDone)', async () => {
  const onReport = jest.fn().mockResolvedValue(true);
  const { getByLabelText, queryByText } = renderMenu({ onReport });
  fireEvent.press(getByLabelText('Şikayet et'));
  await act(async () => {
    fireEvent.press(getByLabelText('Spam'));
  });
  await waitFor(() => expect(queryByText('Şikayetin alındı')).toBeTruthy());
  expect(onReport).toHaveBeenCalledWith('spam');
});

test('şikayet başarısız → "Şikayet gönderilemedi" (FinReportNotice) + tekrar dene', async () => {
  const onReport = jest.fn().mockResolvedValue(false);
  const { getByLabelText, queryByText } = renderMenu({ onReport });
  fireEvent.press(getByLabelText('Şikayet et'));
  await act(async () => {
    fireEvent.press(getByLabelText('Spam'));
  });
  await waitFor(() => expect(queryByText('Şikayet gönderilemedi')).toBeTruthy());
  fireEvent.press(getByLabelText('Tekrar dene'));
  expect(queryByText('Neden şikayet ediyorsun?')).toBeTruthy();
});
