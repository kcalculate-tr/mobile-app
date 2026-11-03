import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useHandleClaim } from '../useHandleClaim';
import { translate } from '../../../core/i18n';

// Rezerve kullanıcı adı (madde 6): useHandleClaim 'reserved' biçim hatasını
// handle_taken yerine handle_reserved'a eşler; i18n metni "Bu kullanıcı adı ayrılmış".
test('reserved handle → messageKey profil.handle_reserved', async () => {
  const { result } = renderHook(() => useHandleClaim());
  act(() => {
    result.current.setValue('admin'); // RESERVED listesinde
  });
  await waitFor(() => {
    expect(result.current.status).toBe('invalid');
  });
  expect(result.current.messageKey).toBe('profil.handle_reserved');
});

test('reserved i18n metni TR/EN', () => {
  expect(translate('tr', 'profil.handle_reserved')).toBe('Bu kullanıcı adı ayrılmış');
  expect(translate('en', 'profil.handle_reserved')).toBe('This username is reserved');
});
