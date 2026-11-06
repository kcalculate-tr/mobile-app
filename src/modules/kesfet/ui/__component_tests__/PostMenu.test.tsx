// G11-S3 bileşen testi — PostMenu "Düzenle" gizleme.
// canEdit false (update_my_post RPC yok) → "Düzenle" satırı HİÇ çizilmez.
// G12-S2 / G15-S3 — şikayet akışı tam sayfa: FinReport → FinReportDone; hata sakin not.
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

test('şikayet başarılı → tam sayfa "Teşekkürler, inceleyeceğiz" (FinReportDone)', async () => {
  const onReport = jest.fn().mockResolvedValue(true);
  const { getByLabelText, queryByText } = renderMenu({ onReport, onMute: () => {} });
  fireEvent.press(getByLabelText('Şikayet et'));
  // FinReport: neden seçilmeden Gönder pasif.
  expect(getByLabelText('Gönder').props.accessibilityState?.disabled).toBe(true);
  fireEvent.press(getByLabelText('Spam ya da dolandırıcılık'));
  await act(async () => {
    fireEvent.press(getByLabelText('Gönder'));
  });
  await waitFor(() => expect(queryByText('Teşekkürler, inceleyeceğiz')).toBeTruthy());
  expect(onReport).toHaveBeenCalledWith('spam', '');
  // Sonraki seçenekler: engelle + (verildiği için) sessize al; "daha az göster" verilmedi → yok.
  expect(queryByText('Dyt. Elif hesabını engelle')).toBeTruthy();
  expect(queryByText('Sessize al')).toBeTruthy();
  expect(queryByText('Benzerlerini daha az göster')).toBeNull();
});

test('şikayet başarısız → sakin not + "Tekrar dene", neden adımında kalır', async () => {
  const onReport = jest.fn().mockResolvedValue(false);
  const { getByLabelText, queryByText } = renderMenu({ onReport });
  fireEvent.press(getByLabelText('Şikayet et'));
  fireEvent.press(getByLabelText('Sahte hesap'));
  await act(async () => {
    fireEvent.press(getByLabelText('Gönder'));
  });
  await waitFor(() => expect(queryByText('Bağlantı sorunu olabilir. Birazdan tekrar dene.')).toBeTruthy());
  expect(getByLabelText('Tekrar dene')).toBeTruthy();
  expect(queryByText('Teşekkürler, inceleyeceğiz')).toBeNull();
});

test('Engelle → onay sayfası (FinPostMenuBlock), siyah Engelle', () => {
  const onBlock = jest.fn();
  const { getByLabelText, queryByText, getAllByLabelText } = renderMenu({ onBlock });
  fireEvent.press(getByLabelText('Engelle'));
  expect(queryByText('Dyt. Elif engellensin mi?')).toBeTruthy();
  const btns = getAllByLabelText('Engelle');
  fireEvent.press(btns[btns.length - 1]);
  expect(onBlock).toHaveBeenCalled();
});
